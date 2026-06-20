import { motion } from "motion/react";
import type { ReactNode } from "react";

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}

/** 内页通用头部：眉头 + 标题 + 副标题，带入场动效。 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-void-600/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(43,102,171,0.18),transparent_60%)]" />
      <div className="container-tj relative py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-star-300">
              {eyebrow}
            </span>
          </div>
          <h1 className="heading-display text-4xl text-parchment-50 sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-mist-300">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-7">{children}</div>}
        </motion.div>
      </div>
    </section>
  );
}
