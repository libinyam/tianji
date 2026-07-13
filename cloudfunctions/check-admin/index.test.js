import { describe, it, expect, beforeEach, vi } from "vitest";

function ctx(uid) {
  return { userInfo: { uid } };
}

async function loadModule(adminUids) {
  if (adminUids === undefined || adminUids === "") {
    delete process.env.ADMIN_UIDS;
  } else {
    process.env.ADMIN_UIDS = adminUids;
  }
  vi.resetModules();
  return await import("./index.js");
}

describe("check-admin 身份判定", () => {
  beforeEach(() => {
    delete process.env.ADMIN_UIDS;
    vi.resetModules();
  });

  it("管理员 UID 匹配时返回 isAdmin:true", async () => {
    const { main } = await loadModule("admin-001,admin-002");
    const res = await main({}, ctx("admin-001"));
    expect(res.ok).toBe(true);
    expect(res.isAdmin).toBe(true);
  });

  it("非管理员 UID 返回 isAdmin:false", async () => {
    const { main } = await loadModule("admin-001");
    const res = await main({}, ctx("normal-user"));
    expect(res.ok).toBe(true);
    expect(res.isAdmin).toBe(false);
  });

  it("uid 为空（未登录）返回 isAdmin:false", async () => {
    const { main } = await loadModule("admin-001");
    const res = await main({}, ctx(""));
    expect(res.ok).toBe(true);
    expect(res.isAdmin).toBe(false);
  });

  it("ADMIN_UIDS 为空时所有人都是非管理员", async () => {
    const { main } = await loadModule("");
    const res = await main({}, ctx("anyone-123"));
    expect(res.ok).toBe(true);
    expect(res.isAdmin).toBe(false);
  });
});
