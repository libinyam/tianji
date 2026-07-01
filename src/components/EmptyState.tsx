import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-void-600/50 bg-void-800/20 px-6 py-20 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-void-700/50 text-mist-400">
        {icon ?? <Sparkles size={28} strokeWidth={1.5} />}
      </div>
      <h3 className="heading-display text-xl text-parchment-50">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist-400">
        {description}
      </p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-gold mt-6 text-sm">
          {actionText}
        </button>
      )}
    </motion.div>
  );
}
