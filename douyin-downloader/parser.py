"""抖音 / TikTok 无水印解析核心模块

参考实现: https://github.com/Zhalslar/astrbot_plugin_parser
核心思路:
  抖音视频/图文 -> iesdouyin 分享页内嵌 window._ROUTER_DATA, 取 play_addr 无水印地址
  抖音图集(slides) -> iesdouyin slidesinfo 接口
  TikTok -> tikwm 接口优先, 页面 __UNIVERSAL_DATA_FOR_REHYDRATION__ 兜底
"""
from __future__ import annotations

import json
import re
from urllib.parse import parse_qs, urlparse

import requests


COMMON_HEADER = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}

IOS_HEADER = {
    **COMMON_HEADER,
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
        "Mobile/15E148 Safari/604.1"
    ),
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}

ANDROID_HEADER = {
    **COMMON_HEADER,
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 "
        "Mobile Safari/537.36"
    ),
}

TIKTOK_HEADER = {
    **COMMON_HEADER,
    "Origin": "https://www.tiktok.com",
    "Referer": "https://www.tiktok.com/",
}

TTWID_REGISTER_URL = "https://ttwid.bytedance.com/ttwid/union/register/"
PLAY_RATIOS = ("1080p", "720p", "540p", "360p")

_URL_RE = re.compile(r"https?://[^\s，。、）)】\]]+")
_BAD_CHARS = re.compile(r'[\\/:*?"<>|\r\n\t]')


class ParseError(Exception):
    """解析失败"""


def safe_name(s: str, maxlen: int = 40) -> str:
    s = _BAD_CHARS.sub("_", s or "")
    s = s.strip(" ._-")
    return (s or "media")[:maxlen]


def first_url(text: str) -> str:
    text = (text or "").strip()
    m = _URL_RE.search(text)
    return m.group(0) if m else text


class _Base:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(COMMON_HEADER)

    def _close(self) -> None:
        try:
            self.session.close()
        except Exception:
            pass

    @staticmethod
    def _pick(url_list, idx: int = 0):
        if url_list:
            return url_list[idx] if idx < len(url_list) else url_list[0]
        return None


