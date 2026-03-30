import { useState } from "react";
import { Mail, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ForgotPasswordDialogProps {
  onClose: () => void;
}

export function ForgotPasswordDialog({ onClose }: ForgotPasswordDialogProps) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError("请填写注册邮箱"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("邮箱格式不正确"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "操作失败，请稍后重试");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        {success ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-black text-foreground mb-2">邮件已发送</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              临时密码已发送至 <span className="font-bold text-primary">{email}</span>，请查收并使用临时密码登录，登录后建议及时修改密码。
            </p>
            <button
              onClick={onClose}
              className="w-full bg-primary text-white rounded-xl py-3 font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              返回登录
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-black text-foreground mb-2">找回密码</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              输入您的注册邮箱，我们将向该邮箱发送临时密码。
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">注册邮箱</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    placeholder="name@enterprise.com"
                    autoFocus
                    autoComplete="email"
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${
                      error ? "border-destructive bg-red-50" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
                    <AlertCircle size={13} />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> 发送中…</>
                ) : (
                  "发送临时密码"
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              取消，返回登录
            </button>
          </>
        )}
      </div>
    </div>
  );
}
