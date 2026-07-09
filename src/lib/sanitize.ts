/**
 * 输入清理模块 — 防止 XSS 和注入攻击
 *
 * 在用户内容写入数据库之前调用，清理潜在的危险字符。
 * 前端 React 的 JSX 默认转义提供第二层防护，但写入数据库的内容
 * 也会被 AI Bot、RSS、邮件通知等渠道消费，因此必须在入口清理。
 */

/**
 * 清理用户输入的文本内容
 *
 * 处理项：
 * - 去除零宽字符（防止隐写攻击和绕过关键词过滤）
 * - 去除 C0/C1 控制字符（保留换行 \n、回车 \r、制表符 \t）
 * - 去除 HTML 标签（防止存储型 XSS）
 * - 去除 javascript: / data: 协议链接
 * - 去除内联事件处理器（onclick= 等）
 * - 限制最大长度
 *
 * @param text 原始输入文本
 * @param maxLength 最大允许长度，默认 10000
 * @returns 清理后的安全文本
 */
export function sanitizeInput(text: string, maxLength = 10000): string {
  if (typeof text !== "string") return "";

  return text
    // 1. 去除零宽字符
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    // 2. 去除 C0/C1 控制字符（保留 \n \r \t）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    // 3. 去除 HTML 标签
    .replace(/<\/?[a-z][\s\S]*?>/gi, "")
    // 4. 去除 javascript: 协议
    .replace(/javascript\s*:/gi, "")
    // 5. 去除 data: URI（仅 text/html 等危险类型）
    .replace(/data\s*:\s*text\/html/gi, "")
    // 6. 去除内联事件处理器
    .replace(/on\w+\s*=\s*["']/gi, "")
    // 7. 截断长度
    .slice(0, maxLength);
}

/**
 * 清理标题字段（更严格的长度限制）
 */
export function sanitizeTitle(title: string): string {
  return sanitizeInput(title, 200);
}

/**
 * 清理用户名 / 昵称字段
 */
export function sanitizeName(name: string): string {
  return sanitizeInput(name, 50);
}

/**
 * 校验并清理标签名
 * 标签仅允许中文、字母、数字、连字符、下划线
 */
export function sanitizeTag(tag: string): string {
  if (typeof tag !== "string") return "";
  // 去除一切非预期字符，只保留中英文、数字、-、_
  return tag.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\-_]/g, "").slice(0, 30);
}

/**
 * 批量清理对象的字符串字段
 * @param obj 需要清理的对象
 * @param fields 需要清理的字段名列表
 * @param maxLength 每个字段的最大长度
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
  maxLength = 10000
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field as string] = sanitizeInput(
        result[field] as string,
        maxLength
      );
    }
  }
  return result;
}
