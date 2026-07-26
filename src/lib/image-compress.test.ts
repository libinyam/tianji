import { describe, it, expect } from "vitest";
import { compressImage, compressAvatar, fileExt } from "./image-compress";

// #409 canvas/createImageBitmap 在 node 环境不可用，压缩函数应静默回退原文件
// （回退路径正是生产环境旧浏览器的行为，值得测试）；fileExt 为纯函数直接测。

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("compressImage 回退行为", () => {
  it("GIF 跳过压缩返回原文件", async () => {
    const f = makeFile("a.gif", "image/gif");
    expect(await compressImage(f)).toBe(f);
  });

  it("SVG 跳过压缩返回原文件", async () => {
    const f = makeFile("a.svg", "image/svg+xml");
    expect(await compressImage(f)).toBe(f);
  });

  it("非图片类型返回原文件", async () => {
    const f = makeFile("a.pdf", "application/pdf");
    expect(await compressImage(f)).toBe(f);
  });

  it("环境缺少 createImageBitmap 时返回原文件", async () => {
    const f = makeFile("a.png", "image/png");
    expect(await compressImage(f)).toBe(f);
  });
});

describe("compressAvatar 回退行为", () => {
  it("环境缺少 createImageBitmap 时返回原文件", async () => {
    const f = makeFile("a.jpg", "image/jpeg");
    expect(await compressAvatar(f)).toBe(f);
  });
});

describe("fileExt", () => {
  it("取小写扩展名", () => {
    expect(fileExt(makeFile("Photo.JPG", "image/jpeg"))).toBe("jpg");
    expect(fileExt(makeFile("a.webp", "image/webp"))).toBe("webp");
  });

  it("无扩展名或异常长时用回退值", () => {
    expect(fileExt(makeFile("noext", "image/png"), "png")).toBe("png");
    expect(fileExt(makeFile("a.superlongext", "image/png"), "jpg")).toBe("jpg");
  });
});
