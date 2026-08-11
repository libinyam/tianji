import { describe, it, expect } from "vitest";
import { _internal } from "./index.js";

const { safeName, firstUrl, detectPlatform, isAllowedMediaHost, extractBalancedJson } = _internal;

describe("douyin-tool 纯函数", () => {
  it("safeName 去除非法字符并截断", () => {
    expect(safeName("hello/world?x")).toBe("hello_world_x");
    expect(safeName("   ")).toBe("media");
    expect(safeName("a".repeat(50))).toHaveLength(40);
  });

  it("firstUrl 从混合文本提取首个链接", () => {
    expect(firstUrl("看这个 https://v.douyin.com/abc123 哈哈")).toBe("https://v.douyin.com/abc123");
    expect(firstUrl("纯文本无链接")).toBe("纯文本无链接");
  });

  it("detectPlatform 识别抖音/TikTok", () => {
    expect(detectPlatform("https://v.douyin.com/xxx")).toBe("douyin");
    expect(detectPlatform("https://www.tiktok.com/@u/video/1")).toBe("tiktok");
    expect(detectPlatform("https://example.com")).toBe("");
  });

  it("isAllowedMediaHost 仅放行已知 CDN 域名", () => {
    expect(isAllowedMediaHost("https://v3-web.douyinvod.com/x.mp4")).toBe(true);
    expect(isAllowedMediaHost("https://p5-ex-gddgtc-sign.douyinpic.com/x.webp")).toBe(true);
    expect(isAllowedMediaHost("https://www.tikwm.com/x.mp4")).toBe(true);
    expect(isAllowedMediaHost("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedMediaHost("http://localhost:8080/secret")).toBe(false);
    expect(isAllowedMediaHost("https://evil.com/x.mp4")).toBe(false);
  });

  it("extractBalancedJson 提取首个平衡 JSON 对象", () => {
    const s = 'window._ROUTER_DATA = {"a":{"b":1},"c":[1,2]}; trailing;';
    const json = extractBalancedJson(s, s.indexOf("{"));
    expect(JSON.parse(json)).toEqual({ a: { b: 1 }, c: [1, 2] });
  });
});
