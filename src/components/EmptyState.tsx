import { Inbox } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-void-600 bg-void-800 px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-void-700 text-mist-400">
        {icon ?? <Inbox size={24} strokeWidth={1.5} />}
      </div>
      <h3 className="heading-display text-lg text-parchment-50">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist-400">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary mt-5 text-sm">
          {actionText}
        </button>
      )}
    </div>
  );
}
