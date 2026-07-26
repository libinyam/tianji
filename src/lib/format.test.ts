import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime, formatDate } from "./format";

describe("formatDate（#427 自 Profile/UserProfile 下沉）", () => {
  it("格式化为 YYYY-MM-DD", () => {
    expect(formatDate("2026-07-26T08:30:00Z")).toMatch(/^2026-07-2[56]$/);
  });

  it("空串返回空串", () => {
    expect(formatDate("")).toBe("");
  });

  it("无效日期原样返回", () => {
    expect(formatDate("invalid-date")).toBe("invalid-date");
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("刚刚（秒级）", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    expect(formatRelativeTime("2026-07-10T11:59:50Z")).toBe("刚刚");
  });

  it("几分钟前", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    expect(formatRelativeTime("2026-07-10T11:57:00Z")).toBe("3分钟前");
  });

  it("几小时前", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    expect(formatRelativeTime("2026-07-10T09:00:00Z")).toBe("3小时前");
  });

  it("几天前", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    expect(formatRelativeTime("2026-07-08T12:00:00Z")).toBe("2天前");
  });

  it("超过 30 天显示完整日期", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    expect(formatRelativeTime("2026-05-01T00:00:00Z")).toBe("2026-05-01");
  });

  it("恰好 30 天显示日期", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    expect(formatRelativeTime("2026-06-10T12:00:00Z")).toBe("2026-06-10");
  });

  it("无效日期返回原字符串", () => {
    expect(formatRelativeTime("invalid-date")).toBe("invalid-date");
    expect(formatRelativeTime("not-a-date")).toBe("not-a-date");
  });

  it("ISO 字符串正常解析", () => {
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    const result = formatRelativeTime("2026-07-10T11:50:00Z");
    expect(result).toBe("10分钟前");
  });
});
