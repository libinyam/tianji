import { useMemo } from "react";

interface Star {
  top: string;
  left: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
  gold: boolean;
}

interface StarFieldProps {
  count?: number;
  className?: string;
}

/** 深空星点背景层，纯 CSS 闪烁，性能友好。 */
export default function StarField({ count = 90, className = "" }: StarFieldProps) {
  const stars = useMemo<Star[]>(() => {
    // 简单确定性伪随机，避免水合跳动
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => {
      const gold = rand() > 0.82;
      return {
        top: `${rand() * 100}%`,
        left: `${rand() * 100}%`,
        size: rand() * 2 + 1,
        delay: `${rand() * 5}s`,
        duration: `${rand() * 4 + 3}s`,
        opacity: rand() * 0.6 + 0.2,
        gold,
      };
    });
  }, [count]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-twinkle"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: s.delay,
            animationDuration: s.duration,
            opacity: s.opacity,
            background: s.gold ? "#f3c969" : "#cfe9ff",
            boxShadow: s.gold
              ? "0 0 6px 1px rgba(243,201,105,0.6)"
              : "0 0 6px 1px rgba(124,196,255,0.5)",
          }}
        />
      ))}
    </div>
  );
}
