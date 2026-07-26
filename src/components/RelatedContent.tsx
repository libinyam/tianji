import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Lightbulb, Book, HardHat, ArrowRight } from "lucide-react";
import { fetchRelatedContent, type TagContentItem } from "@/lib/tags";

interface RelatedGroup {
  label: string;
  icon: typeof MessageSquare;
  color: string;
  items: TagContentItem[];
}

export default function RelatedContent({ tags, excludeId }: { tags: string[]; excludeId: string }) {
  const [data, setData] = useState<{
    posts: TagContentItem[];
    ideas: TagContentItem[];
    books: TagContentItem[];
    workshops: TagContentItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tags.length) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      const result = await fetchRelatedContent(tags, excludeId);
      if (mounted) {
        setData(result);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tags, excludeId]);

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-mist-500">
        <div className="h-3 w-3 animate-pulse rounded-full bg-mist-400" />
        正在查找相关内容…
      </div>
    );
  }

  if (!data) return null;

  const groups: RelatedGroup[] = [
    {
      label: "相关讨论",
      icon: MessageSquare,
      color: "text-tian-500",
      items: data.posts,
    },
    {
      label: "相关灵感",
      icon: Lightbulb,
      color: "text-yellow-600",
      items: data.ideas,
    },
    {
      label: "相关资源",
      icon: Book,
      color: "text-emerald-600",
      items: data.books,
    },
    {
      label: "相关协作",
      icon: HardHat,
      color: "text-purple-600",
      items: data.workshops,
    },
  ];

  const visibleGroups = groups.filter((g) => g.items.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-px flex-1 bg-void-600" />
        <span className="text-xs font-medium text-mist-400">跨模块发现</span>
        <div className="h-px flex-1 bg-void-600" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="rounded-lg border border-void-600 bg-void-800 p-4">
            <div className="mb-3 flex items-center gap-2">
              <group.icon size={14} className={group.color} />
              <h4 className="text-xs font-medium text-mist-300">{group.label}</h4>
              <span className="ml-auto text-[10px] text-mist-500">{group.items.length} 条</span>
            </div>
            <div className="space-y-2">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  className="group flex items-start gap-2 rounded-lg p-2 transition-colors hover:bg-void-700"
                >
                  <ArrowRight
                    size={12}
                    className="mt-0.5 shrink-0 text-mist-500 transition-colors group-hover:text-mist-300"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-parchment-100 transition-colors group-hover:text-tian-500">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-mist-500">
                      {item.author} · {item.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
