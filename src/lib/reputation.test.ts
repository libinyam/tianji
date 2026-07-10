import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/cloudbase", () => ({
  app: { database: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: [] }) }) }) }) },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: () => ({ user: { uid: "" } }) },
}));

import { calculateLevel, getBadges, REPUTATION_RULES } from "./reputation";

describe("calculateLevel", () => {
  it("0 声望为初学者", () => {
    expect(calculateLevel(0)).toEqual({ level: 1, levelName: "初学者" });
  });
  it("50 声望为探索者", () => {
    expect(calculateLevel(50)).toEqual({ level: 2, levelName: "探索者" });
  });
  it("200 声望为引路人", () => {
    expect(calculateLevel(200)).toEqual({ level: 3, levelName: "引路人" });
  });
  it("500 声望为智者", () => {
    expect(calculateLevel(500)).toEqual({ level: 4, levelName: "智者" });
  });
  it("1000 声望为北辰", () => {
    expect(calculateLevel(1000)).toEqual({ level: 5, levelName: "北辰" });
  });
  it("499 声望仍为引路人", () => {
    expect(calculateLevel(499)).toEqual({ level: 3, levelName: "引路人" });
  });
});

describe("getBadges", () => {
  it("0 声望无徽章", () => {
    expect(getBadges(0)).toEqual([]);
  });
  it("50 声望有贡献者徽章", () => {
    expect(getBadges(50)).toEqual(["贡献者"]);
  });
  it("1000 声望有全部徽章", () => {
    expect(getBadges(1000)).toEqual(["贡献者", "解答者", "精选作者", "灵感大师"]);
  });
});

describe("REPUTATION_RULES", () => {
  it("发帖+2", () => {
    expect(REPUTATION_RULES.createPost).toBe(2);
  });
  it("回答被采纳+15", () => {
    expect(REPUTATION_RULES.answerAccepted).toBe(15);
  });
});
