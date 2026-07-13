import { app } from "@/lib/cloudbase";

export async function uploadFile(cloudPath: string, filePath: string): Promise<string> {
  const res = await app.uploadFile({ cloudPath, filePath });
  return res.fileID;
}

export async function getTempFileURL(fileID: string): Promise<string> {
  const res = await app.getTempFileURL({
    fileList: [{ fileID, maxAge: 365 * 24 * 60 * 60 * 1000 }],
  });
  return res?.fileList?.[0]?.tempFileURL ?? "";
}

export async function deleteFile(fileID: string): Promise<void> {
  await app.deleteFile({ fileList: [fileID] });
}
