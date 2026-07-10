#!/usr/bin/env node
/**
 * 将 cloudbase-security-rules.json 中的安全规则应用到 CloudBase 环境
 *
 * 用法：
 *   node scripts/deploy-security-rules.mjs                    # 读取 .env 中的 ENV_ID
 *   node scripts/deploy-security-rules.mjs --envId xxx        # 指定环境 ID
 *   node scripts/deploy-security-rules.mjs --dry-run          # 只打印不执行
 *   node scripts/deploy-security-rules.mjs --envId xxx --dry-run
 *
 * 前置条件：
 *   - CloudBase CLI 已全局安装（npm i -g @cloudbase/cli）
 *   - 已通过 tcb login 登录
 *   - 或设置环境变量 TCB_SECRET_ID 和 TCB_SECRET_KEY
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_FILE = resolve(__dirname, "../cloudbase-security-rules.json");

function loadEnv() {
  try {
    const envContent = readFileSync(resolve(__dirname, "../.env"), "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^VITE_CLOUDBASE_ENV_ID=(.+)/);
      if (match) process.env.CLOUDBASE_ENV_ID = match[1].trim();
    }
  } catch {
    // .env 不存在，依赖环境变量
  }
}

loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envIdIndex = args.indexOf("--envId");
const envIdArg = envIdIndex !== -1 && envIdIndex + 1 < args.length ? args[envIdIndex + 1] : null;
const envId = envIdArg || process.env.CLOUDBASE_ENV_ID || process.env.VITE_CLOUDBASE_ENV_ID;

if (!envId) {
  console.error("错误：未指定环境 ID。用 --envId 参数或在 .env 中设置 VITE_CLOUDBASE_ENV_ID");
  process.exit(1);
}

const rules = JSON.parse(readFileSync(RULES_FILE, "utf-8"));
const collections = rules.collections;

console.log(`\n=== CloudBase 安全规则部署 ===`);
console.log(`环境 ID: ${envId}`);
console.log(`规则文件: ${RULES_FILE}`);
console.log(`版本: ${rules.version}`);
console.log(`集合数: ${Object.keys(collections).length}\n`);

if (dryRun) {
  console.log("（dry-run 模式，仅打印不执行）\n");
}

for (const [collectionName, config] of Object.entries(collections)) {
  const { permission, securityRule, note } = config;
  console.log(`[${collectionName}]`);
  console.log(`  permission: ${permission}`);
  if (securityRule) {
    console.log(`  read:   ${securityRule.read ?? "N/A"}`);
    console.log(`  create: ${securityRule.create ?? "N/A"}`);
    console.log(`  update: ${securityRule.update ?? "N/A"}`);
    console.log(`  delete: ${securityRule.delete ?? "N/A"}`);
  } else {
    console.log(`  securityRule: null (PRIVATE)`);
  }
  if (note) console.log(`  note: ${note}`);
  console.log();
}

if (dryRun) {
  console.log("dry-run 完成，未执行任何操作。");
  process.exit(0);
}

let success = 0;
let failed = 0;

for (const [collectionName, config] of Object.entries(collections)) {
  try {
    if (config.permission === "PRIVATE") {
      execSync(
        `tcb fn config modify db_acl ${collectionName} PRIVATE -e ${envId}`,
        { stdio: "pipe", encoding: "utf-8" }
      );
    } else {
      const ruleJson = JSON.stringify({
        read: config.securityRule.read,
        write: config.securityRule.create,
        update: config.securityRule.update,
        delete: config.securityRule.delete,
      });
      const escapedRule = ruleJson.replace(/"/g, '\\"');
      execSync(
        `tcb fn config modify db_rule ${collectionName} "${escapedRule}" -e ${envId}`,
        { stdio: "pipe", encoding: "utf-8" }
      );
    }
    console.log(`✅ ${collectionName} - 规则已应用`);
    success++;
  } catch (e) {
    console.error(`❌ ${collectionName} - 失败: ${e.message}`);
    failed++;
  }
}

console.log(`\n=== 部署完成 ===`);
console.log(`成功: ${success} / 失败: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
