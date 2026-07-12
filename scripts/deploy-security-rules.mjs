#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

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

function sha256(message) {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

function hmacSha256(key, message) {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest();
}

function tc3Signature(action, params) {
  const service = "tcb";
  const host = "tcb.tencentcloudapi.com";
  const endpoint = "https://" + host;
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const payload = JSON.stringify({ ...params });
  const hashedPayload = sha256(payload);
  const canonicalHeaders = "content-type:application/json; charset=utf-8\n" + "host:" + host + "\n" + "x-tc-action:" + action.toLowerCase() + "\n";
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = "POST\n/\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + hashedPayload;

  const hashedCanonicalRequest = sha256(canonicalRequest);
  const credentialScope = date + "/" + service + "/tc3_request";
  const stringToSign = "TC3-HMAC-SHA256\n" + timestamp + "\n" + credentialScope + "\n" + hashedCanonicalRequest;

  const secretDateKey = hmacSha256(Buffer.from("TC3" + secretKey, "utf8"), date);
  const secretServiceKey = hmacSha256(secretDateKey, service);
  const secretSigningKey = hmacSha256(secretServiceKey, "tc3_request");
  const signature = crypto.createHmac("sha256", secretSigningKey).update(stringToSign, "utf8").digest("hex");

  const authorization = "TC3-HMAC-SHA256 Credential=" + secretId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

  return {
    method: "POST",
    url: endpoint,
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json; charset=utf-8",
      "Host": host,
      "X-TC-Action": action,
      "X-TC-Version": "2018-06-08",
      "X-TC-Timestamp": String(timestamp),
    },
    body: payload,
  };
}

let success = 0;
let failed = 0;

for (const [collectionName, config] of Object.entries(collections)) {
  try {
    let aclTag = "CUSTOM";
    let rule = undefined;

    if (config.permission === "PRIVATE") {
      aclTag = "ADMINONLY";
    } else if (config.securityRule) {
      aclTag = "CUSTOM";
      rule = JSON.stringify({
        read: config.securityRule.read,
        write: config.securityRule.create,
        update: config.securityRule.update,
        delete: config.securityRule.delete,
      });
    } else {
      aclTag = "ADMINONLY";
    }

    const params = {
      EnvId: envId,
      CollectionName: collectionName,
      AclTag: aclTag,
    };
    if (rule) params.Rule = rule;

    const reqConfig = tc3Signature("ModifySafeRule", params);

    const response = await fetch(reqConfig.url, {
      method: reqConfig.method,
      headers: reqConfig.headers,
      body: reqConfig.body,
    });

    const result = await response.json();
    if (result.Response && result.Response.Error) {
      throw new Error(result.Response.Error.Message || JSON.stringify(result.Response.Error));
    }

    console.log(`✅ ${collectionName} - 规则已应用 (${aclTag})`);
    success++;
  } catch (e) {
    console.error(`❌ ${collectionName} - 失败: ${e.message}`);
    failed++;
  }
}

console.log(`\n=== 部署完成 ===`);
console.log(`成功: ${success} / 失败: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
