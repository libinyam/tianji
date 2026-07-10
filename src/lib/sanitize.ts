/**
 * 输入清理模块 - 防止隐写攻击和控制字符注入
 *
 * 在用户内容写入数据库之前调用，清理不可见字符和截断长度。
 * XSS 防护由渲染层负责：React JSX 自动转义 + KaTeX trust:false。
 */

/**
 * 清理用户输入的文本内容
 *
 * 处理项：
 * - 去除零宽字符（防止隐写攻击和绕过关键词过滤）
 * - 去除 C0/C1 控制字符（保留换行 \n、回车 \r、制表符 \t）
 * - 限制最大长度
 *
 * 注意：不剥离 HTML 标签/事件处理器/javascript: 协议，
 * 因为这些会破坏数学公式（a<b）、代码泛型（Array<T>）、
 * C 头文件（#include <stdio.h>）等合法内容。
 * XSS 防线交给 React 渲染层自动转义。
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
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    // 3. 截断长度
    .slice(0, maxLength);
}

/**
 * 清理标题字段（更严格的长度限制）
 */
export function sanitizeTitle(title: string): string {
  return sanitizeInput(title, 200);
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
