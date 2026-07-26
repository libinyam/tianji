interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

/** 通用章节标题：简约扁平。 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  const isCenter = align === "center";
  return (
    <div className={`${isCenter ? "mx-auto text-center" : "text-left"} max-w-2xl ${className}`}>
      {eyebrow && <span className="mb-1.5 block text-xs font-medium text-tian-500">{eyebrow}</span>}
      <h2 className="text-xl font-semibold tracking-tight text-parchment-100 sm:text-2xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm leading-relaxed text-mist-400 sm:text-base">{subtitle}</p>
      )}
    </div>
  );
}
