import type { ReactNode } from "react";

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}

/** 内页通用头部：精简版，去装饰，快速传递页面定位。 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: PageHeroProps) {
  return (
    <section className="border-b border-void-600/30">
      <div className="container-tj py-10 sm:py-12">
        <div className="max-w-3xl">
          <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-mist-500">
            {eyebrow}
          </span>
          <h1 className="heading-display text-3xl text-parchment-50 sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist-400">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </section>
  );
}
