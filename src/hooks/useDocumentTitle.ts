import { useEffect } from "react";

const BASE_TITLE = "天玑 · 跨专业 AI 学习与项目共创社区";

export { BASE_TITLE };

/**
 * #353 构造页面标题：若 title 已包含品牌名「天玑」则不再追加后缀，
 * 避免动态内容标题（如包含「天玑」的帖子标题）出现「xxx · 天玑 · 天玑」。
 */
export function buildPageTitle(title?: string): string {
  if (!title) return BASE_TITLE;
  if (title.includes("天玑")) return title;
  return `${title} · 天玑`;
}

/**
 * 设置页面标题为「xxx · 天玑」；不传参数则用站点默认标题。
 * 详情页可传异步加载的内容标题（undefined 时先显示默认，加载后更新）。
 * 组件卸载时还原默认标题，避免残留上一页的标题。
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = buildPageTitle(title);
  }, [title]);

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);
}
