import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 守护生产部署配置：cloudbaserc.json 的 functions 列表必须覆盖
// cloudfunctions/ 下所有云函数，新增函数忘记登记会让 CI 失败 (#244)。

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const RC_FILE = resolve(ROOT, "cloudbaserc.json");
const FN_DIR = resolve(ROOT, "cloudfunctions");

interface CloudbaseRc {
  envId: string;
  functionRoot?: string;
  functions?: { name: string; handler?: string }[];
}

const rc: CloudbaseRc = JSON.parse(readFileSync(RC_FILE, "utf-8"));

function listFunctionDirs(): string[] {
  if (!existsSync(FN_DIR)) return [];
  return readdirSync(FN_DIR)
    .filter((name) => {
      const full = resolve(FN_DIR, name);
      return statSync(full).isDirectory() && existsSync(resolve(full, "index.js"));
    })
    .sort();
}

describe("生产部署配置一致性 (#244)", () => {
  it("cloudbaserc.json 声明 functionRoot 为 cloudfunctions", () => {
    expect(rc.functionRoot).toBe("cloudfunctions");
  });

  it("每个云函数目录都在 cloudbaserc.json 的 functions 列表中", () => {
    const declared = new Set((rc.functions ?? []).map((f) => f.name));
    const onDisk = listFunctionDirs();
    const missing = onDisk.filter((name) => !declared.has(name));
    expect(missing, `以下云函数未登记到 cloudbaserc.json，将不会随生产部署上线: ${missing.join(", ")}`).toEqual([]);
  });

  it("functions 列表中不存在磁盘上已删除的云函数", () => {
    const onDisk = new Set(listFunctionDirs());
    const stale = (rc.functions ?? []).map((f) => f.name).filter((name) => !onDisk.has(name));
    expect(stale, `以下已登记函数在 cloudfunctions/ 下不存在: ${stale.join(", ")}`).toEqual([]);
  });
});
