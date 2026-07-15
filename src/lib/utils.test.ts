import { describe, it, expect } from "vitest";
import { isAuthor, friendlyErrorMessage } from "./utils";

describe("isAuthor", () => {
  it("当前用户是作者时返回 true", () => {
    expect(isAuthor("uid-123", "uid-123")).toBe(true);
  });

  it("当前用户不是作者时返回 false", () => {
    expect(isAuthor("uid-123", "uid-456")).toBe(false);
  });

  it("uid 为 null 时返回 false（#107 回归）", () => {
    expect(isAuthor(null, "uid-123")).toBe(false);
  });

  it("uid 为 undefined 时返回 false（#107 回归）", () => {
    expect(isAuthor(undefined, "uid-123")).toBe(false);
  });

  it("authorUid 为 undefined 时返回 false", () => {
    expect(isAuthor("uid-123", undefined)).toBe(false);
  });

  it("两者都为 undefined 时返回 false（#107 核心场景）", () => {
    expect(isAuthor(undefined, undefined)).toBe(false);
  });

  it("两者都为 null 时返回 false", () => {
    expect(isAuthor(null as unknown as string, null as unknown as string)).toBe(false);
  });

  it("两者都为空串时返回 false", () => {
    expect(isAuthor("", "")).toBe(false);
  });

  it("uid 为空串时返回 false", () => {
    expect(isAuthor("", "uid-123")).toBe(false);
  });

  it("authorUid 为空串时返回 false", () => {
    expect(isAuthor("uid-123", "")).toBe(false);
  });
});

describe("friendlyErrorMessage", () => {
  it("CloudBase 安全规则错误翻译成中文", () => {
    expect(friendlyErrorMessage(new Error("Permission denied by security rules"))).toBe(
      "操作失败：权限不足或登录已过期，请刷新后重试"
    );
  });

  it("大小写不敏感匹配", () => {
    expect(friendlyErrorMessage(new Error("PERMISSION DENIED"))).toBe(
      "操作失败：权限不足或登录已过期，请刷新后重试"
    );
  });

  it("非安全规则错误保持原样", () => {
    expect(friendlyErrorMessage(new Error("无权删除他人帖子"))).toBe("无权删除他人帖子");
    expect(friendlyErrorMessage(new Error("网络错误"))).toBe("网络错误");
  });

  it("非 Error 类型入参转为字符串", () => {
    expect(friendlyErrorMessage("some string")).toBe("some string");
    expect(friendlyErrorMessage(42)).toBe("42");
  });
});
