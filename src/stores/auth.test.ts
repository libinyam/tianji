import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  sendPhoneCode: vi.fn(),
  signUpWithPhoneCode: vi.fn(),
  signInWithPhoneCodeOrPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/cloudbase", () => ({ auth: mockAuth }));

vi.mock("@/lib/sanitize", () => ({
  sanitizeInput: (text: string) => text,
}));

import { useAuthStore } from "./auth";

const validSession = {
  user: {
    id: "uid-123",
    email: "test@example.com",
    phone: null,
    user_metadata: {
      username: "tester",
      nickname: "Tester",
      avatarUrl: "https://example.com/a.png",
    },
  },
};

const fakeUser = {
  uid: "uid-123",
  email: "test@example.com",
  phone: null,
  username: "tester",
  nickname: "Tester",
  avatarUrl: "https://example.com/a.png",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      loading: false,
      error: null,
      pendingSignUpEmail: null,
      pendingSignUpVerifier: null,
    });
    vi.resetAllMocks();
  });

  describe("初始状态", () => {
    it("user 为 null，loading 为 false", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("signUpWithEmail", () => {
    it("成功（直接登录）：设置 user 并返回 signed-in", async () => {
      mockAuth.signUp.mockResolvedValue({ data: { session: validSession }, error: null });
      const result = await useAuthStore.getState().signUpWithEmail("a@b.com", "pass");
      expect(result).toBe("signed-in");
      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("成功（需验证码）：返回 otp-sent 并暂存邮箱与验证器", async () => {
      const verifyOtp = vi.fn();
      mockAuth.signUp.mockResolvedValue({ data: { verifyOtp }, error: null });
      const result = await useAuthStore.getState().signUpWithEmail("a@b.com", "pass");
      expect(result).toBe("otp-sent");
      const state = useAuthStore.getState();
      expect(state.pendingSignUpEmail).toBe("a@b.com");
      expect(state.pendingSignUpVerifier).toBe(verifyOtp);
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });

    it("失败（抛错）：设置 error 并返回 false", async () => {
      mockAuth.signUp.mockRejectedValue(new Error("网络错误"));
      const result = await useAuthStore.getState().signUpWithEmail("a@b.com", "pass");
      expect(result).toBe(false);
      const state = useAuthStore.getState();
      expect(state.error).toBe("网络错误");
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });

    it("失败（返回 error）：设置 error 并返回 false", async () => {
      mockAuth.signUp.mockResolvedValue({ data: null, error: { message: "邮箱已注册" } });
      const result = await useAuthStore.getState().signUpWithEmail("a@b.com", "pass");
      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("邮箱已注册");
    });
  });

  describe("signInWithEmail", () => {
    it("成功：设置 user 并返回 true", async () => {
      mockAuth.signInWithPassword.mockResolvedValue({ data: { session: validSession }, error: null });
      const result = await useAuthStore.getState().signInWithEmail("a@b.com", "pass");
      expect(result).toBe(true);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("失败（抛错）：设置 error 并返回 false", async () => {
      mockAuth.signInWithPassword.mockRejectedValue(new Error("密码错误"));
      const result = await useAuthStore.getState().signInWithEmail("a@b.com", "pass");
      expect(result).toBe(false);
      const state = useAuthStore.getState();
      expect(state.error).toBe("密码错误");
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });

    it("失败（返回 error）：设置 error 并返回 false", async () => {
      mockAuth.signInWithPassword.mockResolvedValue({ data: null, error: { message: "凭据无效" } });
      const result = await useAuthStore.getState().signInWithEmail("a@b.com", "pass");
      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("凭据无效");
    });
  });

  describe("signOut", () => {
    it("成功：清空用户状态并重新匿名登录", async () => {
      useAuthStore.setState({ user: fakeUser });
      mockAuth.signOut.mockResolvedValue(undefined);
      mockAuth.signInAnonymously.mockResolvedValue(undefined);
      await useAuthStore.getState().signOut();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
      expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it("失败：仍清空用户状态并尝试匿名登录", async () => {
      useAuthStore.setState({ user: fakeUser });
      mockAuth.signOut.mockRejectedValue(new Error("登出失败"));
      mockAuth.signInAnonymously.mockResolvedValue(undefined);
      await useAuthStore.getState().signOut();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1);
    });
  });

  describe("initSession", () => {
    it("有 session：恢复用户状态", async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: validSession }, error: null });
      await useAuthStore.getState().initSession();
      const state = useAuthStore.getState();
      expect(state.user).toEqual(fakeUser);
      expect(state.loading).toBe(false);
    });

    it("无 session：用户状态为空", async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
      mockAuth.signInAnonymously.mockResolvedValue(undefined);
      await useAuthStore.getState().initSession();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it("返回 error：用户状态为空", async () => {
      mockAuth.getSession.mockResolvedValue({ data: null, error: { message: "会话过期" } });
      mockAuth.signInAnonymously.mockResolvedValue(undefined);
      await useAuthStore.getState().initSession();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("手机号注册无 nickname：生成默认昵称并持久化", async () => {
      // 模拟手机号注册用户：phone 有值，user_metadata 无 nickname
      const phoneSession = {
        user: {
          id: "uid-phone",
          email: null,
          phone: "13800138000",
          user_metadata: { username: "13800138000" },
        },
      };
      mockAuth.getSession.mockResolvedValue({ data: { session: phoneSession }, error: null });
      mockAuth.updateUser.mockResolvedValue({});
      await useAuthStore.getState().initSession();
      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.nickname).toMatch(/^小星辰[a-z0-9]{4}$/);
      expect(mockAuth.updateUser).toHaveBeenCalledWith({ nickname: state.user?.nickname });
    });

    it("邮箱注册无 nickname：生成默认昵称并持久化", async () => {
      // 模拟邮箱注册用户：email 有值，user_metadata 无 nickname
      const emailSession = {
        user: {
          id: "uid-email",
          email: "newbie@example.com",
          phone: null,
          user_metadata: {},
        },
      };
      mockAuth.getSession.mockResolvedValue({ data: { session: emailSession }, error: null });
      mockAuth.updateUser.mockResolvedValue({});
      await useAuthStore.getState().initSession();
      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.nickname).toMatch(/^小星辰[a-z0-9]{4}$/);
      expect(mockAuth.updateUser).toHaveBeenCalledWith({ nickname: state.user?.nickname });
    });

    it("已有 nickname：不生成默认昵称", async () => {
      mockAuth.getSession.mockResolvedValue({ data: { session: validSession }, error: null });
      mockAuth.updateUser.mockClear();
      await useAuthStore.getState().initSession();
      expect(mockAuth.updateUser).not.toHaveBeenCalled();
    });
  });
});
