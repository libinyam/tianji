#!/usr/bin/env node
/**
 * #425 覆盖率阈值棘轮：读取 coverage/coverage-summary.json 的实际总覆盖率，
 * 把 vitest.config.ts 的 thresholds 回写为「实际值向下取整再减 3」（下限 1），
 * 锁住当前成果又留出正常波动余量。
 *
 * 用法：npm run test:coverage && node scripts/ratchet-coverage.mjs
 * （回写后需再跑一次 test:coverage 验证新阈值通过）
 */
import { readFileSync, writeFileSync } from "node:fs";

const summary = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
const total = summary.total;
const floor = (pct) => Math.max(1, Math.floor(pct) - 3);

const lines = floor(total.lines.pct);
const branches = floor(total.branches.pct);
const functions = floor(total.functions.pct);

console.log(
  `实际覆盖率: lines ${total.lines.pct}% / branches ${total.branches.pct}% / functions ${total.functions.pct}%`,
);
console.log(`回写阈值:   lines ${lines} / branches ${branches} / functions ${functions}`);

const configPath = "vitest.config.ts";
const src = readFileSync(configPath, "utf8");
const next = src.replace(
  /thresholds: \{[^}]*\}/,
  `thresholds: {\n        lines: ${lines},\n        branches: ${branches},\n        functions: ${functions},\n      }`,
);
if (next === src) {
  console.error("未找到 thresholds 块，请人工检查 vitest.config.ts");
  process.exit(1);
}
writeFileSync(configPath, next, "utf8");
console.log("vitest.config.ts 阈值已更新");
