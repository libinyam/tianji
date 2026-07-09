import { useEffect } from "react";

const BASE_TITLE = "天玑 · 跨专业 AI 学习与项目共创社区";

/**
 * 设置页面标题为「xxx · 天玑」；不传参数则用站点默认标题。
 * 详情页可传异步加载的内容标题（undefined 时先显示默认，加载后更新）。
 * 组件卸载时还原默认标题，避免残留上一页的标题。
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · 天玑` : BASE_TITLE;
  }, [title]);

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);
}
