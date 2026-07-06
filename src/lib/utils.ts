import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 安全判断当前用户 uid 是否为内容作者。
 *
 * 不能直接用 `user?.uid === authorUid`：当两者都为 undefined/null 时
 * 会得到 `undefined === undefined` → true，导致未登录用户被误判为作者，
 * 从而看到编辑/删除/采纳等破坏性操作按钮（issue #107）。
 */
export function isAuthor(
  uid: string | null | undefined,
  authorUid?: string
): boolean {
  return Boolean(uid && authorUid && uid === authorUid);
}
