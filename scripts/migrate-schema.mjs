#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
const maxDocsArg = args.indexOf("--maxDocs");
const maxDocs = maxDocsArg !== -1 && maxDocsArg + 1 < args.length ? parseInt(args[maxDocsArg + 1], 10) : 0;
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

const OWNER_FIELDS = {
  posts: "authorUid",
  ideas: "authorUid",
  books: "authorUid",
  workshops: "creatorUid",
};

console.log(`\n=== Schema 迁移 ===`);
console.log(`环境 ID: ${envId}`);
console.log(`Schema 版本: ${schema.version}`);
console.log(`集合数: ${Object.keys(collections).length}`);
console.log(`分页: 每页 100 条${maxDocs ? `，上限 ${maxDocs} 条` : "（无上限）"}`);
console.log();

if (dryRun) {
  console.log("（dry-run 模式，仅扫描不执行）\n");
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

const PAGE_SIZE = 100;
let totalScanned = 0;
let totalMigrated = 0;
let totalSkipped = 0;
let totalUnresolved = 0;
let totalErrors = 0;
const failedDocs = [];

for (const collectionName of targets) {
  const config = collections[collectionName];
  if (!config) {
    console.error(`❌ 未知集合: ${collectionName}`);
    continue;
  }

  const targetVersion = config.schemaVersion;
  const migrations = config.migrations || [];
  const ownerField = OWNER_FIELDS[collectionName];

  if (migrations.length === 0) {
    console.log(`⏭️  ${collectionName}: 无迁移定义`);
    continue;
  }

  console.log(`\n[${collectionName}] 目标版本: v${targetVersion}`);

  let colScanned = 0;
  let colMigrated = 0;
  let colSkipped = 0;
  let colUnresolved = 0;
  let colErrors = 0;
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data: docs } = await db.collection(collectionName).skip(offset).limit(PAGE_SIZE).get();

      if (!docs || docs.length === 0) {
        hasMore = false;
        break;
      }

      for (const doc of docs) {
        colScanned++;
        totalScanned++;

        if (maxDocs && colScanned > maxDocs) {
          hasMore = false;
          break;
        }

        const currentVersion = doc.schemaVersion || 1;

        if (currentVersion >= targetVersion) {
          colSkipped++;
          totalSkipped++;
          continue;
        }

        const update = { schemaVersion: targetVersion };

        for (const migration of migrations) {
          if (currentVersion < migration.to) {
            if (migration.defaults) {
              for (const [field, defaultValue] of Object.entries(migration.defaults)) {
                if (doc[field] === undefined) {
                  if (field === ownerField && !defaultValue) {
                    update[field] = "";
                    update.ownerResolutionStatus = "unresolved";
                    colUnresolved++;
                    totalUnresolved++;
                  } else {
                    update[field] = defaultValue;
                  }
                }
              }
            }
          }
        }

        try {
          await db.collection(collectionName).doc(doc._id).update(update);
          colMigrated++;
          totalMigrated++;
        } catch (e) {
          console.error(`  ❌ 文档 ${doc._id} 迁移失败: ${e.message}`);
          failedDocs.push({ collection: collectionName, docId: doc._id, error: e.message });
          colErrors++;
          totalErrors++;
        }
      }

      if (docs.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    console.log(`  ✅ 扫描: ${colScanned} / 迁移: ${colMigrated} / 跳过: ${colSkipped} / owner待修复: ${colUnresolved} / 错误: ${colErrors}`);
  } catch (e) {
    console.error(`❌ ${collectionName} 迁移失败: ${e.message}`);
    totalErrors++;
  }
}

console.log(`\n=== 迁移完成 ===`);
console.log(`总扫描文档: ${totalScanned}`);
console.log(`总迁移文档: ${totalMigrated}`);
console.log(`总跳过文档: ${totalSkipped}`);
console.log(`owner 待人工修复: ${totalUnresolved}`);
console.log(`错误数: ${totalErrors}`);

if (failedDocs.length > 0) {
  const failedList = JSON.stringify(failedDocs, null, 2);
  console.log(`\n失败文档清单（可重跑）:`);
  console.log(failedList);
}

if (totalUnresolved > 0) {
  console.log(`\n⚠️  ${totalUnresolved} 个文档的 owner 字段缺失，已标记为 ownerResolutionStatus: "unresolved"`);
  console.log(`   这些文档的安全规则 owner 校验会失败，需要管理员手动补录 owner`);
}

process.exit(totalErrors > 0 ? 1 : 0);
