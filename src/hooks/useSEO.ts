import { useEffect } from "react";

const BASE_TITLE = "天玑 · 跨专业 AI 学习与项目共创社区";
const BASE_DESCRIPTION =
  "天玑 -- 面向跨专业 AI 转型者的学习与项目共创社区。整合学习资源、工具教程、项目案例与协作空间，帮你从只会学理论，走向能做项目、会协作、能产出。";
const SITE_URL = "https://tianjihub.cn";

interface SEOOptions {
  title?: string;
  description?: string;
  /** 完整 canonical URL；不传则用站点根 URL */
  canonical?: string;
  /** OG 类型，默认 website；帖子用 article */
  type?: "website" | "article";
  /** OG 图片 URL */
  image?: string;
  /** JSON-LD 结构化数据对象，会注入到 <script type="application/ld+json"> */
  jsonLd?: Record<string, unknown> | null;
}

/** 设置或更新一个 meta 标签（property 或 name） */
function setMeta(attr: "property" | "name", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** 设置 canonical link */
function setCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** 注入 JSON-LD 结构化数据，返回用于清理的 script 元素 id */
const JSONLD_ID = "seo-jsonld";
function setJsonLd(data: Record<string, unknown> | null) {
  const existing = document.getElementById(JSONLD_ID);
  if (existing) existing.remove();
  if (!data) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = JSONLD_ID;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * #150 动态 SEO hook
 *
 * 管理 title / description / OG / Twitter Card / canonical / JSON-LD。
 * 组件卸载时还原站点默认值，避免残留上一页的 meta。
 *
 * 不依赖 react-helmet-async，直接用 DOM 操作（与现有 useDocumentTitle 模式一致）。
 */
export function useSEO(options: SEOOptions = {}) {
  const { title, description, canonical, type = "website", image, jsonLd } = options;

  useEffect(() => {
    const fullTitle = title ? `${title} · 天玑` : BASE_TITLE;
    const desc = description || BASE_DESCRIPTION;
    const url = canonical || SITE_URL + "/";

    document.title = fullTitle;

    // meta description
    setMeta("name", "description", desc);

    // Open Graph
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    if (image) setMeta("property", "og:image", image);

    // Twitter Card
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    if (image) setMeta("name", "twitter:image", image);

    // canonical
    setCanonical(url);

    // JSON-LD
    setJsonLd(jsonLd ?? null);

    return () => {
      // 还原站点默认
      document.title = BASE_TITLE;
      setMeta("name", "description", BASE_DESCRIPTION);
      setMeta("property", "og:title", "天玑 · 跨专业 AI 学习与项目共创社区");
      setMeta("property", "og:description", BASE_DESCRIPTION);
      setMeta("property", "og:type", "website");
      setMeta("property", "og:url", SITE_URL + "/");
      setMeta("name", "twitter:title", "天玑 · 跨专业 AI 学习与项目共创社区");
      setMeta("name", "twitter:description", BASE_DESCRIPTION);
      setCanonical(SITE_URL + "/");
      setJsonLd(null);
    };
  }, [title, description, canonical, type, image, jsonLd]);
}

/** 构造 WebSite + SearchAction JSON-LD（首页用） */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "天玑 Tianji",
    url: SITE_URL,
    description: BASE_DESCRIPTION,
    inLanguage: "zh-CN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** 构造 QAPage JSON-LD（帖子详情用） */
export function qaPageJsonLd(params: {
  title: string;
  body: string;
  author?: string;
  url: string;
  answerCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: params.title,
      text: params.body,
      author: { "@type": "Person", name: params.author || "匿名用户" },
      url: params.url,
      answerCount: params.answerCount,
    },
  };
}

/** 构造 Book JSON-LD（资源详情用） */
export function bookJsonLd(params: {
  title: string;
  author: string;
  description: string;
  url: string;
  rating?: number;
}) {
  const book: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: params.title,
    author: { "@type": "Person", name: params.author },
    description: params.description,
    url: params.url,
    inLanguage: "zh-CN",
  };
  if (params.rating && params.rating > 0) {
    book.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: params.rating,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return book;
}
