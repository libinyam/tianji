import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface OutlineItem {
  title: string;
  items?: OutlineItem[];
}

/** 递归提取 PDF 大纲为扁平的标题列表 */
function flattenOutline(items: OutlineItem[], depth = 0, result: string[] = []): string[] {
  for (const item of items) {
    const prefix = depth > 0 ? "  ".repeat(depth) + "· " : "";
    result.push(prefix + item.title.trim());
    if (item.items && item.items.length > 0) {
      flattenOutline(item.items, depth + 1, result);
    }
  }
  return result;
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

    const toc = flattenOutline(outline);
    return toc;
  } catch (err) {
    console.error("PDF 目录解析失败:", err);
    return [];
  }
}
