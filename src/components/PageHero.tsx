import type { ReactNode } from "react";

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}

/** 内页通用头部：简约扁平，快速传递页面定位。 */
export default function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps) {
  return (
    <section className="border-b border-void-600">
      <div className="container-tj py-8 sm:py-10">
        <div className="max-w-3xl">
          <span className="mb-1.5 block text-xs font-medium text-tian-500">{eyebrow}</span>
          <h1 className="text-2xl font-semibold tracking-tight text-parchment-50 sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist-400">{subtitle}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </section>
  );
}
