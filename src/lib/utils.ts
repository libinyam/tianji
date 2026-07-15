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

/**
 * 将 CloudBase SDK 抛出的英文错误信息翻译成中文。
 * 常见场景：直写 DB 被安全规则拦截时抛出 "Permission denied by security rules"。
 */
export function friendlyErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/permission denied|security rules/i.test(msg)) {
    return "操作失败：权限不足或登录已过期，请刷新后重试";
  }
  return msg;
}
