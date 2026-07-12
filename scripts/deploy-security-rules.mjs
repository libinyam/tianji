#!/usr/bin/env node
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
  } catch {}
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
  for (const [name, config] of Object.entries(collections)) {
    console.log(`[${name}] permission=${config.permission}`);
    if (config.securityRule) {
      console.log(`  read:   ${config.securityRule.read ?? "N/A"}`);
      console.log(`  create: ${config.securityRule.create ?? "N/A"}`);
      console.log(`  update: ${config.securityRule.update ?? "N/A"}`);
      console.log(`  delete: ${config.securityRule.delete ?? "N/A"}`);
    } else {
      console.log(`  PRIVATE`);
    }
  }
  console.log("\ndry-run 完成，未执行任何操作。");
  process.exit(0);
}

const secretId = process.env.TCB_SECRET_ID;
const secretKey = process.env.TCB_SECRET_KEY;

if (!secretId || !secretKey) {
  console.error("错误：缺少 TCB_SECRET_ID 或 TCB_SECRET_KEY 环境变量");
  process.exit(1);
}

const cloudbase = (await import("@cloudbase/node-sdk")).default;
const app = cloudbase.init({ env: envId, secretId, secretKey });
const db = app.database();

let success = 0;
let failed = 0;

for (const [collectionName, config] of Object.entries(collections)) {
  try {
    const ruleConfig = {
      permission: config.permission,
      securityRule: config.securityRule,
    };

    await db.collection(collectionName).setSecurityRule(ruleConfig);
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
