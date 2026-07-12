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

const DANGEROUS_UPDATE_PATTERNS = [
  "auth.uid != null",
];

const CONTENT_COLLECTIONS = ["posts", "ideas", "books", "workshops"];

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

  it("users_v2 的 update 规则禁止客户端修改敏感字段 (#208)", () => {
    const config = rules.collections.users_v2;
    expect(config, "users_v2 不在规则中").toBeDefined();
    if (config.securityRule) {
      expect(config.securityRule.update, "users_v2 update 不应为客户端开放").toBe(false);
    }
  });

  it("内容集合的 update 规则不能是裸 auth.uid != null (#209)", () => {
    for (const name of CONTENT_COLLECTIONS) {
      const config = rules.collections[name];
      expect(config, `${name} 不在规则中`).toBeDefined();
      if (config.securityRule) {
        const updateRule = config.securityRule.update;
        if (typeof updateRule === "string") {
          for (const pattern of DANGEROUS_UPDATE_PATTERNS) {
            expect(updateRule, `${name}.update 是危险的宽权限: ${pattern}`).not.toBe(pattern);
          }
        }
      }
    }
  });
});
