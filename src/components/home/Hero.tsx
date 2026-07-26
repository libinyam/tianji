import { Link } from "react-router-dom";
import { ArrowUpRight, MessageCircle, Lightbulb, Users, FolderGit } from "lucide-react";

export default function Hero() {
  return (
    <section className="container-tj py-10">
      <div className="max-w-2xl">
        <p className="mb-3 text-xs font-medium text-tian-500">
          Tianji &middot; 跨专业 AI 学习与项目共创社区
        </p>

        <h1 className="text-3xl font-semibold leading-tight text-parchment-50 sm:text-4xl">
          从学会理论，到做出真实作品
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-400 sm:text-base">
          天玑，得名于北斗七星之一。无论你来自数学、物理、金融还是计算机，都能在这里从
          <span className="text-parchment-200">只会学理论</span>走向
          <span className="text-parchment-200">能做项目、会协作、能产出</span>——
          整合学习资源与工具教程，求解疑难、交流灵感、协同创作，让每一份专业积累都变成真实可用的作品。
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/" className="btn-primary">
            <MessageCircle size={15} />
            加入讨论
          </Link>
        </div>

        {/* 其余入口（与导航栏一致） */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mist-400">
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-tian-500"
          >
            <ArrowUpRight size={13} /> 资源库
          </Link>
          <Link
            to="/ideas"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-tian-500"
          >
            <Lightbulb size={13} /> 灵感广场
          </Link>
          <Link
            to="/workshop"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-tian-500"
          >
            <Users size={13} /> 协作工坊
          </Link>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-tian-500"
          >
            <FolderGit size={13} /> 作品集
          </Link>
        </div>
      </div>
    </section>
  );
}
