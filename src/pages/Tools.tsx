import { Link } from "react-router-dom";
import { Wrench, Download, ArrowUpRight, ArrowLeft } from "lucide-react";
import PageHero from "@/components/PageHero";
import { useSEO } from "@/hooks/useSEO";

interface ToolDef {
  to: string;
  icon: typeof Download;
  title: string;
  desc: string;
  badge?: string;
  available?: boolean;
}

const TOOLS: ToolDef[] = [
  {
    to: "/tools/douyin",
    icon: Download,
    title: "抖音 / TikTok 无水印下载器",
    desc: "粘贴分享链接，一键解析并下载无水印原画视频与图集。支持短链、图集打包、TikTok。",
    badge: "新",
    available: true,
  },
];

export default function Tools() {
  useSEO({
    title: "工具箱",
    description: "天玑工具箱 -- 为学习与创作精选的在线小工具集合。",
    canonical: "https://tianjihub.cn/tools",
  });

  return (
    <>
      <PageHero
        eyebrow="TOOLBOX"
        title="工具箱"
        subtitle="为学习与创作流程精选的在线小工具，持续增加中。"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-mist-400 transition-colors hover:text-tian-500"
        >
          <ArrowLeft size={13} /> 返回讨论区
        </Link>
      </PageHero>

      <section className="container-tj py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const inner = (
              <div className="group flex h-full flex-col rounded-lg border border-void-600 bg-void-800 p-5 transition-colors hover:border-tian-500 hover:bg-void-700">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-void-700 text-tian-500">
                    <Icon size={18} strokeWidth={1.5} />
                  </span>
                  {t.badge && (
                    <span className="rounded-full bg-tian-500/10 px-2 py-0.5 text-[10px] font-medium text-tian-500">
                      {t.badge}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-base font-semibold text-parchment-50">{t.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist-400">{t.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs text-tian-500 transition-colors group-hover:text-tian-600">
                  打开工具 <ArrowUpRight size={13} />
                </span>
              </div>
            );
            return t.available ? (
              <Link key={t.to} to={t.to} className="block h-full">
                {inner}
              </Link>
            ) : (
              <div key={t.to} className="block h-full opacity-60">
                {inner}
              </div>
            );
          })}

          {/* 占位：更多工具即将上线 */}
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-void-600 p-5 text-center">
            <Wrench size={20} className="text-mist-500" />
            <p className="mt-3 text-sm text-mist-400">更多工具持续增加中</p>
            <p className="mt-1 text-xs text-mist-500">有想做的工具？去灵感广场提个想法</p>
          </div>
        </div>
      </section>
    </>
  );
}
