/**
 * HTML 转义 — 防止 XSS
 * 对用户输入的文本做转义，只保留纯文本语义
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * 频率限制器 — 防止灌水
 * 基于 localStorage 记录上次操作时间，冷却期内拒绝操作
 */
export class RateLimiter {
  private key: string;
  private cooldownMs: number;

  constructor(key: string, cooldownSeconds: number) {
    this.key = `tianji:rate:${key}`;
    this.cooldownMs = cooldownSeconds * 1000;
  }

  /** 检查是否可以操作，返回 { allowed, remaining } */
  check(): { allowed: boolean; remaining: number } {
    const last = localStorage.getItem(this.key);
    if (!last) return { allowed: true, remaining: 0 };
    const elapsed = Date.now() - Number(last);
    if (elapsed >= this.cooldownMs) return { allowed: true, remaining: 0 };
    return { allowed: false, remaining: Math.ceil((this.cooldownMs - elapsed) / 1000) };
  }

  /** 记录本次操作时间 */
  record(): void {
    localStorage.setItem(this.key, String(Date.now()));
  }
}

// 预定义频率限制器
export const rateLimiters = {
  post: new RateLimiter("post", 30),
  idea: new RateLimiter("idea", 30),
  comment: new RateLimiter("comment", 10),
  answer: new RateLimiter("answer", 15),
  book: new RateLimiter("book", 60),
  workshop: new RateLimiter("workshop", 60),
  follow: new RateLimiter("follow", 5),
  tagFollow: new RateLimiter("tagFollow", 5),
};
