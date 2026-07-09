import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCheck, MessageCircle, ThumbsUp, Users, CornerDownRight, Lightbulb, MessageSquare, CheckCircle } from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllRead,
  getTypeLabel,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  answer: MessageSquare,
  comment: CornerDownRight,
  resonance: ThumbsUp,
  join: Users,
  contribute: Lightbulb,
  accept: CheckCircle,
};

function formatTime(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return d.toISOString().slice(0, 10);
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // 定时拉取未读数
  useEffect(() => {
    let mounted = true;
    const safeSetUnread = (n: number) => { if (mounted) setUnread(n); };
    fetchUnreadCount().then(safeSetUnread);
    const timer = setInterval(() => {
      fetchUnreadCount().then(safeSetUnread);
    }, 60000); // 每分钟刷新
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  // 打开时加载列表
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    fetchNotifications().then((items) => {
      if (!mounted) return;
      setList(items);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [open]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markAsRead(item.id);
      if (!mountedRef.current) return;
      setUnread((n) => Math.max(0, n - 1));
      setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    setOpen(false);
    navigate(item.link);
  };

  const handleMarkAll = async () => {
    await markAllRead();
    if (!mountedRef.current) return;
    setUnread(0);
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-void-600/50 bg-void-800/40 text-mist-400 transition-colors hover:border-star-400/40 hover:text-star-300"
        title="通知"
        aria-label="通知"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-void-600/60 bg-void-900/95 shadow-2xl backdrop-blur-xl"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-void-600/40 px-4 py-2.5">
              <span className="text-xs font-medium text-parchment-100">通知</span>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-[10px] text-mist-400 transition-colors hover:text-star-300"
                >
                  <CheckCheck size={11} /> 全部已读
                </button>
              )}
            </div>

            {/* 列表 */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center text-xs text-mist-500">加载中…</div>
              ) : list.length === 0 ? (
                <div className="py-10 text-center text-xs text-mist-500">
                  <Bell size={20} className="mx-auto mb-2 opacity-40" />
                  暂无通知
                </div>
              ) : (
                list.map((item) => {
                  const Icon = TYPE_ICON[item.type] ?? MessageCircle;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleClick(item)}
                      className={`flex w-full items-start gap-2.5 border-b border-void-600/20 px-4 py-3 text-left transition-colors hover:bg-void-800/50 ${
                        !item.read ? "bg-star-400/5" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          !item.read ? "bg-star-400/15 text-star-300" : "bg-void-700/50 text-mist-400"
                        }`}
                      >
                        <Icon size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-parchment-100">
                          <span className="font-medium">{item.actor}</span>
                          <span className="text-mist-400"> {getTypeLabel(item.type)}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-mist-500">{item.title}</p>
                        <p className="mt-0.5 text-[10px] text-mist-600">{formatTime(item.createdAt)}</p>
                      </div>
                      {!item.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
