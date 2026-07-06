import { useEffect, useState } from "react";
import { app } from "@/lib/cloudbase";
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
      .callFunction({ name: "check-admin", data: { callerUid: uid } })
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
  const res = await app.callFunction({ name: "check-admin", data: { callerUid: uid } });
  const result = (res?.result ?? {}) as { isAdmin?: boolean };
  adminCache = { uid, isAdmin: !!result.isAdmin };
  if (!result.isAdmin) throw new Error("无权限");
}
