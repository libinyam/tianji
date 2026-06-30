import { lazy, Suspense, type ComponentProps } from "react";

// 懒加载 MathText，避免 katex (261kB) 进入主包
const MathText = lazy(() => import("@/components/MathText"));

type Props = ComponentProps<typeof MathText>;

/** MathText 的懒加载包装，首次渲染时才拉取 katex */
export default function LazyMathText(props: Props) {
  return (
    <Suspense fallback={<div className="animate-pulse text-mist-500">渲染中…</div>}>
      <MathText {...props} />
    </Suspense>
  );
}
