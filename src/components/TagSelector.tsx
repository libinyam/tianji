import { useState, useEffect, useRef } from "react";
import { X, Loader2, Tag } from "lucide-react";
import { fetchHotTags, searchTags, type TagInfo } from "@/lib/tags";

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

const DEFAULT_SUGGESTED = [
  "数学", "物理", "编程", "文学", "哲学", "艺术", "历史", "经济",
  "人工智能", "机器学习", "数据科学", "算法", "考研", "论文", "读书笔记",
];

export default function TagSelector({
  value,
  onChange,
  maxTags = 5,
}: TagSelectorProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagInfo[]>([]);
  const [hotTags, setHotTags] = useState<TagInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载热门标签
  useEffect(() => {
    fetchHotTags(15).then(setHotTags);
  }, []);

  // 输入时搜索补全（防抖）
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchTags(input).then((res) => {
        setSuggestions(res);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed) && value.length < maxTags) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input);
      setShowDropdown(false);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  // 合并推荐：搜索结果 + 热门标签 + 默认标签，去重
  const recommended = [
    ...suggestions,
    ...hotTags.filter((h) => !suggestions.some((s) => s.name === h.name)),
  ]
    .filter((t) => !value.includes(t.name))
    .slice(0, 8);

  const fallback = DEFAULT_SUGGESTED.filter((t) => !value.includes(t)).slice(0, 8);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap gap-2">
        {value.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full border border-tian-400/40 bg-tian-400/10 px-2.5 py-1 text-xs text-tian-100"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="ml-0.5 text-mist-500 hover:text-red-300"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <div className="relative min-w-[120px] flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length < maxTags ? "输入标签后回车" : ""}
            disabled={value.length >= maxTags}
            className="w-full rounded-full border border-void-600/50 bg-void-950/50 px-3 py-1 text-xs text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none disabled:opacity-40"
          />
        </div>
      </div>

      {/* 下拉推荐 */}
      {showDropdown && value.length < maxTags && (
        <div className="mt-2 rounded-lg border border-void-600/40 bg-void-900/95 p-2 shadow-xl backdrop-blur-xl">
          {loading && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-mist-500">
              <Loader2 size={11} className="animate-spin" /> 搜索中…
            </div>
          )}
          {!loading && (recommended.length > 0 || fallback.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {(recommended.length > 0 ? recommended.map((t) => t.name) : fallback).map((t) => {
                const tagInfo = recommended.find((r) => r.name === t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="flex items-center gap-1 rounded-full border border-void-600/40 bg-void-800/40 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:border-star-400/40 hover:text-star-200"
                  >
                    <Tag size={9} />
                    {t}
                    {tagInfo && tagInfo.count > 0 && (
                      <span className="text-[9px] text-mist-600">{tagInfo.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {!loading && recommended.length === 0 && fallback.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-mist-500">
              输入自定义标签后回车添加
            </div>
          )}
        </div>
      )}
    </div>
  );
}
