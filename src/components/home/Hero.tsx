import { Link } from "react-router-dom";
import { ArrowUpRight, Compass } from "lucide-react";

export default function Hero() {
  return (
    <section className="container-tj py-16 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* 文案 */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Compass className="h-4 w-4 text-star-400" strokeWidth={1.5} />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist-400">
              Tianji &middot; 跨专业 AI 学习与项目共创社区
            </span>
          </div>

          <h1 className="heading-display text-4xl leading-[1.1] text-parchment-50 sm:text-5xl lg:text-6xl">
            从单点闪光
            <br />
            汇聚成<span className="text-star-400">完整星图</span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-mist-400 sm:text-base">
            天玑，得名于北斗七星之一。无论你来自数学、物理、金融还是计算机，都能在这里从
            <span className="text-parchment-200">只会学理论</span>走向
            <span className="text-parchment-200">能做项目、会协作、能产出</span>——
            整合学习资源与工具教程，求解疑难、交流灵感、协同创作，让每一份专业积累都变成真实可用的作品。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/library" className="btn-gold">
              探索资源库
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/discussion" className="btn-ghost">
              加入讨论
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-8">
            {[
              { n: "8.6k+", l: "跨界学习者" },
              { n: "1.3k+", l: "学习资源" },
              { n: "4.7k+", l: "疑难解答" },
            ].map((s) => (
              <div key={s.l}>
                <div className="heading-display text-xl text-star-300">{s.n}</div>
                <div className="mt-0.5 text-xs text-mist-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 星座可视化 - 精简：静态 SVG + 去网格去辉光 */}
        <div className="card-surface relative overflow-hidden p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400">
              Ursa Major &middot; 北斗
            </span>
            <span className="font-mono text-[10px] text-star-300">&gamma; UMa &middot; 天玑</span>
          </div>
          <ConstellationStatic className="mt-2 h-48 w-full" />
          <p className="mt-2 text-center font-mono text-[10px] text-mist-500">
            知识星辰，由连线汇聚为体系
          </p>
        </div>
      </div>
    </section>
  );
}

/** 静态版北斗七星 — 无 motion，纯 SVG */
function ConstellationStatic({ className = "" }: { className?: string }) {
  const NODES = [
    { x: 50, y: 55, r: 4, name: "天枢" },
    { x: 52, y: 132, r: 3.4, name: "天璇" },
    { x: 138, y: 140, r: 4.2, name: "天玑", highlight: true },
    { x: 150, y: 68, r: 3.2, name: "天权" },
    { x: 232, y: 74, r: 3.8, name: "玉衡" },
    { x: 308, y: 96, r: 3.6, name: "开阳" },
    { x: 372, y: 64, r: 4, name: "摇光" },
  ];

  const EDGES: [number, number][] = [
    [0, 3], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  ];

  return (
    <svg viewBox="0 0 420 200" className={className} fill="none" aria-hidden>
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
      </defs>

      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a].x} y1={NODES[a].y}
          x2={NODES[b].x} y2={NODES[b].y}
          stroke="#f3c969"
          strokeWidth={1}
          strokeOpacity={0.4}
        />
      ))}

      {NODES.map((n) => (
        <g key={n.name}>
          <circle cx={n.x} cy={n.y} r={n.r * 2} fill={n.highlight ? "url(#nodeGold)" : "url(#nodeBlue)"} opacity={0.12} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.highlight ? "url(#nodeGold)" : "url(#nodeBlue)"} />
          {n.highlight && (
            <text x={n.x} y={n.y - n.r - 10} textAnchor="middle" className="font-display" fill="#f3c969" fontSize={11}>
              天玑
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
