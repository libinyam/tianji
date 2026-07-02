import cloudbase from "@cloudbase/js-sdk";

// CloudBase 环境配置 — 从环境变量读取，避免硬编码
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

export { app, auth, ENV_ID };
