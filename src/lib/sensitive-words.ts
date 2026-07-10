const SENSITIVE_WORDS = [
  "垃圾", "广告", "色情", "赌博", "毒品", "诈骗",
  "fuck", "shit", "bitch",
];

export function containsSensitiveWord(text: string): { found: boolean; words: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const word of SENSITIVE_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      found.push(word);
    }
  }
  return { found: found.length > 0, words: found };
}

/**
 * 将文本中的敏感词替换为等长星号
 * 使用字符串匹配而非正则，避免敏感词中含正则特殊字符时引发 ReDoS
 */
export function sanitizeContent(text: string): string {
  let result = text;
  for (const word of SENSITIVE_WORDS) {
    const lower = word.toLowerCase();
    const mask = "*".repeat(word.length);
    // 大小写不敏感替换：逐段查找并替换
    let output = "";
    let remaining = result;
    while (remaining.length > 0) {
      const idx = remaining.toLowerCase().indexOf(lower);
      if (idx === -1) {
        output += remaining;
        break;
      }
      output += remaining.slice(0, idx) + mask;
      remaining = remaining.slice(idx + word.length);
    }
    result = output;
  }
  return result;
}
