/**
 * 抖音 / TikTok 无水印解析与代理下载云函数
 *
 * 由本地工具 douyin-downloader/parser.py 移植而来，运行在 CloudBase 上海区域，
 * 可直接访问 iesdouyin / tikwm / TikTok 等接口。媒体文件因防盗链(Referer)与
 * 浏览器 CORS 限制必须经服务端代理；为绕过 callFunction 返回大小限制，视频采用
 * 分块(Range)代理，前端拼装为 Blob。
 *
 * 入参 event:
 *   { action: "parse", url }                 -> 解析链接，返回媒体清单
 *   { action: "media", url, referer?, range? } -> 代理单个媒体分块(base64)
 *
 * 返回信封统一为 { ok, error?, data? }，与全站 callCloudFunction 约定一致。
 */
const { withTiming, logError, logInfo } = require("./logger");

class ParseError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "ParseError";
  }
}

const COMMON_HEADER = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

const IOS_HEADER = {
  ...COMMON_HEADER,
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

const ANDROID_HEADER = {
  ...COMMON_HEADER,
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

const TIKTOK_HEADER = {
  ...COMMON_HEADER,
  Origin: "https://www.tiktok.com",
  Referer: "https://www.tiktok.com/",
};

const TTWID_REGISTER_URL = "https://ttwid.bytedance.com/ttwid/union/register/";
const PLAY_RATIOS = ["1080p", "720p", "540p", "360p"];
const TTWID_PAYLOAD = {
  region: "cn",
  aid: 1768,
  needFid: false,
  service: "www.iesdouyin.com",
  union: true,
  fid: "",
};

const URL_RE = /https?:\/\/[^\s，。、）)】\]]+/;
const BAD_CHARS = /[\\/:*?"<>|\r\n\t]/g;

// 单个分块上限：2MB，base64 后约 2.7MB，稳妥低于 callFunction 返回限制
const MAX_CHUNK = 2 * 1024 * 1024;

// 媒体代理 SSRF 防护：仅允许抖音/TikTok 相关 CDN 域名
const ALLOWED_HOST_SUFFIXES = [
  "douyin.com",
  "douyinpic.com",
  "douyinstatic.com",
  "douyinvod.com",
  "iesdouyin.com",
  "snssdk.com",
  "amemv.com",
  "bytecdn.cn",
  "byteimg.com",
  "byteoss.com",
  "bytevideo.com",
  "pstatp.com",
  "ixigua.com",
  "toutiao.com",
  "tiktok.com",
  "tiktokcdn.com",
  "tiktokv.com",
  "musical.ly",
  "tikwm.com",
];

function safeName(s, maxlen = 40) {
  let v = (s || "").replace(BAD_CHARS, "_");
  v = v.replace(/^[\s._-]+|[\s._-]+$/g, "");
  return (v || "media").slice(0, maxlen);
}

function firstUrl(text) {
  const t = (text || "").trim();
  const m = t.match(URL_RE);
  return m ? m[0] : t;
}

function pick(list, idx = 0) {
  if (!list || !list.length) return null;
  return idx < list.length ? list[idx] : list[0];
}

function detectPlatform(url) {
  const u = firstUrl(url).toLowerCase();
  if (u.includes("douyin") || u.includes("iesdouyin")) return "douyin";
  if (u.includes("tiktok")) return "tiktok";
  return "";
}

function isAllowedMediaHost(u) {
  let host = "";
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  // 拒绝环回/内网地址
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|localhost)/.test(host)) return false;
  if (host.startsWith("::1") || host.startsWith("fe80")) return false;
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
}

/** 从响应头提取 ttwid 凭证（手动 cookie 管理，替代 requests.Session） */
function extractTtwid(headers) {
  try {
    if (typeof headers.getSetCookie === "function") {
      const arr = headers.getSetCookie() || [];
      for (const c of arr) {
        const m = c.match(/ttwid\s*=\s*([^;]+)/);
        if (m) return m[1];
      }
    }
  } catch {
    // getSetCookie 不可用则回退
  }
  const raw = headers.get ? headers.get("set-cookie") || "" : "";
  const m = raw.match(/ttwid\s*=\s*([^;]+)/);
  return m ? m[1] : null;
}

