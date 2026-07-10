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

export function sanitizeContent(text: string): string {
  let result = text;
  for (const word of SENSITIVE_WORDS) {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, "*".repeat(word.length));
  }
  return result;
}
