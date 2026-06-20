import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUpRight, Compass } from "lucide-react";
import Constellation from "@/components/Constellation";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* 装饰辉光 */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(43,102,171,0.22),transparent_65%)]" />
      <div className="pointer-events-none absolute right-[8%] top-[18%] h-72 w-72 rounded-full bg-star-glow opacity-30 blur-3xl" />

      <div className="container-tj relative grid items-center gap-12 py-20 lg:grid-cols-[1.15fr_1fr] lg:py-28">
        {/* 文案 */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex items-center gap-3"
          >
            <Compass className="h-4 w-4 text-star-400" strokeWidth={1.5} />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-mist-300">
              Tianji · 数学专业机器学习社区
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="heading-display text-5xl leading-[1.05] text-parchment-50 sm:text-6xl lg:text-7xl"
          >
            从单点闪光
            <br />
            汇聚成
            <span className="relative ml-3 inline-block text-glow-gold text-star-400">
              完整星图
              <svg
                className="absolute -bottom-3 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 8 Q 80 2 150 6 T 298 5"
                  stroke="#f3c969"
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-8 max-w-xl text-base leading-relaxed text-mist-300 sm:text-lg"
          >
            天玑，得名于北斗七星之一。在这里，数学的严谨推导与人工智能的实践创造相遇——
            <span className="text-parchment-100">共享资源、求解疑难、交流灵感、协同著述</span>
            ，构建连接数学理论与 AI 实践的专业社区生态。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link to="/library" className="btn-gold">
              探索资源库
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/discussion" className="btn-ghost">
              加入讨论
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-12 flex items-center gap-8"
          >
            {[
              { n: "8.6k+", l: "数学同道" },
              { n: "1.3k+", l: "共享书目" },
              { n: "4.7k+", l: "疑难解答" },
            ].map((s) => (
              <div key={s.l}>
                <div className="heading-display text-2xl text-star-300">{s.n}</div>
                <div className="mt-1 text-xs text-mist-400">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* 星座可视化 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="relative"
        >
          <div className="card-surface relative overflow-hidden p-6">
            {/* 坐标网格 */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(#7cc4ff 1px, transparent 1px), linear-gradient(90deg, #7cc4ff 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist-400">
                Ursa Major · 北斗
              </span>
              <span className="font-mono text-[10px] text-star-300">γ UMa · 天玑</span>
            </div>
            <Constellation className="relative mt-2 h-56 w-full" />
            <p className="relative mt-2 text-center font-mono text-[11px] text-mist-500">
              知识星辰，由连线汇聚为体系
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
