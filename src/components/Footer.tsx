import { Link } from "react-router-dom";
import { Sparkles, GitBranch, Mail, BookOpen } from "lucide-react";
import Constellation from "./Constellation";

const MODULES = [
  { to: "/", label: "讨论区" },
  { to: "/library", label: "资源库" },
  { to: "/ideas", label: "灵感广场" },
  { to: "/workshop", label: "协作工坊" },
  { to: "/about", label: "关于天玑" },
];

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-void-600/40 bg-void-950/60">
      <div className="container-tj py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* 品牌 */}
          <div>
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-star-400" strokeWidth={1.5} />
              <span className="heading-display text-xl text-parchment-50">
                天<span className="text-star-400">玑</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist-400">
              得名于北斗七星之天玑星。无论你来自数学、物理、金融还是计算机，都能在这里从只会学理论，走向能做项目、会协作、能产出。让每一份专业积累，都汇聚成真实可用的作品。
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://github.com/libinyam/tianji"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-void-600/60 text-mist-400 transition-colors hover:border-star-400/50 hover:text-star-300"
                aria-label="GitHub"
              >
                <GitBranch size={16} />
              </a>
              <a
                href="mailto:contact@tianjihub.cn"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-void-600/60 text-mist-400 transition-colors hover:border-star-400/50 hover:text-star-300"
                aria-label="邮箱"
              >
                <Mail size={16} />
              </a>
              <Link
                to="/library"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-void-600/60 text-mist-400 transition-colors hover:border-star-400/50 hover:text-star-300"
                aria-label="资源库"
              >
                <BookOpen size={16} />
              </Link>
            </div>
          </div>

          {/* 模块 */}
          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
              核心模块
            </h4>
            <ul className="mt-4 space-y-2.5">
              {MODULES.map((m) => (
                <li key={m.to}>
                  <Link
                    to={m.to}
                    className="text-sm text-mist-400 transition-colors hover:text-parchment-100"
                  >
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 星座装饰 */}
          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
              北斗 · 天玑
            </h4>
            <Constellation className="mt-4 h-28 w-full" />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-void-600/40 pt-6 text-xs text-mist-500 sm:flex-row">
          <p>© 2025 天玑 Tianji · 跨专业 AI 学习与项目共创社区</p>
          <div className="flex items-center gap-4">
            <p className="font-mono">从单点闪光，到完整星图</p>
            <a
              href="https://beian.miit.gov.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mist-500 transition-colors hover:text-mist-300"
            >
              鲁ICP备2026036314号
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