/** 从 startIdx 起提取首个平衡的 JSON 对象（替代 Python json.raw_decode） */
function extractBalancedJson(s, fromIdx) {
  let i = s.indexOf("{", fromIdx);
  if (i < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  const start = i;
  for (i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

function respSize(headers) {
  const cr = headers.get("content-range");
  if (cr) {
    const m = cr.match(/\/(\d+)\s*$/);
    if (m) return parseInt(m[1], 10);
  }
  const cl = headers.get("content-length");
  if (cl) {
    const n = parseInt(cl, 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

/** 轻量 cookie 会话：跨请求维持 ttwid */
class Session {
  constructor() {
    this.ttwid = null;
    this.baseHeaders = { ...COMMON_HEADER };
  }

  async fetch(url, opts = {}) {
    const headers = { ...this.baseHeaders, ...(opts.headers || {}) };
    if (this.ttwid) headers["Cookie"] = `ttwid=${this.ttwid}`;
    const res = await fetch(url, { ...opts, headers });
    const tw = extractTtwid(res.headers);
    if (tw) this.ttwid = tw;
    return res;
  }

  close() {
    this.ttwid = null;
  }
}

const DOUYIN_PATTERNS = [
  [/v\.douyin\.com\/[A-Za-z0-9_-]+/, "short"],
  [/jx\.douyin\.com\/[A-Za-z0-9_-]+/, "short"],
  [/iesdouyin\.com\/share\/(?<ty>slides|video|note)\/(?<vid>\d+)/, "typed"],
  [/m\.douyin\.com\/share\/(?<ty>slides|video|note)\/(?<vid>\d+)/, "typed"],
  [/jingxuan\.douyin\.com\/m\/(?<ty>slides|video|note)\/(?<vid>\d+)/, "typed"],
  [/douyin\.com\/(?<ty>video|note)\/(?<vid>\d+)/, "typed"],
  [/aweme_id[=:/\s]+(?<vid>\d{10,})/, "vid"],
  [/aweme\/(?<vid>\d{10,})/, "vid"],
];

class DouyinParser {
  constructor() {
    this.session = new Session();
  }

  async parse(raw) {
    const url = firstUrl(raw);
    const { kind, m, ty, vid } = this._match(url);
    if (kind === "short") {
      const real = await this._resolveShort("https://" + m[0]);
      return this.parse(real);
    }
    if (kind === "vid") return this._parseVideo(vid, "video");
    const realTy = ty || "video";
    if (realTy === "slides") return this._parseSlides(vid);
    return this._parseVideo(vid, realTy);
  }

  _match(url) {
    for (const [pat, kind] of DOUYIN_PATTERNS) {
      const m = pat.exec(url);
      if (m) {
        if (kind === "short") return { kind, m };
        if (kind === "typed") return { kind, ty: m.groups.ty, vid: m.groups.vid };
        if (kind === "vid") return { kind, vid: m.groups.vid };
      }
    }
    if (/^\d{18,20}$/.test(url.trim())) return { kind: "vid", vid: url.trim() };
    throw new ParseError("无法识别的抖音链接");
  }

  async _resolveShort(url) {
    const res = await this.session.fetch(url, { headers: IOS_HEADER, redirect: "follow" });
    const final = res.url || url;
    let host = "";
    try {
      host = new URL(final).hostname || "";
    } catch {
      host = "";
    }
    if (host.includes("douyin") || host.includes("iesdouyin")) return final;
    throw new ParseError("短链解析失败");
  }

  async _ensureTtwid() {
    if (this.session.ttwid) return;
    const headers = {
      ...IOS_HEADER,
      "Content-Type": "application/json",
      Referer: "https://www.iesdouyin.com/",
    };
    let res;
    try {
      res = await fetch(TTWID_REGISTER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(TTWID_PAYLOAD),
        redirect: "follow",
      });
    } catch {
      throw new ParseError("获取 ttwid 凭证失败");
    }
    let tw = extractTtwid(res.headers);
    if (tw) {
      this.session.ttwid = tw;
      return;
    }
    // 部分情况下 ttwid 经 redirect_url 二次下发
    try {
      const body = await res.json();
      if (body && body.redirect_url) {
        const r2 = await fetch(body.redirect_url, {
          headers: { ...IOS_HEADER, Referer: "https://www.iesdouyin.com/" },
          redirect: "manual",
        });
        const tw2 = extractTtwid(r2.headers);
        if (tw2) {
          this.session.ttwid = tw2;
          return;
        }
      }
    } catch {
      // 忽略解析异常
    }
    throw new ParseError("获取 ttwid 凭证失败");
  }

  async _parseVideo(vid, ty) {
    await this._ensureTtwid();
    const shareUrl = `https://www.iesdouyin.com/share/${ty}/${vid}/`;
    const res = await this.session.fetch(shareUrl, { headers: IOS_HEADER, redirect: "manual" });
    if (res.status !== 200) throw new ParseError(`分享页请求失败: HTTP ${res.status}`);
    const text = await res.text();
    const m = text.match(/window\._ROUTER_DATA\s*=\s*([\s\S]*?)<\/script>/);
    if (!m) throw new ParseError("未在页面中找到 _ROUTER_DATA");
    const raw = m[1];
    const brace = raw.indexOf("{");
    if (brace < 0) throw new ParseError("_ROUTER_DATA 解析失败");
    const jsonStr = extractBalancedJson(raw, brace);
    if (!jsonStr) throw new ParseError("_ROUTER_DATA JSON 解析失败");
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      throw new ParseError(`_ROUTER_DATA JSON 解析失败: ${e.message}`);
    }

    const page = findPage(data);
    if (!page) throw new ParseError("未找到 loaderData 中的页面数据");
    const itemList = (page.videoInfoRes && page.videoInfoRes.item_list) || [];
    if (!itemList.length) throw new ParseError("该内容可能已被删除或不可访问");
    const item = itemList[0];

    const title = item.desc || "";
    const authorObj = item.author || {};
    const authorName = authorObj.nickname || "";
    const createTime = item.create_time || 0;
    const video = item.video || {};
    const images = item.images || [];

    const coverUrl = pick((video.cover || {}).url_list);
    const avatarUrl =
      pick((authorObj.avatar_medium || {}).url_list) ||
      pick((authorObj.avatar_thumb || {}).url_list);
    const base = safeName(title || vid);

    const media = [];
    let mtype;
    if (images && images.length) {
      images.forEach((img, idx) => {
        const u = pick(img.url_list);
        if (u) {
          media.push({
            type: "image",
            url: u,
            referer: shareUrl,
            filename: `${base}_${idx + 1}.jpeg`,
          });
        }
      });
      mtype = "images";
    } else if (video) {
      const playAddr = video.play_addr || {};
      const urlList = playAddr.url_list || [];
      let videoUrl = await this._probeBest(playAddr, shareUrl);
      if (!videoUrl && urlList.length) {
        videoUrl = urlList[0].replace("playwm", "play");
      }
      if (videoUrl) {
        media.push({ type: "video", url: videoUrl, referer: shareUrl, filename: `${base}.mp4` });
      }
      mtype = "video";
    } else {
      throw new ParseError("未找到可下载的视频或图片");
    }

    return {
      platform: "douyin",
      type: mtype,
      title,
      author: authorName,
      avatar: avatarUrl ? { url: avatarUrl, referer: shareUrl } : null,
      cover: coverUrl ? { url: coverUrl, referer: shareUrl } : null,
      duration: video ? Math.floor((video.duration || 0) / 1000) : 0,
      create_time: createTime,
      media,
    };
  }

  async _probeBest(playAddr, referer) {
    let token = playAddr.uri;
    if (!token) {
      for (const u of playAddr.url_list || []) {
        try {
          const q = Object.fromEntries(new URL(u).searchParams);
          if (q.video_id) {
            token = q.video_id;
            break;
          }
        } catch {
          // 忽略非法 URL
        }
      }
    }
    if (!token) return null;
    let best = null; // [size, url]
    const headers = { ...IOS_HEADER };
    delete headers.Cookie;
    headers["Referer"] = referer;
    headers["Range"] = "bytes=0-1";
    for (const ratio of PLAY_RATIOS) {
      const playUrl = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${token}&ratio=${ratio}`;
      let r;
      try {
        r = await this.session.fetch(playUrl, { headers, redirect: "follow" });
      } catch {
        continue;
      }
      if (r.status >= 400) continue;
      const size = respSize(r.headers);
      if (size <= 0) continue;
      if (!best || size > best[0]) best = [size, r.url];
    }
    return best ? best[1] : null;
  }

  async _parseSlides(vid) {
    const api = "https://www.iesdouyin.com/web/api/v2/aweme/slidesinfo/";
    const params = new URLSearchParams({ aweme_ids: `[${vid}]`, request_source: "200" });
    const res = await this.session.fetch(`${api}?${params}`, {
      headers: ANDROID_HEADER,
      redirect: "follow",
    });
    if (res.status !== 200) throw new ParseError(`图集接口请求失败: HTTP ${res.status}`);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new ParseError(`图集数据解析失败: ${e.message}`);
    }
    const details = data.aweme_details || [];
    if (!details.length) throw new ParseError("图集数据为空, 可能已被删除");
    const d = details[0];
    const authorObj = d.author || {};
    const title = d.desc || "";
    const images = d.images || [];
    const referer = `https://www.iesdouyin.com/share/slides/${vid}/`;
    const base = safeName(title || vid);
    const media = [];
    images.forEach((img, idx) => {
      const u = pick(img.url_list);
      if (u) {
        media.push({ type: "image", url: u, referer, filename: `${base}_${idx + 1}.jpeg` });
      }
      const v = img.video;
      if (v) {
        const pa = v.play_addr || {};
        const vu = pick(pa.url_list);
        if (vu) {
          media.push({
            type: "dynamic",
            url: vu.replace("playwm", "play"),
            referer,
            filename: `${base}_${idx + 1}.mp4`,
          });
        }
      }
    });
    const cover = images.length ? pick(images[0].url_list) : null;
    const avatarUrl = pick((authorObj.avatar_thumb || {}).url_list);
    return {
      platform: "douyin",
      type: "slides",
      title,
      author: authorObj.nickname || "",
      avatar: avatarUrl ? { url: avatarUrl, referer } : null,
      cover: cover ? { url: cover, referer } : null,
      duration: 0,
      create_time: d.create_time || 0,
      media,
    };
  }
}

function findPage(data) {
  const loader = data.loaderData || {};
  if (!loader || typeof loader !== "object") return null;
  for (const v of Object.values(loader)) {
    if (v && typeof v === "object" && "videoInfoRes" in v) return v;
  }
  return null;
}

class TikTokParser {
  constructor() {
    this.session = new Session();
  }

  async parse(raw) {
    let url = firstUrl(raw);
    if (
      /(vt|vm|vt\.|vm\.)tiktok\.com\//.test(url) ||
      /^https?:\/\/(vt|vm)\.tiktok\.com/.test(url)
    ) {
      url = await this._resolveShort(url);
    }
    const viaTikwm = await this._viaTikwm(url);
    if (viaTikwm) return viaTikwm;
    return this._viaPage(url);
  }

  async _resolveShort(url) {
    if (!url.startsWith("http")) url = "https://" + url;
    const res = await this.session.fetch(url, { headers: TIKTOK_HEADER, redirect: "follow" });
    const host = (() => {
      try {
        return new URL(res.url || url).hostname || "";
      } catch {
        return "";
      }
    })();
    if (host.includes("tiktok")) return res.url || url;
    throw new ParseError("TikTok 短链解析失败");
  }

  async _viaTikwm(url) {
    let data;
    try {
      const r = await this.session.fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
        {
          headers: { "User-Agent": COMMON_HEADER["User-Agent"] },
          redirect: "follow",
        },
      );
      data = await r.json();
    } catch {
      return null;
    }
    if (data.code !== 0) return null;
    const d = data.data || {};
    const title = d.title || "";
    const authorObj = d.author || {};
    const authorName = authorObj.nickname || "";
    const cover = d.cover || d.origin_cover;
    const base = safeName(title || "tiktok");
    const media = [];
    const images = d.images || [];
    let play = d.play;
    if (play) {
      if (play.startsWith("/")) play = "https://www.tikwm.com" + play;
      media.push({
        type: "video",
        url: play,
        referer: "https://www.tikwm.com/",
        filename: `${base}.mp4`,
      });
    }
    images.forEach((img, idx) => {
      let u = null;
      if (typeof img === "string") u = img;
      else if (img && typeof img === "object") u = img.url || img.imageDisplay;
      if (u) {
        media.push({
          type: "image",
          url: u,
          referer: "https://www.tikwm.com/",
          filename: `${base}_${idx + 1}.jpeg`,
        });
      }
    });
    if (!media.length) return null;
    return {
      platform: "tiktok",
      type: images.length && !play ? "images" : "video",
      title,
      author: authorName,
      avatar: null,
      cover: cover ? { url: cover, referer: "https://www.tikwm.com/" } : null,
      duration: d.duration || 0,
      create_time: d.create_time || 0,
      media,
    };
  }

  async _viaPage(url) {
    const res = await this.session.fetch(url, { headers: TIKTOK_HEADER, redirect: "follow" });
    const text = await res.text();
    const m = text.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!m) throw new ParseError("TikTok 页面解析失败, 可重试或更换链接");
    const jsonStr = extractBalancedJson(m[1], 0) || m[1].trim();
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      throw new ParseError(`TikTok 数据解析失败: ${e.message}`);
    }
    const scope = data.__DEFAULT_SCOPE || {};
    const detail = scope["webapp.video-detail"] || {};
    const item = (detail.itemInfo || {}).itemStruct || {};
    if (!item) throw new ParseError("TikTok 未找到视频数据");
    const title = item.desc || "";
    const authorObj = item.author || {};
    const authorName = authorObj.nickname || "";
    const base = safeName(title || "tiktok");
    const media = [];
    let cover = null;
    const video = item.video || {};
    if (video) {
      const play = video.playAddr;
      cover = video.cover || video.originCover;
      if (play) {
        media.push({
          type: "video",
          url: play,
          referer: "https://www.tiktok.com/",
          filename: `${base}.mp4`,
        });
      }
    }
    const ip = item.imagePost || {};
    const imageList = ip.imageList || [];
    imageList.forEach((im, idx) => {
      const u = (im.imageDisplay || {}).url;
      if (u) {
        media.push({
          type: "image",
          url: u,
          referer: "https://www.tiktok.com/",
          filename: `${base}_${idx + 1}.jpeg`,
        });
      }
    });
    if (!media.length) throw new ParseError("TikTok 未找到可下载内容");
    const avatarUrl = (authorObj.avatar || {}).url;
    return {
      platform: "tiktok",
      type: ip && !video ? "images" : "video",
      title,
      author: authorName,
      avatar: avatarUrl ? { url: avatarUrl, referer: "https://www.tiktok.com/" } : null,
      cover: cover ? { url: cover, referer: "https://www.tiktok.com/" } : null,
      duration: Math.floor((video.duration || 0) / 1000),
      create_time: item.createTime || 0,
      media,
    };
  }
}

const PARSERS = { douyin: DouyinParser, tiktok: TikTokParser };

async function parseUrl(raw) {
  const platform = detectPlatform(raw);
  if (!platform) throw new ParseError("无法识别链接所属平台, 目前支持抖音与 TikTok");
  const Parser = PARSERS[platform];
  const parser = new Parser();
  try {
    return await parser.parse(raw);
  } finally {
    parser.session.close();
  }
}

/** 读取响应体，最多 maxBytes+1 字节；超出则 exceeded=true（用于检测不支持 Range 的大文件） */
async function readBodyCapped(res, maxBytes) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) {
    // 兜底：部分运行时无 stream reader
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, exceeded: buf.length > maxBytes };
  }
  const parts = [];
  let total = 0;
  let exceeded = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      exceeded = true;
      break;
    }
    parts.push(Buffer.from(value));
  }
  try {
    await reader.cancel();
  } catch {
    // 忽略
  }
  return { buf: Buffer.concat(parts), exceeded };
}

