import { motion } from "motion/react";

const ITEMS = [
  { k: "严谨", v: "以数学推导为骨，拒绝含糊其辞" },
  { k: "实践", v: "以代码与模型为肉，理论落地生根" },
  { k: "协同", v: "以共笔与讨论为径，孤星连成星座" },
];

export default function VisionBand() {
  return (
    <section className="relative overflow-hidden border-y border-void-600/30 bg-void-900/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(243,201,105,0.06),transparent_70%)]" />
      <div className="container-tj relative py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="heading-display text-2xl leading-relaxed text-parchment-100 sm:text-3xl">
            “我们相信，数学不是人工智能的<span className="text-mist-500">注脚</span>，
            而是它的<span className="text-glow-gold text-star-300">母语</span>。”
          </p>
        </motion.div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {ITEMS.map((it, i) => (
            <motion.div
              key={it.k}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="text-center"
            >
              <div className="heading-display text-3xl text-star-400">{it.k}</div>
              <div className="mt-2 text-sm text-mist-300">{it.v}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
