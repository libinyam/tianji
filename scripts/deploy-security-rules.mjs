#!/usr/bin/env node
/**
 * 将 cloudbase-security-rules.json 中的安全规则应用到 CloudBase 环境
 *
 * 用法：
 *   node scripts/deploy-security-rules.mjs                    # 读取 .env 中的 ENV_ID
 *   node scripts/deploy-security-rules.mjs --envId xxx        # 指定环境 ID
 *   node scripts/deploy-security-rules.mjs --dry-run          # 只打印不执行
 *
 * 前置条件：
 *   - 安装 @cloudbase/manager-node（npm i -g @cloudbase/manager-node 或本地安装）
 *   - 设置环境变量 TCB_SECRET_ID 和 TCB_SECRET_KEY（管理端密钥，非前端 accessKey）
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
const envIdArg = args[args.indexOf("--envId") + 1];
const envId = envIdArg || process.env.CLOUDBASE_ENV_ID || process.env.VITE_CLOUDBASE_ENV_ID;

if (!envId) {
  console.error("错误：未指定环境 ID。用 --envId 参数或在 .env 中设置 VITE_CLOUDBASE_ENV_ID");
  process.exit(1);
}

const secretId = process.env.TCB_SECRET_ID;
const secretKey = process.env.TCB_SECRET_KEY;

if (!dryRun && (!secretId || !secretKey)) {
  console.error("错误：未设置 TCB_SECRET_ID / TCB_SECRET_KEY 环境变量");
  console.error("这是管理端密钥（非前端 accessKey），用于调用 CloudBase 管理端 API");
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

const { CloudBase } = await import("@cloudbase/manager-node");
const tcb = new CloudBase({ envId, secretId, secretKey });

let success = 0;
let failed = 0;

for (const [collectionName, config] of Object.entries(collections)) {
  try {
    if (config.permission === "PRIVATE") {
      await tcb.updateDatabaseCollectionACL(collectionName, false);
    } else {
      await tcb.updateDatabaseCollectionSecurityRules(collectionName, [
        {
          read: config.securityRule.read,
          write: config.securityRule.create,
          update: config.securityRule.update,
          delete: config.securityRule.delete,
        },
      ]);
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
