import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Lock, Sparkles, Loader2, Github, ShieldCheck, Phone } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import CanvasCaptcha, { type CanvasCaptchaHandle } from "@/components/CanvasCaptcha";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "login" | "register";
type LoginMethod = "email" | "phone";
type PhoneLoginType = "code" | "password";

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [phoneLoginType, setPhoneLoginType] = useState<PhoneLoginType>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const captchaRef = useRef<CanvasCaptchaHandle>(null);
  const [phone, setPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCaptchaValue, setPhoneCaptchaValue] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const phoneCaptchaRef = useRef<CanvasCaptchaHandle>(null);
  const {
    signUpWithEmail,
    verifySignUpCode,
    signInWithEmail,
    signInWithGitHub,
    sendPhoneCode,
    signUpWithPhone,
    signInWithPhoneCode,
    signInWithPhonePassword,
    loading,
    error,
    pendingSignUpEmail,
    clearPendingSignUp,
    clearError,
  } = useAuthStore();

  const waitingForCode = mode === "register" && Boolean(pendingSignUpEmail);

  // 邮箱重发冷却倒计时
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((n) => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 手机号重发冷却倒计时
  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((n) => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 手机号流程
    if (loginMethod === "phone") {
      if (mode === "register") {
        const ok = await signUpWithPhone(phone, phoneCode, phonePassword);
        if (ok) handleClose();
        else {
          phoneCaptchaRef.current?.refresh();
          setPhoneCaptchaValue("");
        }
      } else if (phoneLoginType === "password") {
        const ok = await signInWithPhonePassword(phone, phonePassword);
        if (ok) handleClose();
      } else {
        const ok = await signInWithPhoneCode(phone, phoneCode);
        if (ok) handleClose();
      }
      return;
    }

    // 邮箱流程
    if (mode === "login") {
      const ok = await signInWithEmail(email, password);
      if (ok) handleClose();
      return;
    }

    // 邮箱注册：提交即验证码
    if (waitingForCode) {
      const ok = await verifySignUpCode(code);
      if (ok) handleClose();
      return;
    }

    // 还没发送验证码，提示用户
    useAuthStore.getState().clearError();
    useAuthStore.setState({ error: "请先点击邮箱旁的「发送验证码」按钮" });
  };

  const handleSendEmailCode = async () => {
    if (resendCooldown > 0 || loading) return;
    if (!email.trim() || !password.trim()) {
      useAuthStore.getState().clearError();
      useAuthStore.setState({ error: "请先填写邮箱和密码" });
      return;
    }
    // 校验图形验证码
    if (!captchaRef.current?.validate()) {
      useAuthStore.getState().clearError();
      useAuthStore.setState({ error: "图形验证码不正确，请重新输入" });
      return;
    }
    const result = await signUpWithEmail(email, password);
    if (result === "otp-sent") {
      setCode("");
      setResendCooldown(60);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    captchaRef.current?.refresh();
    setCaptchaValue("");
    const result = await signUpWithEmail(email, password);
    if (result === "otp-sent") {
      setResendCooldown(60);
    }
  };

  const handleSendPhoneCode = async () => {
    if (phoneCooldown > 0 || loading) return;
    // 发送短信验证码前校验图形验证码
    if (!phoneCaptchaRef.current?.validate()) {
      useAuthStore.getState().clearError();
      useAuthStore.setState({ error: "图形验证码不正确，请重新输入" });
      return;
    }
    const ok = await sendPhoneCode(phone);
    if (ok) {
      setPhoneCodeSent(true);
      setPhoneCode("");
      setPhoneCooldown(60);
      phoneCaptchaRef.current?.refresh();
      setPhoneCaptchaValue("");
    }
  };

  const handleClose = () => {
    setEmail("");
    setPassword("");
    setCode("");
    setCaptchaValue("");
    setResendCooldown(0);
    setPhone("");
    setPhonePassword("");
    setPhoneCode("");
    setPhoneCaptchaValue("");
    setPhoneCodeSent(false);
    setPhoneCooldown(0);
    clearPendingSignUp();
    clearError();
    onClose();
  };

  const resetFlowState = () => {
    setCode("");
    setCaptchaValue("");
    setResendCooldown(0);
    setPhoneCode("");
    setPhoneCaptchaValue("");
    setPhoneCodeSent(false);
    setPhoneCooldown(0);
    clearPendingSignUp();
    clearError();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    resetFlowState();
  };

  const switchLoginMethod = (m: LoginMethod) => {
    setLoginMethod(m);
    setPhoneLoginType("code");
    resetFlowState();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-void-950/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* 弹窗 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25 }}
            className="card-surface grain relative w-full max-w-md overflow-hidden p-7"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-star-glow opacity-20 blur-3xl" />

            {/* 关闭 */}
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-100"
              aria-label="关闭"
            >
              <X size={18} />
            </button>

            {/* 标题 */}
            <div className="relative">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-star-400" strokeWidth={1.5} />
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                  {mode === "login" ? "欢迎归来" : "加入星辰"}
                </span>
              </div>
              <h3 className="heading-display text-2xl text-parchment-50">
                {mode === "login"
                  ? "登录天玑"
                  : loginMethod === "email" && waitingForCode
                    ? "验证邮箱"
                    : "注册账号"}
              </h3>
              <p className="mt-2 text-sm text-mist-400">
                {mode === "login"
                  ? loginMethod === "email"
                    ? "用邮箱登录，继续你的学习与创作之旅。"
                    : phoneLoginType === "password"
                      ? "用手机号 + 密码登录。"
                      : "用手机号 + 验证码登录。"
                  : loginMethod === "email" && waitingForCode
                    ? `验证码已发送到 ${pendingSignUpEmail}，验证后即可进入天玑。`
                    : loginMethod === "email"
                      ? "用邮箱注册，从理论走向真实作品。"
                      : "用手机号注册，从理论走向真实作品。"}
              </p>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="relative mt-6 space-y-4">
              {/* 登录方式切换 */}
              <div className="flex gap-1 rounded-lg border border-void-600/40 bg-void-900/40 p-1">
                <button
                  type="button"
                  onClick={() => switchLoginMethod("email")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors ${
                    loginMethod === "email"
                      ? "bg-void-700/60 text-parchment-100"
                      : "text-mist-400 hover:text-parchment-200"
                  }`}
                >
                  <Mail size={13} /> 邮箱
                </button>
                <button
                  type="button"
                  onClick={() => switchLoginMethod("phone")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors ${
                    loginMethod === "phone"
                      ? "bg-void-700/60 text-parchment-100"
                      : "text-mist-400 hover:text-parchment-200"
                  }`}
                >
                  <Phone size={13} /> 手机号
                </button>
              </div>

              {loginMethod === "email" ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs text-mist-400">邮箱</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                        />
                        <input
                          name="email"
                          type="email"
                          required
                          disabled={waitingForCode}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30 disabled:opacity-60"
                        />
                      </div>
                      {mode === "register" && (
                        <button
                          type="button"
                          onClick={handleSendEmailCode}
                          disabled={resendCooldown > 0 || loading}
                          className="shrink-0 rounded-lg border border-void-600/60 bg-void-800/50 px-3 text-xs text-parchment-100 transition-all hover:border-mist-400/50 hover:bg-void-700/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resendCooldown > 0 ? `${resendCooldown}s` : "发送验证码"}
                        </button>
                      )}
                    </div>
                  </div>

                  {!waitingForCode && (
                    <div>
                    <label className="mb-1.5 block text-xs text-mist-400">密码</label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                      />
                      <input
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="至少 6 位"
                        className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                      />
                    </div>
                  </div>
                  )}

                  {/* 注册时显示图形验证码 */}
                  {mode === "register" && !waitingForCode && (
                    <div>
                      <label className="mb-1.5 block text-xs text-mist-400">人机验证</label>
                      <CanvasCaptcha ref={captchaRef} value={captchaValue} onChange={setCaptchaValue} />
                    </div>
                  )}

                  {/* 注册时始终显示验证码输入框 */}
                  {mode === "register" && (
                    <div>
                      <label className="mb-1.5 block text-xs text-mist-400">邮箱验证码</label>
                      <div className="relative">
                        <ShieldCheck
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                        />
                        <input
                          name="code"
                          type="text"
                          required={waitingForCode}
                          inputMode="numeric"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder={waitingForCode ? "输入邮件中的验证码" : "点击下方按钮发送验证码"}
                          className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                        />
                      </div>
                      {waitingForCode && (
                        <>
                          {resendCooldown > 0 ? (
                            <p className="mt-1.5 text-[11px] text-mist-500">
                              {resendCooldown}s 后可重新发送验证码
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResendCode}
                              disabled={loading}
                              className="mt-1.5 text-[11px] text-star-300 transition-colors hover:text-star-200"
                            >
                              重新发送验证码
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* 手机号 */}
                  <div>
                    <label className="mb-1.5 block text-xs text-mist-400">手机号</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                        />
                        <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm text-mist-400">
                          +86
                        </span>
                        <input
                          name="phone"
                          type="tel"
                          required
                          inputMode="numeric"
                          maxLength={11}
                          disabled={phoneCodeSent && mode === "register"}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="13800138000"
                          className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-16 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30 disabled:opacity-60"
                        />
                      </div>
                      {mode === "register" && (
                        <button
                          type="button"
                          onClick={handleSendPhoneCode}
                          disabled={phoneCooldown > 0 || loading || phone.length === 0}
                          className="shrink-0 rounded-lg border border-void-600/60 bg-void-800/50 px-3 text-xs text-parchment-100 transition-all hover:border-mist-400/50 hover:bg-void-700/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {phoneCooldown > 0 ? `${phoneCooldown}s` : "发送验证码"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 登录时：验证码 / 密码 切换 */}
                  {mode === "login" && (
                    <div className="flex gap-1 rounded-lg border border-void-600/40 bg-void-900/40 p-1">
                      <button
                        type="button"
                        onClick={() => setPhoneLoginType("code")}
                        className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${
                          phoneLoginType === "code"
                            ? "bg-void-700/60 text-parchment-100"
                            : "text-mist-400 hover:text-parchment-200"
                        }`}
                      >
                        验证码登录
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhoneLoginType("password")}
                        className={`flex-1 rounded-md py-1.5 text-xs transition-colors ${
                          phoneLoginType === "password"
                            ? "bg-void-700/60 text-parchment-100"
                            : "text-mist-400 hover:text-parchment-200"
                        }`}
                      >
                        密码登录
                      </button>
                    </div>
                  )}

                  {/* 密码：注册时必填，登录密码模式时显示 */}
                  {(mode === "register" || (mode === "login" && phoneLoginType === "password")) && (
                    <div>
                      <label className="mb-1.5 block text-xs text-mist-400">密码</label>
                      <div className="relative">
                        <Lock
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                        />
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={6}
                          value={phonePassword}
                          onChange={(e) => setPhonePassword(e.target.value)}
                          placeholder="至少 6 位"
                          className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                        />
                      </div>
                    </div>
                  )}

                  {/* 图形验证码：注册时 + 验证码登录时显示 */}
                  {(mode === "register" || (mode === "login" && phoneLoginType === "code")) && (
                    <div>
                      <label className="mb-1.5 block text-xs text-mist-400">人机验证</label>
                      <CanvasCaptcha ref={phoneCaptchaRef} value={phoneCaptchaValue} onChange={setPhoneCaptchaValue} />
                    </div>
                  )}

                  {/* 短信验证码：注册时 + 验证码登录时显示 */}
                  {(mode === "register" || (mode === "login" && phoneLoginType === "code")) && (
                    <div>
                      <label className="mb-1.5 block text-xs text-mist-400">短信验证码</label>
                      {mode === "login" && (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <ShieldCheck
                              size={15}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                            />
                            <input
                              name="code"
                              type="text"
                              required
                              inputMode="numeric"
                              maxLength={6}
                              value={phoneCode}
                              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="输入短信验证码"
                              className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleSendPhoneCode}
                            disabled={phoneCooldown > 0 || loading || phone.length === 0}
                            className="shrink-0 rounded-lg border border-void-600/60 bg-void-800/50 px-3 text-xs text-parchment-100 transition-all hover:border-mist-400/50 hover:bg-void-700/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {phoneCooldown > 0 ? `${phoneCooldown}s` : "发送验证码"}
                          </button>
                        </div>
                      )}
                      {mode === "register" && (
                        <div className="relative">
                          <ShieldCheck
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                          />
                          <input
                            name="code"
                            type="text"
                            required
                            inputMode="numeric"
                            maxLength={6}
                            value={phoneCode}
                            onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                            placeholder="输入短信验证码"
                            className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> 处理中…
                  </>
                ) : loginMethod === "phone" ? (
                  mode === "login" ? (phoneLoginType === "password" ? "登录" : "登录") : "注册"
                ) : mode === "login" ? (
                  "登录"
                ) : (
                  "注册"
                )}
              </button>

              {/* 分隔线 */}
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-void-600/40" />
                <span className="text-[10px] text-mist-500">或</span>
                <span className="h-px flex-1 bg-void-600/40" />
              </div>

              {/* GitHub 登录 */}
              <button
                type="button"
                disabled={loading}
                onClick={() => signInWithGitHub()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-void-600/60 bg-void-800/50 py-2.5 text-sm text-parchment-100 transition-all hover:border-mist-400/50 hover:bg-void-700/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Github size={16} />
                )}
                使用 GitHub 登录
              </button>
            </form>

            {/* 切换 */}
            <p className="relative mt-5 text-center text-xs text-mist-400">
              {mode === "login" ? "还没有账号？" : "已有账号？"}
              <button
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="ml-1 text-star-300 transition-colors hover:text-star-200"
              >
                {mode === "login" ? "去注册" : "去登录"}
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
