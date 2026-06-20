interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

/** 取姓名首字作为头像，配以星色环。 */
export default function Avatar({
  name,
  color = "#7cc4ff",
  size = 32,
  className = "",
}: AvatarProps) {
  const initial = name.charAt(0);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display text-void-900 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
        boxShadow: `0 0 0 1px ${color}55, 0 0 12px -2px ${color}66`,
      }}
      title={name}
    >
      {initial}
    </span>
  );
}
