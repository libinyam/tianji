import { describe, it, expect } from "vitest";
import { isAuthor } from "./utils";

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
