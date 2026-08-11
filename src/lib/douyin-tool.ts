import { callCloudFunction } from "@/lib/cloudbase";

/** 解析后的单个媒体条目 */
export interface DouyinMediaItem {
  type: "video" | "image" | "dynamic";
  url: string;
  referer?: string;
  filename: string;
}

/** 解析结果 */
export interface DouyinParseResult {
  platform: "douyin" | "tiktok";
  type: "video" | "images" | "slides";
  title: string;
  author: string;
  avatar: { url: string; referer: string } | null;
  cover: { url: string; referer: string } | null;
  duration: number;
  create_time: number;
  media: DouyinMediaItem[];
}

interface MediaChunk {
  base64: string;
  contentType: string;
  totalSize: number;
  acceptRanges: boolean;
  start: number;
  end: number;
}

// 单个分块大小，与服务端 MAX_CHUNK 保持一致（2MB）
const CHUNK_SIZE = 2 * 1024 * 1024;

/** 调用云函数解析抖音 / TikTok 链接 */
export async function parseDouyinUrl(url: string): Promise<DouyinParseResult> {
  return callCloudFunction<DouyinParseResult>(
    "douyin-tool",
    { action: "parse", url },
    "解析失败，请重试",
  );
}

/** base64 字符串 -> Uint8Array（浏览器 atob） */
function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * 通过云函数分块代理下载媒体，拼装为 Blob。
 * 服务端带上正确 Referer 绕过防盗链，前端分块以绕过 callFunction 返回大小限制。
 * @param onProgress (loadedBytes, totalBytes) 进度回调
 */
export async function fetchMediaBlob(
  item: { url: string; referer?: string },
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ blob: Blob; contentType: string }> {
  const first = await callCloudFunction<MediaChunk>(
    "douyin-tool",
    { action: "media", url: item.url, referer: item.referer, range: `bytes=0-${CHUNK_SIZE - 1}` },
    "下载失败",
  );

  const firstBytes = base64ToUint8(first.base64);
  const contentType = first.contentType || "application/octet-stream";
  const total = first.totalSize && first.totalSize > 0 ? first.totalSize : firstBytes.length;

  const parts: Uint8Array[] = [firstBytes];
  let loaded = firstBytes.length;
  onProgress?.(loaded, total);

  if (first.acceptRanges && total > loaded) {
    let start = loaded;
    while (start < total) {
      const end = Math.min(start + CHUNK_SIZE - 1, total - 1);
      const chunk = await callCloudFunction<MediaChunk>(
        "douyin-tool",
        { action: "media", url: item.url, referer: item.referer, range: `bytes=${start}-${end}` },
        "下载失败",
      );
      parts.push(base64ToUint8(chunk.base64));
      start = end + 1;
      loaded = start;
      onProgress?.(loaded, total);
    }
  } else if (total > firstBytes.length) {
    // 不支持分块且首块不完整：无法可靠取回完整文件
    throw new Error("文件过大或不支持分块下载，请尝试单个图片或更换链接");
  }

  return { blob: new Blob(parts, { type: contentType }), contentType };
}

/** 触发浏览器下载一个 Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

/** 格式化时长 mm:ss */
export function formatDuration(s: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** 格式化时间戳 */
export function formatCreateTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { hour12: false });
}

/** 友好体积显示 */
export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
