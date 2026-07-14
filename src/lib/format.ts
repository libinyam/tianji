/**
 * 格式化时间为相对时间（如"刚刚"、"3分钟前"、"2小时前"）
 * 超过30天则显示日期
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  if (hour < 24) return `${hour}小时前`;
  if (day < 30) return `${day}天前`;

  // 超过30天显示日期
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Discourse 风格短格式相对时间（如"18 分钟"、"4 小时"、"1 分钟"）
 * 不带"前"字，数字与单位间有空格
 */
export function formatShortTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return "刚刚";
  if (min < 60) return `${min} 分钟`;
  if (hour < 24) return `${hour} 小时`;
  if (day < 30) return `${day} 天`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 格式化数字为简写（1100 → 1.1k, 320000 → 320k, 46 → 46）
 * Discourse 风格：千位以上加 k，保留一位小数（.0 省略）
 */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) {
    const s = (n / 1000).toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) + "k" : s + "k";
  }
  if (n < 1000000) {
    const s = (n / 1000).toFixed(0);
    return s + "k";
  }
  return (n / 1000000).toFixed(1) + "M";
}
