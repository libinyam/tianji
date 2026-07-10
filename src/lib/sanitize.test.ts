import { describe, it, expect } from "vitest";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "./sanitize";

describe("sanitizeInput", () => {
  it("去除零宽字符", () => {
    expect(sanitizeInput("hello\u200Bworld")).toBe("helloworld");
    expect(sanitizeInput("\u200B\u200C\u200D\u200E\u200Ftest")).toBe("test");
    expect(sanitizeInput("a\u202A b\u202E c\u2060 d\u2064")).toBe("a b c d");
    expect(sanitizeInput("text\uFEFF")).toBe("text");
  });

  it("保留正常文本", () => {
    expect(sanitizeInput("hello world")).toBe("hello world");
    expect(sanitizeInput("数学公式 a<b > c")).toBe("数学公式 a<b > c");
    expect(sanitizeInput("代码 Array<T>")).toBe("代码 Array<T>");
    expect(sanitizeInput("#include <stdio.h>")).toBe("#include <stdio.h>");
  });

  it("去除 C0/C1 控制字符但保留 \\n \\r \\t", () => {
    expect(sanitizeInput("line1\nline2")).toBe("line1\nline2");
    expect(sanitizeInput("col1\tcol2")).toBe("col1\tcol2");
    expect(sanitizeInput("a\rb")).toBe("a\rb");
    expect(sanitizeInput("a\x00b")).toBe("ab");
    expect(sanitizeInput("a\x01b")).toBe("ab");
    expect(sanitizeInput("a\x08b")).toBe("ab");
    expect(sanitizeInput("a\x0Bb")).toBe("ab");
    expect(sanitizeInput("a\x0Cb")).toBe("ab");
    expect(sanitizeInput("a\x1Fb")).toBe("ab");
    expect(sanitizeInput("a\x7Fb")).toBe("ab");
    expect(sanitizeInput("a\x9Fb")).toBe("ab");
  });

  it("截断超长文本", () => {
    const long = "a".repeat(15000);
    expect(sanitizeInput(long)).toHaveLength(10000);
    expect(sanitizeInput(long, 500)).toHaveLength(500);
    expect(sanitizeInput("short", 500)).toBe("short");
  });

  it("非字符串入参返回空串", () => {
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(undefined as unknown as string)).toBe("");
    expect(sanitizeInput(123 as unknown as string)).toBe("");
    expect(sanitizeInput({} as unknown as string)).toBe("");
  });

  it("空字符串返回空串", () => {
    expect(sanitizeInput("")).toBe("");
  });

  it("组合场景：零宽+控制字符+长度", () => {
    const input = "\u200Bhello\x00world\n\uFEFFnew\x0Bline";
    expect(sanitizeInput(input)).toBe("helloworld\nnewline");
  });

  it("数学公式和代码泛型不被破坏", () => {
    expect(sanitizeInput("a<b")).toBe("a<b");
    expect(sanitizeInput("a>b")).toBe("a>b");
    expect(sanitizeInput("Array<T>")).toBe("Array<T>");
    expect(sanitizeInput("Map<K,V>")).toBe("Map<K,V>");
    expect(sanitizeInput("#include <stdio.h>")).toBe("#include <stdio.h>");
  });
});

describe("sanitizeTitle", () => {
  it("限制长度为 200", () => {
    expect(sanitizeTitle("a".repeat(300))).toHaveLength(200);
    expect(sanitizeTitle("a".repeat(100))).toBe("a".repeat(100));
  });

  it("去除零宽和控制字符", () => {
    expect(sanitizeTitle("title\u200B")).toBe("title");
    expect(sanitizeTitle("title\x00")).toBe("title");
  });

  it("非字符串返回空串", () => {
    expect(sanitizeTitle(null as unknown as string)).toBe("");
  });

  it("保留正常标题", () => {
    expect(sanitizeTitle("关于 AI 学习的讨论")).toBe("关于 AI 学习的讨论");
  });
});

describe("sanitizeTag", () => {
  it("只保留中英文、数字、连字符、下划线", () => {
    expect(sanitizeTag("AI学习")).toBe("AI学习");
    expect(sanitizeTag("react-18")).toBe("react-18");
    expect(sanitizeTag("node_js")).toBe("node_js");
    expect(sanitizeTag("数学AI")).toBe("数学AI");
  });

  it("去除特殊字符", () => {
    expect(sanitizeTag("hello world")).toBe("helloworld");
    expect(sanitizeTag("react@18!")).toBe("react18");
    expect(sanitizeTag("<script>")).toBe("script");
    expect(sanitizeTag("a.b.c")).toBe("abc");
    expect(sanitizeTag("a/b\\c")).toBe("abc");
  });

  it("限制长度为 30", () => {
    expect(sanitizeTag("a".repeat(50))).toHaveLength(30);
  });

  it("非字符串返回空串", () => {
    expect(sanitizeTag(null as unknown as string)).toBe("");
    expect(sanitizeTag(123 as unknown as string)).toBe("");
  });

  it("空字符串返回空串", () => {
    expect(sanitizeTag("")).toBe("");
  });

  it("零宽字符被去除", () => {
    expect(sanitizeTag("react\u200B18")).toBe("react18");
  });
});
