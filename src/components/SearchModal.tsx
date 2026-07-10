import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, TrendingUp, MessageSquare, Lightbulb, BookOpen, Users, Loader2, Flame } from "lucide-react";
import { searchAll, fetchHotList, type SearchResult, type HotItem } from "@/lib/search";
import Dialog from "./Dialog";

const TYPE_ICON = {
  帖子: MessageSquare,
  灵感: Lightbulb,
  资源: BookOpen,
  协作: Users,
} as const;

const TYPE_COLOR = {
  帖子: "text-sky-400",
  灵感: "text-amber-400",
  资源: "text-emerald-400",
  协作: "text-violet-400",
} as const;

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hotList, setHotList] = useState<HotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // 打开时聚焦输入框 + 加载热门榜
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (hotList.length === 0) {
        fetchHotList().then(setHotList);
      }
    } else {
      // 关闭时重置
      setKeyword("");
      setResults([]);
      setSearched(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 防抖搜索
  const doSearch = useCallback((kw: string) => {
    // 取消上一次请求（包括空输入时也要取消）
    if (searchAbortRef.current) searchAbortRef.current.abort();
    if (!kw.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setLoading(true);
    setSearched(true);
    searchAll(kw, ac.signal)
      .then((res) => {
        if (!ac.signal.aborted) setResults(res.results);
      })
      .catch(() => {
        if (!ac.signal.aborted) setResults([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
  }, []);

  const handleInputChange = (val: string) => {
    setKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (link: string) => {
    onClose();
    navigate(link);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledById="search-dialog-title"
      maxWidthClass="max-w-2xl"
      paddingClass="p-0"
      opaque
    >
      <div className="overflow-hidden rounded-2xl border border-void-600/60 bg-void-900 shadow-2xl">
              {/* 搜索栏 */}
              <div className="flex items-center gap-3 border-b border-void-600/40 px-4 py-3">
                {loading ? (
                  <Loader2 size={18} className="animate-spin text-star-400" />
                ) : (
                  <Search size={18} className="text-mist-500" />
                )}
                <input
                  name="search"
                  id="search-dialog-title"
                  ref={inputRef}
                  value={keyword}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="搜索帖子、灵感、资源、协作…"
                  aria-label="搜索"
                  className="flex-1 bg-transparent text-sm text-parchment-100 outline-none placeholder:text-mist-600"
                />
                <kbd className="hidden rounded border border-void-600 px-1.5 py-0.5 font-mono text-[10px] text-mist-500 sm:inline">
                  ESC
                </kbd>
                <button onClick={onClose} aria-label="关闭" className="text-mist-500 hover:text-parchment-100">
                  <X size={18} />
                </button>
              </div>

              {/* 内容区 */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {/* 搜索结果 */}
                {searched ? (
                  loading ? (
                    <div className="py-12 text-center text-sm text-mist-500">
                      <Loader2 size={20} className="mx-auto mb-2 animate-spin text-star-400" />
                      正在搜索…
                    </div>
                  ) : results.length === 0 ? (
                    <div className="py-12 text-center text-sm text-mist-500">
                      没有找到「{keyword}」相关内容
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="px-3 py-1.5 text-xs text-mist-500">
                        找到 {results.length} 条结果
                      </p>
                      {results.map((r) => {
                        const Icon = TYPE_ICON[r.type];
                        const color = TYPE_COLOR[r.type];
                        return (
                          <button
                            key={`${r.type}-${r.id}`}
                            onClick={() => handleSelect(r.link)}
                            className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-void-800/60"
                          >
                            <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-parchment-100 group-hover:text-star-200">
                                {r.title}
                              </p>
                              {r.excerpt && (
                                <p className="mt-0.5 truncate text-xs text-mist-500">
                                  {r.excerpt}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-mist-600">
                                <span className={color}>{r.type}</span>
                                <span>{r.author}</span>
                                {r.hot > 0 && (
                                  <span className="flex items-center gap-0.5 text-orange-400/80">
                                    <Flame size={10} /> {r.hot}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* 热度榜 */
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-mist-400">
                      <TrendingUp size={14} className="text-orange-400" />
                      全站热榜
                    </div>
                    {hotList.length === 0 ? (
                      <div className="py-8 text-center text-sm text-mist-500">
                        暂无热门内容
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {hotList.map((item, idx) => {
                          const Icon = TYPE_ICON[item.type];
                          const color = TYPE_COLOR[item.type];
                          const rankColor =
                            idx === 0
                              ? "text-orange-400"
                              : idx === 1
                              ? "text-amber-400"
                              : idx === 2
                              ? "text-yellow-500"
                              : "text-mist-600";
                          return (
                            <button
                              key={`${item.type}-${item.id}`}
                              onClick={() => handleSelect(item.link)}
                              className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-void-800/60"
                            >
                              <span className={`w-5 shrink-0 text-center font-mono text-sm font-bold ${rankColor}`}>
                                {idx + 1}
                              </span>
                              <Icon size={14} className={`shrink-0 ${color}`} />
                              <span className="min-w-0 flex-1 truncate text-sm text-parchment-100 group-hover:text-star-200">
                                {item.title}
                              </span>
                              <span className={`shrink-0 text-[10px] ${color}`}>{item.type}</span>
                              {item.hot > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-orange-400/80">
                                  <Flame size={10} /> {item.hot}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
      </div>
    </Dialog>
  );
}
