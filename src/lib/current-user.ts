import { useAuthStore } from "@/stores/auth";

/** 获取当前登录用户的 uid，未登录返回空字符串 */
export function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

/** 获取当前登录用户的显示名 */
export function getCurrentUserName(): string {
  const user = useAuthStore.getState().user;
  return user?.nickname || user?.username || user?.email || "匿名用户";
}
