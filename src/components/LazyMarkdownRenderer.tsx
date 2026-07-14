import { lazy, Suspense, type ComponentProps } from "react";

// #148 懒加载 MarkdownRenderer，避免 react-markdown + rehype 插件进入主包
const MarkdownRenderer = lazy(() => import("@/components/MarkdownRenderer"));

type Props = ComponentProps<typeof MarkdownRenderer>;

/** MarkdownRenderer 的懒加载包装，首次渲染时才拉取 */
export default function LazyMarkdownRenderer(props: Props) {
  return (
    <Suspense fallback={<div className="animate-pulse text-mist-500">渲染中…</div>}>
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}
