import { create } from "zustand";
import { auth } from "@/lib/cloudbase";

export interface TianjiUser {
  uid: string;
  email: string | null;
  username: string | null;
  nickname: string | null;
}

type SignUpResult = "otp-sent" | "signed-in";
type VerifyOtpFn = (params: { token: string; messageId?: string }) => Promise<{
  data?: { session?: unknown };
  error?: { message?: string } | null;
}>;

interface AuthState {
  user: TianjiUser | null;
  loading: boolean;
  error: string | null;
  pendingSignUpEmail: string | null;
  pendingSignUpVerifier: VerifyOtpFn | null;
  /** 应用启动时检查会话 */
  initSession: () => Promise<void>;
  /** 邮箱 + 密码注册，CloudBase 会先发送邮箱验证码 */
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult | false>;
  /** 输入邮箱验证码后完成注册并登录 */
  verifySignUpCode: (code: string) => Promise<boolean>;
  /** 邮箱 + 密码登录 */
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  /** GitHub OAuth 登录（跳转授权页） */
  signInWithGitHub: () => Promise<void>;
  /** 退出登录 */
  signOut: () => Promise<void>;
  clearPendingSignUp: () => void;
  clearError: () => void;
}

/** 从 SDK session/user 提取精简用户信息 */
function extractUser(session: unknown): TianjiUser | null {
  if (!session || typeof session !== "object") return null;
  const s = session as Record<string, unknown>;
  const user = (s.user ?? s) as Record<string, unknown> | undefined;
  if (!user || !user.id) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    uid: String(user.id),
    email: (user.email as string) ?? null,
    username: (meta.username as string) ?? null,
    nickname: (meta.nickname as string) ?? (meta.nickName as string) ?? null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  pendingSignUpEmail: null,
  pendingSignUpVerifier: null,

  initSession: async () => {
    set({ loading: true });
    try {
      const { data, error } = await auth.getSession();
      if (error || !data?.session) {
        set({ user: null, loading: false });
        return;
      }
      set({ user: extractUser(data.session), loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  signUpWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await auth.signUp({ email, password });
      if (error) {
        set({ error: error.message, loading: false });
        return false;
      }

      if (data?.verifyOtp) {
        set({
          pendingSignUpEmail: email,
          pendingSignUpVerifier: data.verifyOtp as VerifyOtpFn,
          loading: false,
        });
        return "otp-sent";
      }

      set({
        user: extractUser(data?.session),
        pendingSignUpEmail: null,
        pendingSignUpVerifier: null,
        loading: false,
      });
      return "signed-in";
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  verifySignUpCode: async (code) => {
    set({ loading: true, error: null });
    try {
      const verifier = useAuthStore.getState().pendingSignUpVerifier;
      if (!verifier) {
        set({ error: "请先获取邮箱验证码", loading: false });
        return false;
      }

      const { data, error } = await verifier({ token: code });
      if (error) {
        set({ error: error.message ?? "验证码验证失败", loading: false });
        return false;
      }

      set({
        user: extractUser(data?.session),
        pendingSignUpEmail: null,
        pendingSignUpVerifier: null,
        loading: false,
      });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: error.message, loading: false });
        return false;
      }
      set({ user: extractUser(data?.session), loading: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  signInWithGitHub: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await auth.signInWithOAuth({ provider: "github" });
      if (error) {
        set({ error: error.message, loading: false });
        return;
      }
      // 跳转到 GitHub 授权页面，回调后 detectSessionInUrl 会自动处理会话
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  signOut: async () => {
    try {
      await auth.signOut();
    } finally {
      set({
        user: null,
        error: null,
        pendingSignUpEmail: null,
        pendingSignUpVerifier: null,
      });
    }
  },

  clearPendingSignUp: () =>
    set({ pendingSignUpEmail: null, pendingSignUpVerifier: null }),

  clearError: () => set({ error: null }),
}));
