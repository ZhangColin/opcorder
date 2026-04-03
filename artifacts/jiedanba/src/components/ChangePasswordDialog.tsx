import { useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { Lock, Eye, EyeOff, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChangePasswordDialogProps {
  onClose: () => void;
}

export function ChangePasswordDialog({ onClose }: ChangePasswordDialogProps) {
  const [oldPw,   setOldPw]   = useState("");
  const [newPw,   setNewPw]   = useState("");
  const [newPw2,  setNewPw2]  = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!oldPw) { setError("请输入旧密码"); return; }
    if (newPw.length < 6) { setError("新密码至少 6 位"); return; }
    if (newPw !== newPw2) { setError("两次新密码输入不一致"); return; }
    if (newPw === oldPw) { setError("新密码不能与旧密码相同"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "修改失败，请稍后重试");
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 pt-64">
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
            <h3 className="text-lg font-black text-foreground mb-2">密码修改成功</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              您的密码已更新，请妥善保存新密码。下次登录时请使用新密码。
            </p>
            <button
              onClick={onClose}
              className="w-full bg-primary text-white rounded-xl py-3 font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              确定
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-black text-foreground mb-1">修改密码</h3>
            <p className="text-sm text-slate-400 mb-6">请输入旧密码，再设置新密码</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 旧密码 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">旧密码</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPw}
                    onChange={e => { setOldPw(e.target.value); setError(""); }}
                    placeholder="输入当前密码"
                    autoFocus
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <button type="button" onClick={() => setShowOld(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 新密码 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">新密码</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={e => { setNewPw(e.target.value); setError(""); }}
                    placeholder="至少 6 位"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 确认新密码 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">确认新密码</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNew2 ? "text" : "password"}
                    value={newPw2}
                    onChange={e => { setNewPw2(e.target.value); setError(""); }}
                    placeholder="再次输入新密码"
                    className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${
                      newPw2 && newPw !== newPw2 ? "border-destructive bg-red-50" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                  <button type="button" onClick={() => setShowNew2(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPw2 && newPw !== newPw2 && (
                  <p className="text-xs text-destructive">两次密码不一致</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> 保存中…</> : "保存新密码"}
              </button>
            </form>

            <button type="button" onClick={onClose}
              className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600 transition-colors">
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
