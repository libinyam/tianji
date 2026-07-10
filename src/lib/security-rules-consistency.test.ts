import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_FILE = resolve(__dirname, "../../cloudbase-security-rules.json");

interface SecurityRule {
  read?: string | boolean;
  create?: string | boolean;
  update?: string | boolean;
  delete?: string | boolean;
}

interface CollectionConfig {
  permission: string;
  securityRule: SecurityRule | null;
  note?: string;
  ownerField?: string;
}

interface RulesFile {
  version: string;
  collections: Record<string, CollectionConfig>;
}

const rules: RulesFile = JSON.parse(readFileSync(RULES_FILE, "utf-8"));

describe("安全规则 × 客户端写路径一致性 (#207)", () => {
  it("安全规则文件存在且可解析", () => {
    expect(rules).toBeDefined();
    expect(rules.collections).toBeDefined();
    expect(Object.keys(rules.collections).length).toBeGreaterThan(0);
  });

  it("每个集合都有 permission 字段", () => {
    for (const [name, config] of Object.entries(rules.collections)) {
      expect(config.permission, `${name} 缺少 permission`).toBeDefined();
    }
  });

  it("非 PRIVATE 集合都有 securityRule", () => {
    for (const [name, config] of Object.entries(rules.collections)) {
      if (config.permission !== "PRIVATE") {
        expect(config.securityRule, `${name} 非 PRIVATE 但缺少 securityRule`).toBeDefined();
      }
    }
  });

  it("users_v2 集合必须在规则中 (#199)", () => {
    expect(rules.collections.users_v2, "users_v2 不在安全规则中").toBeDefined();
  });

  it("_backups 集合必须设为 PRIVATE (#199)", () => {
    const backupConfig = rules.collections._backups;
    expect(backupConfig, "_backups 不在安全规则中").toBeDefined();
    expect(backupConfig.permission, "_backups 必须设为 PRIVATE").toBe("PRIVATE");
  });

  it("notifications 的 create 规则允许客户端创建", () => {
    const notifConfig = rules.collections.notifications;
    expect(notifConfig, "notifications 不在规则中").toBeDefined();
    if (notifConfig.securityRule) {
      const createRule = notifConfig.securityRule.create;
      expect(createRule).not.toBe(false);
    }
  });

  it("posts 的 update 规则允许非作者写（回答/评论/投票/浏览量）", () => {
    const postsConfig = rules.collections.posts;
    expect(postsConfig, "posts 不在规则中").toBeDefined();
    if (postsConfig.securityRule) {
      const updateRule = postsConfig.securityRule.update;
      expect(updateRule).not.toBe("doc.authorUid == auth.uid");
    }
  });
});
