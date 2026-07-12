#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = resolve(__dirname, "../cloudbase-schema.json");

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
const collectionArg = args.find((a) => !a.startsWith("--"));
const envIdIndex = args.indexOf("--envId");
const envIdArg = envIdIndex !== -1 && envIdIndex + 1 < args.length ? args[envIdIndex + 1] : null;
const envId = envIdArg || process.env.CLOUDBASE_ENV_ID || process.env.VITE_CLOUDBASE_ENV_ID;

if (!envId) {
  console.error("错误：未指定环境 ID。用 --envId 参数或在 .env 中设置 VITE_CLOUDBASE_ENV_ID");
  process.exit(1);
}

const schema = JSON.parse(readFileSync(SCHEMA_FILE, "utf-8"));
const collections = schema.collections;

console.log(`\n=== Schema 迁移 ===`);
console.log(`环境 ID: ${envId}`);
console.log(`Schema 版本: ${schema.version}`);
console.log(`集合数: ${Object.keys(collections).length}\n`);

if (dryRun) {
  console.log("（dry-run 模式，仅打印不执行）\n");
}

const targets = collectionArg ? [collectionArg] : Object.keys(collections);

if (dryRun) {
  for (const name of targets) {
    const config = collections[name];
    console.log(`[${name}] schemaVersion=${config.schemaVersion}`);
    if (config.migrations && config.migrations.length > 0) {
      for (const m of config.migrations) {
        console.log(`  v${m.from} -> v${m.to}: ${m.description}`);
        console.log(`    defaults: ${JSON.stringify(m.defaults)}`);
      }
    } else {
      console.log("  无迁移");
    }
  }
  console.log("\ndry-run 完成。");
  process.exit(0);
}

const secretId = process.env.TCB_SECRET_ID;
const secretKey = process.env.TCB_SECRET_KEY;

if (!secretId || !secretKey) {
  console.error("错误：缺少 TCB_SECRET_ID 或 TCB_SECRET_KEY");
  process.exit(1);
}

const cloudbase = (await import("@cloudbase/node-sdk")).default;
const app = cloudbase.init({ env: envId, secretId, secretKey });
const db = app.database();

let totalMigrated = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const collectionName of targets) {
  const config = collections[collectionName];
  if (!config) {
    console.error(`❌ 未知集合: ${collectionName}`);
    continue;
  }

  const targetVersion = config.schemaVersion;
  const migrations = config.migrations || [];

  if (migrations.length === 0) {
    console.log(`⏭️  ${collectionName}: 无迁移定义`);
    continue;
  }

  console.log(`\n[${collectionName}] 目标版本: v${targetVersion}`);

  try {
    const { data: docs } = await db.collection(collectionName).limit(1000).get();

    if (!docs || docs.length === 0) {
      console.log(`  空集合，跳过`);
      continue;
    }

    let migrated = 0;
    let skipped = 0;

    for (const doc of docs) {
      const currentVersion = doc.schemaVersion || 1;

      if (currentVersion >= targetVersion) {
        skipped++;
        continue;
      }

      const update = { schemaVersion: targetVersion };

      for (const migration of migrations) {
        if (currentVersion < migration.to) {
          if (migration.defaults) {
            for (const [field, defaultValue] of Object.entries(migration.defaults)) {
              if (doc[field] === undefined) {
                update[field] = defaultValue;
              }
            }
          }
        }
      }

      try {
        await db.collection(collectionName).doc(doc._id).update(update);
        migrated++;
      } catch (e) {
        console.error(`  ❌ 文档 ${doc._id} 迁移失败: ${e.message}`);
        totalErrors++;
      }
    }

    console.log(`  ✅ 迁移: ${migrated} / 跳过: ${skipped} / 总计: ${docs.length}`);
    totalMigrated += migrated;
    totalSkipped += skipped;
  } catch (e) {
    console.error(`❌ ${collectionName} 迁移失败: ${e.message}`);
    totalErrors++;
  }
}

console.log(`\n=== 迁移完成 ===`);
console.log(`总迁移文档: ${totalMigrated}`);
console.log(`总跳过文档: ${totalSkipped}`);
console.log(`错误数: ${totalErrors}`);
process.exit(totalErrors > 0 ? 1 : 0);
