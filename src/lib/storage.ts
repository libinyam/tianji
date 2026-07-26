import { app } from "@/lib/cloudbase";

export async function uploadFile(cloudPath: string, filePath: string): Promise<string> {
  const res = await app.uploadFile({ cloudPath, filePath });
  return res.fileID;
}

const TEMP_URL_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

// #424 微批合并：CloudBase API 本身接受 fileList 数组，但每个 CloudImage 组件
// 独立调用本函数——一篇含 8 张图的帖子会发 8 个兑换请求。把同一个 50ms 窗口内
// 的请求合并为一次批量调用再分发结果，调用方无需改动。
type PendingResolve = { resolve: (url: string) => void };
let pendingBatch: Map<string, PendingResolve[]> | null = null;

export function getTempFileURL(fileID: string): Promise<string> {
  return new Promise((resolve) => {
    if (!pendingBatch) {
      pendingBatch = new Map();
      setTimeout(() => {
        const batch = pendingBatch!;
        pendingBatch = null;
        void app
          .getTempFileURL({
            fileList: Array.from(batch.keys()).map((id) => ({ fileID: id, maxAge: TEMP_URL_MAX_AGE })),
          })
          .then((res: { fileList?: { fileID: string; tempFileURL?: string }[] }) => {
            const urlById = new Map(
              (res?.fileList ?? []).map((f) => [f.fileID, f.tempFileURL ?? ""])
            );
            for (const [id, waiters] of batch) {
              const url = urlById.get(id) ?? "";
              for (const w of waiters) w.resolve(url);
            }
          })
          .catch(() => {
            // 与旧实现一致：失败返回空串，由调用方（CloudImage）显示占位
            for (const waiters of batch.values()) {
              for (const w of waiters) w.resolve("");
            }
          });
      }, 50);
    }
    const waiters = pendingBatch.get(fileID) ?? [];
    waiters.push({ resolve });
    pendingBatch.set(fileID, waiters);
  });
}

export async function deleteFile(fileID: string): Promise<void> {
  await app.deleteFile({ fileList: [fileID] });
}
