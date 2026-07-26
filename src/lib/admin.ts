import { useEffect, useState } from "react";
import { app, callCloudFunction } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";

// 按 uid 缓存管理员判定结果，避免重复调用云函数
let adminCache: { uid: string; isAdmin: boolean } | null = null;

/** 判断当前登录用户是否为管理员（通过 check-admin 云函数服务端判定） */
export function useIsAdmin(): boolean {
  const uid = useAuthStore((s) => s.user?.uid);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!uid) {
      setIsAdmin(false);
      return;
    }
    if (adminCache?.uid === uid) {
      setIsAdmin(adminCache.isAdmin);
      return;
    }
    let cancelled = false;
    app
      .callFunction({ name: "check-admin" })
      .then((res) => {
        const result = (res?.result ?? {}) as { isAdmin?: boolean };
        if (!cancelled) {
          adminCache = { uid, isAdmin: !!result.isAdmin };
          setIsAdmin(!!result.isAdmin);
        }
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return isAdmin;
}

/** 异步断言当前用户为管理员，否则抛错（用于需要即时校验的管理员操作） */
export async function assertAdmin(): Promise<void> {
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) throw new Error("无权限");
  if (adminCache?.uid === uid) {
    if (!adminCache.isAdmin) throw new Error("无权限");
    return;
  }
  // check-admin 返回扁平 { isAdmin } 而非 {ok,data} 信封,不适用 callCloudFunction
  const res = await app.callFunction({ name: "check-admin" });
  const result = (res?.result ?? {}) as { isAdmin?: boolean };
  adminCache = { uid, isAdmin: !!result.isAdmin };
  if (!result.isAdmin) throw new Error("无权限");
}

const db = app.database();

export async function fetchAdminStats(): Promise<{
  posts: number;
  ideas: number;
  books: number;
  workshops: number;
  users_v2: number;
  notifications: number;
}> {
  const collections = [
    "posts",
    "ideas",
    "books",
    "workshops",
    "users_v2",
    "notifications",
  ] as const;
  const entries = await Promise.all(
    collections.map(async (name) => {
      const { total } = await db.collection(name).count();
      return [name, total] as const;
    }),
  );
  return Object.fromEntries(entries) as {
    posts: number;
    ideas: number;
    books: number;
    workshops: number;
    users_v2: number;
    notifications: number;
  };
}

// #418 泛型化:调用方声明各集合的条目类型,SDK 边界断言收敛在此一处
export async function fetchAdminList<T = unknown>(collection: string, limit = 50): Promise<T[]> {
  const { data } = await db.collection(collection).orderBy("createdAt", "desc").limit(limit).get();
  return (data ?? []) as T[];
}

// #418 此前三个函数返回 Promise<unknown>,把类型检查整体放弃,调用方(Admin.tsx)
// 只能 as unknown as 二次断言;改为信封解包 + 泛型,失败直接抛错

export async function fetchAdminUsers<T = unknown>(page = 1, pageSize = 50): Promise<T[]> {
  const data = await callCloudFunction<T[] | undefined>(
    "user-admin",
    { action: "listUsers", page, pageSize },
    "获取用户列表失败",
  );
  return data ?? [];
}

export async function searchAdminUsers<T = unknown>(keyword: string): Promise<T[]> {
  const data = await callCloudFunction<T[] | undefined>(
    "user-admin",
    { action: "searchUsers", keyword },
    "搜索失败",
  );
  return data ?? [];
}

export async function adminDelete(collection: string, docId: string): Promise<void> {
  await callCloudFunction("admin-delete", { collection, docId, action: "delete" }, "删除失败");
}
