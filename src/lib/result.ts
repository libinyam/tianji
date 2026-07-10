/**
 * 统一的 API 返回类型
 * 所有业务读函数应返回此结构，UI 可据此区分「无数据」「加载失败」
 */
export type Result<T> = {
  data: T | null;
  error: string | null;
};

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function err<T = null>(message: string): Result<T> {
  return { data: null, error: message };
}
