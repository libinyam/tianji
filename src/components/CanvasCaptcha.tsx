import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { RefreshCw } from "lucide-react";

export interface CanvasCaptchaHandle {
  /** 校验用户输入是否正确，返回 boolean 并自动刷新 */
  validate: () => boolean;
  /** 重新生成验证码 */
  refresh: () => void;
}

interface CanvasCaptchaProps {
  /** 用户输入值 */
  value: string;
  onChange: (v: string) => void;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆字符 I O 0 1
const LENGTH = 4;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

const CanvasCaptcha = forwardRef<CanvasCaptchaHandle, CanvasCaptchaProps>(
  ({ value, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [code, setCode] = useState("");

    const draw = (text: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      // 背景：浅灰纯色，与页面白色主题一致
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, W, H);

      // 干扰线
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(${60 + Math.random() * 80}, ${60 + Math.random() * 80}, ${70 + Math.random() * 80}, 0.3)`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(Math.random() * W, Math.random() * H);
        ctx.lineTo(Math.random() * W, Math.random() * H);
        ctx.stroke();
      }

      // 干扰点
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(80, 80, 100, ${Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, 0.5 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }

      // 字符：深色系，浅底可读
      const colors = ["#b45309", "#006b9f", "#6d28d9", "#047857", "#be123c"];
      const charW = W / (LENGTH + 1);
      for (let i = 0; i < text.length; i++) {
        ctx.save();
        const x = charW * (i + 0.7);
        const y = H / 2 + (Math.random() - 0.5) * 8;
        const angle = (Math.random() - 0.5) * 0.4;
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.font = `bold ${20 + Math.random() * 4}px monospace`;
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
      }
    };

    const refresh = () => {
      const newCode = generateCode();
      setCode(newCode);
      onChange("");
      // 等下一帧 canvas 就绪
      requestAnimationFrame(() => draw(newCode));
    };

    useImperativeHandle(ref, () => ({
      validate: () => {
        const ok = value.toUpperCase() === code;
        if (!ok) refresh();
        return ok;
      },
      refresh,
    }));

    useEffect(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="flex items-center gap-2">
        <input
          name="captcha"
          type="text"
          required
          maxLength={LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="输入验证码"
          className="min-w-0 flex-1 rounded-lg border border-void-600 bg-void-950 px-3 py-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-tian-500 focus:outline-none focus:ring-1 focus:ring-tian-500/30"
        />
        <canvas
          ref={canvasRef}
          width={100}
          height={40}
          onClick={refresh}
          className="cursor-pointer rounded-lg border border-void-600"
          title="点击刷新验证码"
        />
        <button
          type="button"
          onClick={refresh}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-void-600 bg-void-800 text-mist-400 transition-colors hover:bg-void-700 hover:text-tian-500"
          title="刷新验证码"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    );
  },
);

CanvasCaptcha.displayName = "CanvasCaptcha";
export default CanvasCaptcha;