async function proxyMedia(event) {
  const { url, referer, range } = event || {};
  if (!url || !isAllowedMediaHost(url)) {
    return { ok: false, error: "不支持的媒体地址" };
  }
  const headers = { "User-Agent": COMMON_HEADER["User-Agent"] };
  if (referer) headers["Referer"] = referer;
  if (range) headers["Range"] = range;

  let res;
  try {
    res = await fetch(url, { headers, redirect: "follow" });
  } catch {
    return { ok: false, error: "请求媒体失败" };
  }
  if (res.status !== 200 && res.status !== 206) {
    return { ok: false, error: `媒体请求失败 (${res.status})` };
  }
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const contentRange = res.headers.get("content-range") || "";
  const contentLength = res.headers.get("content-length") || "";
  const acceptRangesHeader = res.headers.get("accept-ranges") || "";

  let totalSize = 0;
  let start = 0;
  let end = 0;
  const crMatch = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
  if (crMatch) {
    start = parseInt(crMatch[1], 10);
    end = parseInt(crMatch[2], 10);
    totalSize = parseInt(crMatch[3], 10);
  } else if (contentLength) {
    totalSize = parseInt(contentLength, 10) || 0;
    end = Math.max(totalSize - 1, 0);
  }
  const acceptRanges = !!(acceptRangesHeader && acceptRangesHeader !== "none") || !!contentRange;

  const { buf, exceeded } = await readBodyCapped(res, MAX_CHUNK);
  if (exceeded) {
    return {
      ok: false,
      error: "文件过大或不支持分块下载，请尝试单个图片或更换链接",
      tooLarge: true,
    };
  }
  return {
    ok: true,
    data: {
      base64: buf.toString("base64"),
      contentType,
      totalSize,
      acceptRanges,
      start,
      end,
    },
  };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || "";
  let uid = "";
  try {
    if (context && context.userInfo) uid = context.userInfo.uid || "";
  } catch {
    // 忽略
  }
  if (!uid && context && context.identifier) uid = context.identifier;

  const timer = withTiming("douyin-tool", uid);

  try {
    if (action === "parse") {
      const url = ((event && event.url) || "").trim();
      if (!url) {
        timer.end("error");
        return { ok: false, error: "请输入抖音 / TikTok 链接" };
      }
      try {
        const data = await parseUrl(url);
        timer.end("ok", { platform: data.platform, type: data.type });
        return { ok: true, data };
      } catch (e) {
        logError("douyin-tool:parse", uid, e);
        timer.end("error");
        const msg = e instanceof ParseError ? e.message : `解析异常: ${e.message || e}`;
        return { ok: false, error: msg };
      }
    }

    if (action === "media") {
      try {
        const result = await proxyMedia(event);
        timer.end(result.ok ? "ok" : "error");
        return result;
      } catch (e) {
        logError("douyin-tool:media", uid, e);
        timer.end("error");
        return { ok: false, error: e.message || "媒体代理失败" };
      }
    }

    timer.end("error");
    return { ok: false, error: "未知操作" };
  } catch (err) {
    logError("douyin-tool", uid, err);
    timer.end("error");
    return { ok: false, error: err.message || "服务器错误" };
  }
};

// 导出纯函数供测试
exports._internal = {
  safeName,
  firstUrl,
  detectPlatform,
  isAllowedMediaHost,
  extractBalancedJson,
  ParseError,
};
