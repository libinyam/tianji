import { useAuthStore } from "@/stores/auth";

/** 管理员 uid 列表 */
export const ADMIN_UIDS = ["2068674931977097216"];

/** 判断当前用户是否为管理员 */
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return user ? ADMIN_UIDS.includes(user.uid) : false;
}

/** 判断指定 uid 是否为管理员 */
export function isAdminUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return ADMIN_UIDS.includes(uid);
}
