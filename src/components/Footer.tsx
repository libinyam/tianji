import { Link } from "react-router-dom";
import { Sparkles, GitBranch, Mail } from "lucide-react";

const MODULES = [
  { to: "/", label: "讨论区" },
  { to: "/library", label: "资源库" },
  { to: "/ideas", label: "灵感广场" },
  { to: "/workshop", label: "协作工坊" },
  { to: "/portfolio", label: "作品集" },
  { to: "/growth", label: "成长路径" },
  { to: "/about", label: "关于天玑" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-void-600 bg-void-700">
      <div className="container-tj py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* 品牌 */}
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-star-400" strokeWidth={1.75} />
              <span className="text-base font-semibold tracking-tight text-parchment-50">天玑</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-mist-400">
              跨专业 AI
              学习与项目共创社区。从学习资源到项目作品的完整链路：学习、答疑、灵感、协作、作品集。
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://github.com/libinyam/tianji"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mist-400 transition-colors hover:text-parchment-100"
                aria-label="GitHub"
              >
                <GitBranch size={16} />
              </a>
              <a
                href="mailto:contact@tianjihub.cn"
                className="text-mist-400 transition-colors hover:text-parchment-100"
                aria-label="邮箱"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {/* 模块链接 */}
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <li key={m.to}>
                <Link
                  to={m.to}
                  className="text-sm text-mist-400 transition-colors hover:text-tian-500"
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-void-600 pt-5 text-xs text-mist-500 sm:flex-row">
          <p>© 2025 天玑 Tianji · 跨专业 AI 学习与项目共创社区</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://beian.miit.gov.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-mist-300"
            >
              鲁ICP备2026036314号
            </a>
            <a
              href="https://www.beian.mps.gov.cn/register/toRecord?recordcode=37021302001499"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-mist-300"
            >
              鲁公网安备37021302001499号
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
