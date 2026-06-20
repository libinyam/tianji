import { motion } from "motion/react";
import { BookText, FileText, Users, Clock } from "lucide-react";
import type { Doc } from "@/types";

export default function DocCard({ doc, index = 0 }: { doc: Doc; index?: number }) {
  const Icon = doc.type === "教材" ? BookText : FileText;
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.08 }}
      className="group flex flex-col rounded-xl border border-void-600/40 bg-void-800/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-star-400/40 hover:bg-void-700/40"
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg border"
          style={{
            borderColor: `${doc.accent}55`,
            background: `${doc.accent}14`,
            color: doc.accent,
          }}
        >
          <Icon size={18} strokeWidth={1.5} />
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{ background: `${doc.accent}1f`, color: doc.accent }}
        >
          {doc.type}
        </span>
      </div>

      <h3 className="mt-4 heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
        {doc.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-mist-300">{doc.description}</p>

      {/* 进度 */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-mist-500">完成进度</span>
          <span className="font-mono text-star-300">{doc.progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-void-600/50">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${doc.progress}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${doc.accent}, ${doc.accent}88)`,
            }}
          />
        </div>
      </div>

      {/* 底部信息 */}
      <div className="mt-5 flex items-center justify-between border-t border-void-600/30 pt-4">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {doc.contributors.slice(0, 4).map((c, ci) => (
              <span
                key={ci}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-void-800 font-display text-[10px] text-void-900"
                style={{
                  background: `linear-gradient(135deg, ${doc.contributorColors[ci]}, ${doc.contributorColors[ci]}aa)`,
                }}
                title={c}
              >
                {c.charAt(0)}
              </span>
            ))}
            {doc.contributors.length > 4 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-void-800 bg-void-700 text-[10px] text-mist-300">
                +{doc.contributors.length - 4}
              </span>
            )}
          </div>
          <span className="ml-2.5 flex items-center gap-1 text-xs text-mist-400">
            <Users size={11} /> {doc.contributors.length}
          </span>
        </div>
        <span className="flex items-center gap-1 font-mono text-[10px] text-mist-500">
          <Clock size={10} /> {doc.updatedAt}
        </span>
      </div>
    </motion.div>
  );
}
