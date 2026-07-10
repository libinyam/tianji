import { create } from "zustand";
import { auth } from "@/lib/cloudbase";
import { sanitizeInput } from "@/lib/sanitize";

export interface TianjiUser {
  uid: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
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
  /** 发送手机验证码 */
  sendPhoneCode: (phone: string) => Promise<boolean>;
  /** 手机号验证码注册 */
  signUpWithPhone: (phone: string, code: string, password: string) => Promise<boolean>;
  /** 手机号验证码登录 */
  signInWithPhoneCode: (phone: string, code: string) => Promise<boolean>;
  /** 手机号密码登录 */
  signInWithPhonePassword: (phone: string, password: string) => Promise<boolean>;
  /** GitHub OAuth 登录（跳转授权页） */
  signInWithGitHub: () => Promise<void>;
  /** 退出登录 */
  signOut: () => Promise<void>;
  /** 更新用户资料（昵称、头像） */
  updateProfile: (data: { nickname?: string; avatarUrl?: string }) => Promise<boolean>;
  clearPendingSignUp: () => void;
  clearError: () => void;
}

/** 规范化手机号为 +86 前缀格式，并校验格式 */
function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!/^1\d{10}$/.test(trimmed)) {
    throw new Error("手机号格式不正确，需为以 1 开头的 11 位数字");
  }
  return `+86${trimmed}`;
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
    phone: (user.phone as string) ?? null,
    username: (meta.username as string) ?? null,
    nickname: (meta.nickname as string) ?? (meta.nickName as string) ?? null,
    avatarUrl: (meta.avatarUrl as string) ?? (meta.avatar_url as string) ?? null,
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
        // 未登录时自动匿名登录，让未登录用户也能读取公开数据
        // 匿名登录只用于获取 auth 上下文以查询数据库，UI 仍显示未登录状态
        try {
          await auth.signInAnonymously();
        } catch {
          // 匿名登录失败也不阻塞，accessKey 模式下仍可读取
        }
        set({ user: null, loading: false });
        return;
      }
      // 已有真实登录会话
      const extractedUser = extractUser(data.session);
      // 匿名用户的 session 也当做未登录（刷新后恢复匿名会话的情况）
      if (extractedUser && !extractedUser.email && !extractedUser.phone && !extractedUser.username) {
        set({ user: null, loading: false });
        return;
      }
      set({ user: extractedUser, loading: false });
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

  sendPhoneCode: async (phone) => {
    set({ loading: true, error: null });
    try {
      await auth.sendPhoneCode(normalizePhone(phone));
      set({ loading: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  signUpWithPhone: async (phone, code, password) => {
    set({ loading: true, error: null });
    try {
      await auth.signUpWithPhoneCode(normalizePhone(phone), code, password);
      const { data, error } = await auth.getSession();
      if (error || !data?.session) {
        set({ error: error?.message ?? "注册成功但获取会话失败", loading: false });
        return false;
      }
      set({ user: extractUser(data.session), loading: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  signInWithPhoneCode: async (phone, code) => {
    set({ loading: true, error: null });
    try {
      await auth.signInWithPhoneCodeOrPassword({
        phoneNumber: normalizePhone(phone),
        phoneCode: code,
      });
      const { data, error } = await auth.getSession();
      if (error || !data?.session) {
        set({ error: error?.message ?? "登录成功但获取会话失败", loading: false });
        return false;
      }
      set({ user: extractUser(data.session), loading: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  signInWithPhonePassword: async (phone, password) => {
    set({ loading: true, error: null });
    try {
      await auth.signInWithPhoneCodeOrPassword({
        phoneNumber: normalizePhone(phone),
        password,
      });
      const { data, error } = await auth.getSession();
      if (error || !data?.session) {
        set({ error: error?.message ?? "登录成功但获取会话失败", loading: false });
        return false;
      }
      set({ user: extractUser(data.session), loading: false });
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
    } catch {
      // 忽略登出错误
    } finally {
      set({
        user: null,
        error: null,
        pendingSignUpEmail: null,
        pendingSignUpVerifier: null,
      });
      // 退出后重新匿名登录，保持 auth 上下文以读取公开数据
      try {
        await auth.signInAnonymously();
      } catch {
        // 匿名登录失败也不影响
      }
    }
  },

  updateProfile: async (data) => {
    set({ loading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (data.nickname !== undefined) params.nickname = sanitizeInput(data.nickname, 50);
      if (data.avatarUrl !== undefined) params.avatar_url = data.avatarUrl;

      await auth.updateUser(params);

      // 直接用本地状态更新，不重新 getSession（updateUser 后 token 可能正在刷新，
      // 重新获取会话可能返回空导致用户状态丢失）
      set((state) => ({
        user: state.user
          ? {
              ...state.user,
              nickname: data.nickname ?? state.user.nickname,
              avatarUrl: data.avatarUrl ?? state.user.avatarUrl,
            }
          : state.user,
        loading: false,
      }));
      return true;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return false;
    }
  },

  clearPendingSignUp: () =>
    set({ pendingSignUpEmail: null, pendingSignUpVerifier: null }),

  clearError: () => set({ error: null }),
}));
