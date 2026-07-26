const ITEMS = [
  { k: "路径", v: "清晰的学习路线，告别盲目试错" },
  { k: "实战", v: "从工具配置到项目落地，边学边做" },
  { k: "协作", v: "以共笔与共创为径，把个人积累变成共同作品" },
];

export default function VisionBand() {
  return (
    <section className="border-y border-void-600 bg-void-700">
      <div className="container-tj py-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="heading-display text-xl leading-relaxed text-parchment-100 sm:text-2xl">
            "每一份专业积累，都不该止于考卷——它值得成为一个
            <span className="font-semibold text-parchment-50">真实可用的作品</span>。"
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-3">
          {ITEMS.map((it) => (
            <div key={it.k} className="text-center">
              <div className="heading-display text-xl text-parchment-100">{it.k}</div>
              <div className="mt-1.5 text-sm text-mist-400">{it.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