class DouyinParser(_Base):
    """抖音解析器"""

    PATTERNS = [
        (re.compile(r"v\.douyin\.com/[A-Za-z0-9_\-]+"), "short"),
        (re.compile(r"jx\.douyin\.com/[A-Za-z0-9_\-]+"), "short"),
        (re.compile(r"iesdouyin\.com/share/(?P<ty>slides|video|note)/(?P<vid>\d+)"), "typed"),
        (re.compile(r"m\.douyin\.com/share/(?P<ty>slides|video|note)/(?P<vid>\d+)"), "typed"),
        (re.compile(r"jingxuan\.douyin\.com/m/(?P<ty>slides|video|note)/(?P<vid>\d+)"), "typed"),
        (re.compile(r"douyin\.com/(?P<ty>video|note)/(?P<vid>\d+)"), "typed"),
        (re.compile(r"aweme_id[=:/\s]+(?P<vid>\d{10,})"), "vid"),
        (re.compile(r"aweme/(?P<vid>\d{10,})"), "vid"),
    ]

    def parse(self, raw: str) -> dict:
        url = first_url(raw)
        kind, m = self._match(url)
        if kind == "short":
            real = self._resolve_short("https://" + m.group(0))
            return self.parse(real)
        if kind == "vid":
            return self._parse_video(m.group("vid"), "video")
        ty = m.groupdict().get("ty") or "video"
        vid = m.group("vid")
        if ty == "slides":
            return self._parse_slides(vid)
        return self._parse_video(vid, ty)

    def _match(self, url: str):
        for pat, kind in self.PATTERNS:
            if m := pat.search(url):
                return kind, m
        if re.fullmatch(r"\d{18,20}", url.strip()):
            return "vid", type("M", (), {"group": lambda self, name="vid": url.strip()})()
        raise ParseError("无法识别的抖音链接")

    def _resolve_short(self, url: str) -> str:
        resp = self.session.get(url, headers=IOS_HEADER, allow_redirects=True, timeout=20)
        final = resp.url
        host = urlparse(final).hostname or ""
        if "douyin" in host or "iesdouyin" in host:
            return final
        raise ParseError("短链解析失败")

    def _has_ttwid(self) -> bool:
        return any(c.name == "ttwid" and c.value for c in self.session.cookies)

    def _ensure_ttwid(self) -> None:
        if self._has_ttwid():
            return
        headers = IOS_HEADER.copy()
        headers.update(
            {"Content-Type": "application/json", "Referer": "https://www.iesdouyin.com/"}
        )
        payload = {
            "region": "cn",
            "aid": 1768,
            "needFid": False,
            "service": "www.iesdouyin.com",
            "union": True,
            "fid": "",
        }
        resp = self.session.post(
            TTWID_REGISTER_URL, json=payload, headers=headers, timeout=15
        )
        try:
            body = resp.json()
        except ValueError:
            body = {}
        if isinstance(body, dict) and body.get("redirect_url"):
            cb = body["redirect_url"]
            cb_headers = IOS_HEADER.copy()
            cb_headers["Referer"] = "https://www.iesdouyin.com/"
            try:
                self.session.get(cb, headers=cb_headers, allow_redirects=False, timeout=15)
            except requests.RequestException:
                pass
        if not self._has_ttwid():
            raise ParseError("获取 ttwid 凭证失败")

    def _parse_video(self, vid: str, ty: str) -> dict:
        self._ensure_ttwid()
        share_url = f"https://www.iesdouyin.com/share/{ty}/{vid}/"
        headers = IOS_HEADER.copy()
        resp = self.session.get(share_url, headers=headers, allow_redirects=False, timeout=20)
        if resp.status_code != 200:
            raise ParseError(f"分享页请求失败: HTTP {resp.status_code}")
        text = resp.text
        m = re.search(r"window\._ROUTER_DATA\s*=\s*(.*?)</script>", text, re.DOTALL)
        if not m:
            raise ParseError("未在页面中找到 _ROUTER_DATA")
        raw = m.group(1).strip()
        brace = raw.find("{")
        if brace < 0:
            raise ParseError("_ROUTER_DATA 解析失败")
        try:
            data, _ = json.JSONDecoder().raw_decode(raw[brace:])
        except json.JSONDecodeError as e:
            raise ParseError(f"_ROUTER_DATA JSON 解析失败: {e}") from e

        page = self._find_page(data)
        if not page:
            raise ParseError("未找到 loaderData 中的页面数据")
        item_list = page.get("videoInfoRes", {}).get("item_list") or []
        if not item_list:
            raise ParseError("该内容可能已被删除或不可访问")
        item = item_list[0]

        title = item.get("desc", "") or ""
        author_obj = item.get("author") or {}
        author_name = author_obj.get("nickname", "")
        create_time = item.get("create_time", 0)
        video = item.get("video") or {}
        images = item.get("images") or []

        cover_url = self._pick((video.get("cover") or {}).get("url_list"))
        avatar_url = (
            self._pick((author_obj.get("avatar_medium") or {}).get("url_list"))
            or self._pick((author_obj.get("avatar_thumb") or {}).get("url_list"))
        )
        base = safe_name(title or vid)

        media: list[dict] = []
        if images:
            for idx, img in enumerate(images, 1):
                u = self._pick(img.get("url_list"))
                if u:
                    media.append(
                        {
                            "type": "image",
                            "url": u,
                            "referer": share_url,
                            "filename": f"{base}_{idx}.jpeg",
                        }
                    )
            mtype = "images"
        elif video:
            play_addr = video.get("play_addr") or {}
            url_list = play_addr.get("url_list") or []
            video_url = self._probe_best(play_addr, share_url)
            if not video_url and url_list:
                video_url = url_list[0].replace("playwm", "play")
            if video_url:
                media.append(
                    {
                        "type": "video",
                        "url": video_url,
                        "referer": share_url,
                        "filename": f"{base}.mp4",
                    }
                )
            mtype = "video"
        else:
            raise ParseError("未找到可下载的视频或图片")

        return {
            "platform": "douyin",
            "type": mtype,
            "title": title,
            "author": author_name,
            "avatar": {"url": avatar_url, "referer": share_url} if avatar_url else None,
            "cover": {"url": cover_url, "referer": share_url} if cover_url else None,
            "duration": (video.get("duration") or 0) // 1000 if video else 0,
            "create_time": create_time,
            "media": media,
        }

    @staticmethod
    def _find_page(data: dict):
        loader = data.get("loaderData") or {}
        if not isinstance(loader, dict):
            return None
        for v in loader.values():
            if isinstance(v, dict) and "videoInfoRes" in v:
                return v
        return None

    def _probe_best(self, play_addr: dict, referer: str) -> str | None:
        token = play_addr.get("uri")
        if not token:
            for u in play_addr.get("url_list") or []:
                q = parse_qs(urlparse(u).query)
                if q.get("video_id"):
                    token = q["video_id"][0]
                    break
        if not token:
            return None
        best: tuple[int, str] | None = None
        headers = IOS_HEADER.copy()
        headers.pop("Cookie", None)
        headers["Referer"] = referer
        headers["Range"] = "bytes=0-1"
        for ratio in PLAY_RATIOS:
            play_url = f"https://aweme.snssdk.com/aweme/v1/play/?video_id={token}&ratio={ratio}"
            try:
                r = self.session.get(
                    play_url, headers=headers, allow_redirects=True, timeout=15
                )
            except requests.RequestException:
                continue
            if r.status_code >= 400:
                continue
            size = self._resp_size(r.headers)
            if size <= 0:
                continue
            if not best or size > best[0]:
                best = (size, str(r.url))
        return best[1] if best else None

    @staticmethod
    def _resp_size(headers) -> int:
        if cr := headers.get("Content-Range"):
            if mt := re.search(r"/(\d+)\s*$", cr):
                return int(mt.group(1))
        if cl := headers.get("Content-Length"):
            try:
                return int(cl)
            except ValueError:
                return 0
        return 0

    def _parse_slides(self, vid: str) -> dict:
        api = "https://www.iesdouyin.com/web/api/v2/aweme/slidesinfo/"
        params = {"aweme_ids": f"[{vid}]", "request_source": "200"}
        resp = self.session.get(
            api, params=params, headers=ANDROID_HEADER, timeout=20
        )
        if resp.status_code != 200:
            raise ParseError(f"图集接口请求失败: HTTP {resp.status_code}")
        try:
            data = resp.json()
        except ValueError as e:
            raise ParseError(f"图集数据解析失败: {e}") from e
        details = data.get("aweme_details") or []
        if not details:
            raise ParseError("图集数据为空, 可能已被删除")
        d = details[0]
        author_obj = d.get("author") or {}
        title = d.get("desc", "") or ""
        images = d.get("images") or []
        referer = f"https://www.iesdouyin.com/share/slides/{vid}/"
        base = safe_name(title or vid)
        media: list[dict] = []
        for idx, img in enumerate(images, 1):
            u = self._pick(img.get("url_list"))
            if u:
                media.append(
                    {
                        "type": "image",
                        "url": u,
                        "referer": referer,
                        "filename": f"{base}_{idx}.jpeg",
                    }
                )
            v = img.get("video")
            if v:
                pa = v.get("play_addr") or {}
                vu = self._pick(pa.get("url_list"))
                if vu:
                    media.append(
                        {
                            "type": "dynamic",
                            "url": vu.replace("playwm", "play"),
                            "referer": referer,
                            "filename": f"{base}_{idx}.mp4",
                        }
                    )
        cover = self._pick(images[0].get("url_list")) if images else None
        avatar_url = self._pick((author_obj.get("avatar_thumb") or {}).get("url_list"))
        return {
            "platform": "douyin",
            "type": "slides",
            "title": title,
            "author": author_obj.get("nickname", ""),
            "avatar": {"url": avatar_url, "referer": referer} if avatar_url else None,
            "cover": {"url": cover, "referer": referer} if cover else None,
            "duration": 0,
            "create_time": d.get("create_time", 0),
            "media": media,
        }


