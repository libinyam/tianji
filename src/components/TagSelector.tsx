import { useState, useEffect, useRef } from "react";
import { X, Loader2, Tag, Wrench, GraduationCap } from "lucide-react";
import { fetchHotTags, searchTags, PRESET_TAGS, CATEGORY_LABEL, type TagInfo } from "@/lib/tags";

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

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
    fetchHotTags(20).then(setHotTags);
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

  // 构建推荐列表：搜索结果优先，否则用热门+预设
  const hasSearch = suggestions.length > 0;
  const hotToolTags = hotTags.filter((t) => t.category === "tool" && !value.includes(t.name));
  const hotSubjectTags = hotTags.filter((t) => (t.category === "subject" || !t.category) && !value.includes(t.name));

  // 预设标签中未被选中的
  const presetTools = PRESET_TAGS.tool.filter((t) => !value.includes(t) && !hotToolTags.some((h) => h.name === t));
  const presetSubjects = PRESET_TAGS.subject.filter((t) => !value.includes(t) && !hotSubjectTags.some((h) => h.name === t));

  const renderTagButton = (name: string, count?: number) => (
    <button
      key={name}
      type="button"
      onClick={() => addTag(name)}
      className="flex items-center gap-1 rounded-full border border-void-600/40 bg-void-800/40 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:border-star-400/40 hover:text-star-200"
    >
      <Tag size={9} />
      {name}
      {count !== undefined && count > 0 && (
        <span className="text-[9px] text-mist-600">{count}</span>
      )}
    </button>
  );

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
        <div className="mt-2 rounded-lg border border-void-600/40 bg-void-900/95 p-2.5 shadow-xl backdrop-blur-xl">
          {loading && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-mist-500">
              <Loader2 size={11} className="animate-spin" /> 搜索中…
            </div>
          )}

          {/* 搜索结果 */}
          {!loading && hasSearch && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.filter((t) => !value.includes(t.name)).slice(0, 8).map((t) =>
                renderTagButton(t.name, t.count)
              )}
            </div>
          )}

          {/* 分组推荐 */}
          {!loading && !hasSearch && (
            <div className="space-y-2.5">
              {/* 工具与部署 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-medium text-star-300">
                  <Wrench size={10} />
                  {CATEGORY_LABEL.tool}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hotToolTags.slice(0, 6).map((t) => renderTagButton(t.name, t.count))}
                  {presetTools.slice(0, 6).map((t) => renderTagButton(t))}
                </div>
              </div>

              {/* 学科 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-medium text-tian-300">
                  <GraduationCap size={10} />
                  {CATEGORY_LABEL.subject}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hotSubjectTags.slice(0, 6).map((t) => renderTagButton(t.name, t.count))}
                  {presetSubjects.slice(0, 6).map((t) => renderTagButton(t))}
                </div>
              </div>
            </div>
          )}

          {!loading && !hasSearch && hotToolTags.length === 0 && hotSubjectTags.length === 0 && presetTools.length === 0 && presetSubjects.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-mist-500">
              输入自定义标签后回车添加
            </div>
          )}
        </div>
      )}
    </div>
  );
}
