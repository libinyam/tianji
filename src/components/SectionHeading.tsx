import { motion } from "motion/react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

/** 通用章节标题，左侧带星点装饰。 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  const isCenter = align === "center";
  return (
    <div
      className={`${isCenter ? "mx-auto text-center" : "text-left"} max-w-2xl ${className}`}
    >
      {eyebrow && (
        <div
          className={`mb-3 flex items-center gap-2 ${
            isCenter ? "justify-center" : ""
          }`}
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
            {eyebrow}
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-star-400" />
        </div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="heading-display text-3xl text-parchment-100 sm:text-4xl"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <p className="mt-3 text-sm leading-relaxed text-mist-400 sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}
