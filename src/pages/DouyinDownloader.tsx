import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Link2,
  ClipboardPaste,
  X,
  Download,
  Loader2,
  Film,
  AlertCircle,
  Check,
  Images,
  Package,
} from "lucide-react";
import PageHero from "@/components/PageHero";
import { useSEO } from "@/hooks/useSEO";
import {
  parseDouyinUrl,
  fetchMediaBlob,
  downloadBlob,
  formatDuration,
  formatCreateTime,
  formatBytes,
  type DouyinParseResult,
  type DouyinMediaItem,
} from "@/lib/douyin-tool";

type VideoState = "idle" | "loading" | "ready";

export default function DouyinDownloader() {
  useSEO({
    title: "抖音 / TikTok 无水印下载器",
    description: "粘贴抖音或 TikTok 分享链接，在线解析并下载无水印原画视频与图集。",
    canonical: "https://tianjihub.cn/tools/douyin",
  });

  const [url, setUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DouyinParseResult | null>(null);

  // 预览用 object URL（统一在重新解析/卸载时回收）
  const urlsRef = useRef<string[]>([]);
  const trackUrl = useCallback((u: string) => {
    urlsRef.current.push(u);
    return u;
  }, []);
  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);
  useEffect(() => () => revokeAll(), [revokeAll]);

  // 预览状态
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [videoProgress, setVideoProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [doneHint, setDoneHint] = useState<string | null>(null);

  const resetPreview = useCallback(() => {
    revokeAll();
    setAvatarUrl(null);
    setCoverUrl(null);
    setImageUrls([]);
    setVideoBlobUrl(null);
    setVideoBlob(null);
    setVideoState("idle");
    setVideoProgress(null);
  }, [revokeAll]);

  const doParse = async () => {
    const u = url.trim();
    if (!u) {
      setError("请先粘贴抖音 / TikTok 链接");
      return;
    }
    setParsing(true);
    setError(null);
    setResult(null);
    resetPreview();
    try {
      const data = await parseDouyinUrl(u);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败，请重试");
    } finally {
      setParsing(false);
    }
  };

  // 解析成功后预加载小图（头像/封面/图集缩略）
  useEffect(() => {
    if (!result) return;
    let cancelled = false;

    const loadSmall = async (
      target: { url: string; referer: string } | null,
      setter: (u: string) => void,
    ) => {
      if (!target) return;
      try {
        const { blob } = await fetchMediaBlob(target);
        if (cancelled) return;
        setter(trackUrl(URL.createObjectURL(blob)));
      } catch {
        // 预览失败不阻塞主流程
      }
    };

    loadSmall(result.avatar, setAvatarUrl);
    if (result.type === "video") loadSmall(result.cover, setCoverUrl);

    if (result.type === "images" || result.type === "slides") {
      const imgs = result.media.filter((m) => m.type === "image");
      const out: (string | null)[] = new Array(imgs.length).fill(null);
      setImageUrls(out);
      (async () => {
        for (let i = 0; i < imgs.length; i++) {
          try {
            const { blob } = await fetchMediaBlob(imgs[i]);
            if (cancelled) return;
            out[i] = trackUrl(URL.createObjectURL(blob));
            setImageUrls([...out]);
          } catch {
            // 单张失败跳过
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [result, trackUrl]);

  const videoItem = result?.media.find((m) => m.type === "video" || m.type === "dynamic") || null;
  const imageItems =
    result?.media.filter((m) => m.type === "image" || m.type === "dynamic") || [];

  const loadVideo = async () => {
    if (!videoItem) return;
    setVideoState("loading");
    setVideoProgress(null);
    try {
      const { blob } = await fetchMediaBlob(videoItem, (loaded, total) =>
        setVideoProgress({ loaded, total }),
      );
      const obj = trackUrl(URL.createObjectURL(blob));
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(obj);
      setVideoBlob(blob);
      setVideoState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "视频加载失败");
      setVideoState("idle");
    }
  };

  const downloadItem = async (item: DouyinMediaItem) => {
    try {
      const { blob } = await fetchMediaBlob(item);
      downloadBlob(blob, item.filename);
      setDoneHint(`已下载 ${item.filename}`);
      setTimeout(() => setDoneHint(null), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败");
    }
  };

  const downloadAll = async () => {
    if (!result || imageItems.length === 0) return;
    setDownloadingAll(true);
    let count = 0;
    for (const item of imageItems) {
      try {
        const { blob } = await fetchMediaBlob(item);
        downloadBlob(blob, item.filename);
        count++;
        await new Promise((r) => setTimeout(r, 600));
      } catch {
        // 单个失败继续
      }
    }
    setDownloadingAll(false);
    setDoneHint(`已触发 ${count} 个文件下载`);
    setTimeout(() => setDoneHint(null), 2400);
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setUrl(t.trim());
        setDoneHint("已粘贴");
        setTimeout(() => setDoneHint(null), 1500);
      }
    } catch {
      setError("无法读取剪贴板，请手动粘贴");
    }
  };

  const clearAll = () => {
    setUrl("");
    setResult(null);
    setError(null);
    resetPreview();
  };

  const platformLabel = result?.platform === "tiktok" ? "TikTok" : "抖音";
  const typeLabel = result
    ? { video: "视频", images: "图文", slides: "图集" }[result.type] || result.type
    : "";

  return (
    <>
      <PageHero
        eyebrow="TOOL · 无水印下载"
        title="抖音 / TikTok 无水印下载器"
        subtitle="粘贴分享链接，解析并下载无水印原画。视频经服务端分块代理，图集可逐个或批量下载。"
      >
        <div className="flex items-center gap-3">
          <Link
            to="/tools"
            className="inline-flex items-center gap-1 text-xs text-mist-400 transition-colors hover:text-tian-500"
          >
            <ArrowLeft size={13} /> 工具箱
          </Link>
          <span className="text-xs text-mist-500">仅用于个人学习与留存，请尊重原作者版权</span>
        </div>
      </PageHero>

      <section className="container-tj py-6">
        {/* 输入栏 */}
        <div className="rounded-lg border border-void-600 bg-void-800 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Link2
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doParse();
                }}
                placeholder="粘贴抖音 / TikTok 链接，例如 https://v.douyin.com/xxxxx"
                className="w-full rounded-md border border-void-600 bg-void-900 py-2.5 pl-9 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-tian-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={doParse}
                disabled={parsing}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm disabled:opacity-60"
              >
                {parsing ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                {parsing ? "解析中…" : "解析"}
              </button>
              <button
                onClick={paste}
                className="inline-flex items-center gap-1.5 rounded-md border border-void-600 bg-void-700 px-3 py-2.5 text-xs text-mist-300 transition-colors hover:text-parchment-100"
              >
                <ClipboardPaste size={13} /> 粘贴
              </button>
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-void-600 bg-void-700 px-3 py-2.5 text-xs text-mist-300 transition-colors hover:text-parchment-100"
              >
                <X size={13} /> 清空
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {doneHint && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-tian-500/30 bg-tian-500/10 px-3 py-2 text-xs text-tian-500">
              <Check size={14} /> {doneHint}
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-mist-500">
            支持：<span className="text-mist-400">v.douyin.com 短链</span> · 图文/图集(slides) ·{" "}
            <span className="text-mist-400">vm.tiktok.com 短链</span> · tiktok.com/@user。视频通过服务端分块代理下载，可保存原画。
          </p>
        </div>

        {/* 结果 */}
        {result && (
          <div className="mt-5 overflow-hidden rounded-lg border border-void-600 bg-void-800">
            {/* 头部 */}
            <div className="flex items-center gap-3 border-b border-void-600 p-4">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-void-700">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-parchment-50">
                    {result.author || "未知作者"}
                  </span>
                  <span className="shrink-0 rounded-full bg-tian-500/10 px-2 py-0.5 text-[10px] text-tian-500">
                    {platformLabel} · {typeLabel}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-mist-400">{result.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-mist-500">
                  {result.duration > 0 && <span>时长 {formatDuration(result.duration)}</span>}
                  {result.create_time > 0 && <span>{formatCreateTime(result.create_time)}</span>}
                  <span>共 {result.media.length} 个文件</span>
                </div>
              </div>
            </div>

            {/* 视频体 */}
            {videoItem && result.type === "video" && (
              <div className="p-4">
                {videoState === "ready" && videoBlobUrl ? (
                  <div className="overflow-hidden rounded-md bg-black">
                    <video
                      src={videoBlobUrl}
                      controls
                      preload="metadata"
                      poster={coverUrl || undefined}
                      className="max-h-[70vh] w-full"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-video overflow-hidden rounded-md bg-black">
                    {coverUrl && (
                      <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-80" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={loadVideo}
                        disabled={videoState === "loading"}
                        className="inline-flex items-center gap-1.5 rounded-md bg-tian-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-tian-600 disabled:opacity-60"
                      >
                        {videoState === "loading" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        {videoState === "loading" ? "加载中…" : "加载视频"}
                      </button>
                      {videoState === "loading" && videoProgress && (
                        <span className="text-[11px] text-mist-400">
                          {videoProgress.total > 0
                            ? `${formatBytes(videoProgress.loaded)} / ${formatBytes(videoProgress.total)}`
                            : `${formatBytes(videoProgress.loaded)}`}
                        </span>
                      )}
                      {videoState === "idle" && (
                        <span className="text-[11px] text-mist-500">点击加载原画视频以预览</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (videoBlob) {
                        downloadBlob(videoBlob, videoItem.filename);
                        setDoneHint(`已下载 ${videoItem.filename}`);
                        setTimeout(() => setDoneHint(null), 2200);
                      } else {
                        downloadItem(videoItem);
                      }
                    }}
                    className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
                  >
                    <Download size={13} /> 下载视频
                  </button>
                  {videoState === "ready" && videoBlobUrl && (
                    <a
                      href={videoBlobUrl}
                      download={videoItem.filename}
                      className="inline-flex items-center gap-1.5 rounded-md border border-void-600 bg-void-700 px-3.5 py-2 text-xs text-mist-300 transition-colors hover:text-parchment-100"
                    >
                      <Download size={13} /> 另存为
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* 图集体 */}
            {(result.type === "images" || result.type === "slides") && (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {imageItems.map((item, i) => (
                    <div
                      key={i}
                      className="group relative aspect-[3/4] overflow-hidden rounded-md border border-void-600 bg-void-900"
                    >
                      {imageUrls[i] ? (
                        <img
                          src={imageUrls[i]!}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-mist-500" />
                        </div>
                      )}
                      {item.type === "dynamic" && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-red-500/85 px-1.5 py-0.5 text-[10px] text-white">
                          动图
                        </span>
                      )}
                      <button
                        onClick={() => downloadItem(item)}
                        title="下载"
                        className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-md border border-void-600 bg-void-950/75 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {imageItems.length > 1 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={downloadAll}
                      disabled={downloadingAll}
                      className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs disabled:opacity-60"
                    >
                      {downloadingAll ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Package size={13} />
                      )}
                      {downloadingAll ? "下载中…" : `逐个下载全部 (${imageItems.length})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 空状态提示 */}
        {!result && !parsing && !error && (
          <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-void-600 py-12 text-center">
            <Images size={22} className="text-mist-500" />
            <p className="mt-3 text-sm text-mist-400">粘贴链接后点「解析」即可获取无水印原画</p>
          </div>
        )}
      </section>
    </>
  );
}
