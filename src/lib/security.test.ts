import { describe, it, expect, beforeEach } from "vitest";
import { escapeHtml, RateLimiter } from "./security";

describe("escapeHtml", () => {
  it("正常文本不被修改", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
    expect(escapeHtml("数学公式 a<b")).toBe("数学公式 a&lt;b");
  });

  it("转义 < 和 >", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("<div>content</div>")).toBe("&lt;div&gt;content&lt;/div&gt;");
    expect(escapeHtml("a<b>c")).toBe("a&lt;b&gt;c");
  });

  it("转义引号", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("转义 &（必须先转义 &）", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("组合 XSS 攻击", () => {
    expect(escapeHtml('<img src="x" onerror="alert(1)">')).toBe(
      "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;"
    );
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    );
  });

  it("空字符串", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("代码泛型不被破坏（先转义）", () => {
    const result = escapeHtml("Array<T>");
    expect(result).toBe("Array&lt;T&gt;");
  });
});

describe("RateLimiter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("首次检查允许操作", () => {
    const limiter = new RateLimiter("test", 10);
    expect(limiter.check()).toEqual({ allowed: true, remaining: 0 });
  });

  it("冷却期内拒绝操作", () => {
    const limiter = new RateLimiter("test", 10);
    limiter.record();
    const result = limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.remaining).toBeLessThanOrEqual(10);
  });

  it("冷却期过后允许操作", () => {
    const limiter = new RateLimiter("test-fast", 0);
    limiter.record();
    const result = limiter.check();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("不同 key 互不影响", () => {
    const limiterA = new RateLimiter("key-a", 10);
    const limiterB = new RateLimiter("key-b", 10);
    limiterA.record();
    expect(limiterA.check().allowed).toBe(false);
    expect(limiterB.check().allowed).toBe(true);
  });

  it("record 更新时间戳", () => {
    const limiter = new RateLimiter("test", 10);
    limiter.record();
    const before = limiter.check().remaining;
    limiter.record();
    const after = limiter.check().remaining;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("remaining 是秒级", () => {
    const limiter = new RateLimiter("test", 30);
    limiter.record();
    const result = limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBeLessThanOrEqual(30);
    expect(result.remaining).toBeGreaterThan(20);
  });
});
