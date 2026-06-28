import { useEffect, useRef, useState } from "react";

/**
 * 草稿自动保存 Hook
 * 将表单状态自动保存到 localStorage，重新打开时恢复。
 *
 * @param key   localStorage 键名
 * @param initial 初始值
 * @returns [value, setValue, clearDraft, restored]
 */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  // 打开时从 localStorage 恢复
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 只有非空内容才恢复
        if (parsed && typeof parsed === "object") {
          const hasContent = Object.values(parsed).some(
            (v) => typeof v === "string" && v.trim().length > 0
          );
          if (hasContent) {
            setValue(parsed);
            setRestored(true);
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
  }, [key]);

  // 防抖保存
  useEffect(() => {
    if (!loaded.current) return;
    // 检查是否有实际内容才保存
    const hasContent =
      typeof value === "object" && value !== null
        ? Object.values(value).some(
            (v) => typeof v === "string" && v.trim().length > 0
          )
        : true;

    if (!hasContent) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // 忽略写入错误（如隐私模式）
      }
    }, 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // 忽略
    }
    setRestored(false);
  };

  const dismissRestored = () => setRestored(false);

  return { value, setValue, clearDraft, restored, dismissRestored } as const;
}
