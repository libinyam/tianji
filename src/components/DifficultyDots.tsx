interface DifficultyDotsProps {
  level: number;
  max?: number;
  className?: string;
}

/** 难度以星点表示，已点亮为金色，未点亮为暗蓝。 */
export default function DifficultyDots({
  level,
  max = 5,
  className = "",
}: DifficultyDotsProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`难度 ${level}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: i < level ? "#f3c969" : "#1b275e",
            boxShadow: i < level ? "0 0 6px 1px rgba(243,201,105,0.5)" : "none",
          }}
        />
      ))}
    </span>
  );
}
