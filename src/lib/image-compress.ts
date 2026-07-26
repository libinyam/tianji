/**
 * #409 客户端图片压缩：上传前把手机原图（常见 3-4MB）压到适合网页展示的体积。
 * 腾讯云存储按流量计费，这同时是性能优化和成本优化。
 *
 * 设计原则：压缩是优化而非门槛——任何环节失败（旧浏览器缺 API、解码异常、
 * 压缩后反而更大）都静默回退原文件，绝不能阻断上传。
 * GIF（动图会被压成静帧）与 SVG 跳过压缩。
 */

const SKIP_TYPES = ["image/gif", "image/svg+xml"];

async function canvasToFile(
  canvas: HTMLCanvasElement,
  original: File,
  baseName: string,
  quality: number,
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  // 压缩无效（输出更大或失败）时用原图
  if (!blob || blob.size >= original.size) return original;
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

/** 帖子配图：最长边缩到 1600px、WebP 质量 0.85 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.includes(file.type)) return file;
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return await canvasToFile(canvas, file, baseName, quality);
  } catch {
    return file;
  }
}

/** 头像：居中裁剪正方形并缩放到 256×256（渲染位最大仅 96px，原图纯属浪费） */
export async function compressAvatar(file: File, size = 256): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.includes(file.type)) return file;
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const target = Math.min(size, side);
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target);
    bitmap.close();
    return await canvasToFile(canvas, file, "avatar", 0.85);
  } catch {
    return file;
  }
}

/** 从（可能已压缩的）文件取扩展名，供 cloudPath 使用；无扩展名/异常值用回退 */
export function fileExt(file: File, fallback = "jpg"): string {
  const idx = file.name.lastIndexOf(".");
  if (idx <= 0) return fallback;
  const ext = file.name.slice(idx + 1).toLowerCase();
  return ext && ext.length <= 5 ? ext : fallback;
}