class TikTokParser(_Base):
    """TikTok 解析器: tikwm 接口优先, 直采兜底"""

    def parse(self, raw: str) -> dict:
        url = first_url(raw)
        if re.search(r"(vt|vm|vt\.|vm\.)tiktok\.com/", url) or re.match(r"https?://(vt|vm)\.tiktok\.com", url):
            url = self._resolve_short(url)
        result = self._via_tikwm(url)
        if result:
            return result
        return self._via_page(url)

    def _resolve_short(self, url: str) -> str:
        if not url.startswith("http"):
            url = "https://" + url
        resp = self.session.get(url, headers=TIKTOK_HEADER, allow_redirects=True, timeout=20)
        host = urlparse(resp.url).hostname or ""
        if "tiktok" in host:
            return resp.url
        raise ParseError("TikTok 短链解析失败")

    def _via_tikwm(self, url: str) -> dict | None:
        try:
            r = self.session.get(
                "https://www.tikwm.com/api/",
                params={"url": url},
                headers={"User-Agent": COMMON_HEADER["User-Agent"]},
                timeout=20,
            )
            data = r.json()
        except (requests.RequestException, ValueError):
            return None
        if data.get("code") != 0:
            return None
        d = data.get("data") or {}
        title = d.get("title", "") or ""
        author_obj = d.get("author") or {}
        author_name = author_obj.get("nickname", "")
        cover = d.get("cover") or d.get("origin_cover")
        base = safe_name(title or "tiktok")
        media: list[dict] = []
        images = d.get("images") or []
        play = d.get("play")
        if play:
            if play.startswith("/"):
                play = "https://www.tikwm.com" + play
            media.append(
                {
                    "type": "video",
                    "url": play,
                    "referer": "https://www.tikwm.com/",
                    "filename": f"{base}.mp4",
                }
            )
        for idx, img in enumerate(images, 1):
            if isinstance(img, str):
                u = img
            elif isinstance(img, dict):
                u = img.get("url") or img.get("imageDisplay")
            else:
                u = None
            if u:
                media.append(
                    {
                        "type": "image",
                        "url": u,
                        "referer": "https://www.tikwm.com/",
                        "filename": f"{base}_{idx}.jpeg",
                    }
                )
        if not media:
            return None
        return {
            "platform": "tiktok",
            "type": "images" if images and not play else "video",
            "title": title,
            "author": author_name,
            "avatar": None,
            "cover": {"url": cover, "referer": "https://www.tikwm.com/"} if cover else None,
            "duration": d.get("duration", 0) or 0,
            "create_time": d.get("create_time", 0) or 0,
            "media": media,
        }

    def _via_page(self, url: str) -> dict:
        resp = self.session.get(url, headers=TIKTOK_HEADER, timeout=20)
        m = re.search(
            r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
            resp.text,
            re.DOTALL,
        )
        if not m:
            raise ParseError("TikTok 页面解析失败, 可重试或更换链接")
        try:
            data = json.loads(m.group(1).strip())
        except json.JSONDecodeError as e:
            raise ParseError(f"TikTok 数据解析失败: {e}") from e
        scope = data.get("__DEFAULT_SCOPE", {})
        detail = scope.get("webapp.video-detail") or {}
        item = (detail.get("itemInfo") or {}).get("itemStruct") or {}
        if not item:
            raise ParseError("TikTok 未找到视频数据")
        title = item.get("desc", "") or ""
        author_obj = item.get("author") or {}
        author_name = author_obj.get("nickname", "")
        base = safe_name(title or "tiktok")
        media: list[dict] = []
        cover = None
        video = item.get("video") or {}
        if video:
            play = video.get("playAddr")
            cover = video.get("cover") or video.get("originCover")
            if play:
                media.append(
                    {
                        "type": "video",
                        "url": play,
                        "referer": "https://www.tiktok.com/",
                        "filename": f"{base}.mp4",
                    }
                )
        ip = item.get("imagePost") or {}
        for idx, im in enumerate(ip.get("imageList") or [], 1):
            u = (im.get("imageDisplay") or {}).get("url")
            if u:
                media.append(
                    {
                        "type": "image",
                        "url": u,
                        "referer": "https://www.tiktok.com/",
                        "filename": f"{base}_{idx}.jpeg",
                    }
                )
        if not media:
            raise ParseError("TikTok 未找到可下载内容")
        avatar_url = (author_obj.get("avatar") or {}).get("url")
        return {
            "platform": "tiktok",
            "type": "images" if ip and not video else "video",
            "title": title,
            "author": author_name,
            "avatar": {"url": avatar_url, "referer": "https://www.tiktok.com/"} if avatar_url else None,
            "cover": {"url": cover, "referer": "https://www.tiktok.com/"} if cover else None,
            "duration": (video.get("duration") or 0) // 1000,
            "create_time": item.get("createTime", 0) or 0,
            "media": media,
        }


_PARSERS = {
    "douyin": DouyinParser,
    "tiktok": TikTokParser,
}


def detect_platform(url: str) -> str:
    u = first_url(url).lower()
    if "douyin" in u or "iesdouyin" in u:
        return "douyin"
    if "tiktok" in u:
        return "tiktok"
    return ""


def parse_url(raw: str) -> dict:
    """对外入口: 自动识别平台并解析"""
    platform = detect_platform(raw)
    if not platform:
        raise ParseError("无法识别链接所属平台, 目前支持抖音与 TikTok")
    parser = _PARSERS[platform]()
    try:
        return parser.parse(raw)
    finally:
        parser._close()
