import cloudbase from "@cloudbase/js-sdk";

// CloudBase 环境配置 - 从环境变量读取，避免硬编码
// 注意：accessKey 是 CloudBase 设计上可公开的客户端 key（类似 Firebase apiKey），
// 会随 bundle 暴露给所有用户。权限由 CloudBase Auth + 数据库安全规则控制。
// 切勿在此填入服务端密钥（TCB_SECRET_ID / TCB_SECRET_KEY）。
const ENV_ID = import.meta.env.VITE_CLOUDBASE_ENV_ID as string;
const REGION = (import.meta.env.VITE_CLOUDBASE_REGION as string) || "ap-shanghai";
const ACCESS_KEY = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY as string;

if (!ENV_ID || !ACCESS_KEY) {
  console.error(
    "CloudBase 环境变量未配置！请在 Vercel/GitHub Secrets 中设置:\n" +
    "VITE_CLOUDBASE_ENV_ID\n" +
    "VITE_CLOUDBASE_ACCESS_KEY\n" +
    "VITE_CLOUDBASE_REGION=ap-shanghai"
  );
}

/** CloudBase 应用单例 */
const app = cloudbase.init({
  env: ENV_ID,
  region: REGION,
  accessKey: ACCESS_KEY,
  auth: { detectSessionInUrl: true },
});

/** Auth 实例，本地持久化登录态 */
const auth = app.auth({ persistence: "local" });

/**
 * #345 authReady：确保匿名身份/SDK 初始化完成后再发数据库请求。
 * 新访客首次访问时，Layout 的 useEffect 调 initSession() 之前子组件可能已
 * 开始查询，匿名身份未就绪导致 401。此 promise 在模块加载时即启动，
 * 被 posts.ts/ideas.ts 等 lib 的查询函数 await。
 */
let _resolve: () => void = () => {};
export const authReady: Promise<void> = new Promise((resolve) => {
  _resolve = resolve;
});

async function ensureAuthReady() {
  try {
    const { data, error } = await auth.getSession();
    if (error || !data?.session) {
      // 无会话则匿名登录（accessKey 模式下也能读取公开数据）
      try {
        await auth.signInAnonymously();
      } catch {
        // 匿名登录失败也放行，accessKey 模式下仍可读取
      }
    }
  } catch {
    // getSession 失败也放行
  } finally {
    _resolve();
  }
}

void ensureAuthReady();

export { app, auth, ENV_ID };
