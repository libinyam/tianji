import { motion } from "motion/react";

interface Node {
  x: number;
  y: number;
  r: number;
  name: string;
  highlight?: boolean;
}

// 北斗七星（天玑为其中第三星，平台命名所自）
const NODES: Node[] = [
  { x: 50, y: 55, r: 4, name: "天枢" },
  { x: 52, y: 132, r: 3.4, name: "天璇" },
  { x: 138, y: 140, r: 4.2, name: "天玑", highlight: true },
  { x: 150, y: 68, r: 3.2, name: "天权" },
  { x: 232, y: 74, r: 3.8, name: "玉衡" },
  { x: 308, y: 96, r: 3.6, name: "开阳" },
  { x: 372, y: 64, r: 4, name: "摇光" },
];

const EDGES: [number, number][] = [
  [0, 3],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
];

interface ConstellationProps {
  className?: string;
}

/** 北斗七星星座连线，天玑星高亮，呼应"单点知识汇聚成体系"。 */
export default function Constellation({ className = "" }: ConstellationProps) {
  return (
    <svg
      viewBox="0 0 420 200"
      className={className}
      fill="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="nodeGold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fdf6e3" />
          <stop offset="60%" stopColor="#f3c969" />
          <stop offset="100%" stopColor="#d29f3f" />
        </radialGradient>
        <radialGradient id="nodeBlue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eaf6ff" />
          <stop offset="60%" stopColor="#7cc4ff" />
          <stop offset="100%" stopColor="#3d86d6" />
        </radialGradient>
        <filter id="blurGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* 连线 */}
      {EDGES.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="url(#nodeGold)"
          strokeWidth={1.1}
          strokeOpacity={0.55}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.55 }}
          transition={{ duration: 1.2, delay: 0.3 + i * 0.25, ease: "easeInOut" }}
        />
      ))}

      {/* 节点 */}
      {NODES.map((n, i) => (
        <g key={n.name}>
          <motion.circle
            cx={n.x}
            cy={n.y}
            r={n.r * 2.6}
            fill={n.highlight ? "url(#nodeGold)" : "url(#nodeBlue)"}
            opacity={0.18}
            filter="url(#blurGlow)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.18, 0.32, 0.18] }}
            transition={{
              scale: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 },
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 },
            }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
          <motion.circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.highlight ? "url(#nodeGold)" : "url(#nodeBlue)"}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.18, ease: "backOut" }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
          {n.highlight && (
            <motion.text
              x={n.x}
              y={n.y - n.r - 10}
              textAnchor="middle"
              className="font-display"
              fill="#f3c969"
              fontSize={11}
              initial={{ opacity: 0, y: n.y - 2 }}
              animate={{ opacity: 1, y: n.y - n.r - 10 }}
              transition={{ duration: 0.6, delay: 1.6 }}
            >
              天玑
            </motion.text>
          )}
        </g>
      ))}
    </svg>
  );
}
