import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface OutlineItem {
  title: string;
  items?: OutlineItem[];
}

/** 检测标题是否已包含章节编号 */
function hasChapterNumber(title: string): boolean {
  return /^(第[一二三四五六七八九十百\d]+[章节回卷]|Chapter\s*\d+|Ch\.?\s*\d+|\d+\.\s|\d+\s)/i.test(
    title.trim()
  );
}

interface NumberedNode {
  title: string;
  number: string; // e.g. "1", "1.1", "1.1.1"
  depth: number;
}

/** 递归提取大纲，生成带层级编号的节点列表 */
function buildNumberedTree(
  items: OutlineItem[],
  depth: number,
  parentNumber: number[],
  result: NumberedNode[]
): void {
  let index = 0;
  for (const item of items) {
    index++;
    const number = [...parentNumber, index].join(".");
    const title = item.title.trim();

    result.push({ title, number, depth });

    if (item.items && item.items.length > 0) {
      buildNumberedTree(item.items, depth + 1, [...parentNumber, index], result);
    }
  }
}

/**
 * 将带编号的节点列表格式化为目录字符串数组。
 * 顶层条目：如果标题已含"第X章"则原样保留，否则加"第N章 "前缀。
 * 子层条目：用 "N.M" 编号 + 缩进。
 */
function formatToc(nodes: NumberedNode[]): string[] {
  return nodes.map((node) => {
    const indent = "  ".repeat(node.depth);
    if (node.depth === 0) {
      // 顶层：检测是否已有章节编号
      if (hasChapterNumber(node.title)) {
        return node.title;
      }
      return `第${node.number}章 ${node.title}`;
    }
    // 子层：用数字编号 + 缩进
    return `${indent}${node.number} ${node.title}`;
  });
}

/**
 * 解析 PDF 文件的目录书签
 * @param file PDF 文件
 * @returns 目录字符串数组，如果没有书签则返回空数组
 */
export async function extractPdfToc(file: File): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const outline = (await pdf.getOutline()) as OutlineItem[] | null;

    if (!outline || outline.length === 0) {
      return [];
    }

    const nodes: NumberedNode[] = [];
    buildNumberedTree(outline, 0, [], nodes);
    return formatToc(nodes);
  } catch (err) {
    console.error("PDF 目录解析失败:", err);
    return [];
  }
}
