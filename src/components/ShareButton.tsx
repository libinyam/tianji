import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";

interface ShareButtonProps {
  title: string;
  path: string;
}

/**
 * 社交分享按钮：复制链接 / Twitter / 微博
 * 轻量弹出，点击外部关闭。
 */
export default function ShareButton({ title, path }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = `https://tianjihub.cn${path}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-mist-400 transition-colors hover:text-star-300"
        title="分享"
        aria-label="分享"
      >
        <Share2 size={13} /> 分享
      </button>

      {open && (
        <>
          {/* 点击外部关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-void-600/60 bg-void-900 shadow-xl">
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-mist-300 transition-colors hover:bg-void-700/60"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? "已复制" : "复制链接"}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-mist-300 transition-colors hover:bg-void-700/60"
            >
              <MessageCircle size={14} /> Twitter
            </a>
            <a
              href={`https://service.weibo.com/share/share.php?title=${encodedTitle}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-mist-300 transition-colors hover:bg-void-700/60"
            >
              <span className="text-xs font-bold text-red-400">微</span> 微博
            </a>
          </div>
        </>
      )}
    </div>
  );
}
