import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DemoFeedbackDialogProps {
  demandId: number;
  onClose: () => void;
  onAccepted: () => void;
}

export function DemoFeedbackDialog({ demandId, onClose, onAccepted }: DemoFeedbackDialogProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    setHint("");
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE}/api/demands/${demandId}/demo/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ feedback: text.trim() }),
      });
      const data = await res.json();
      if (data.accepted) {
        onAccepted();
      } else {
        setHint(data.message ?? "请提供更具体的页面修改意见");
      }
    } catch {
      setHint("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">提修改意见</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          请描述对 Demo 页面的具体修改需求（如颜色、布局、文字、组件等）
        </p>
        {hint && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {hint}
          </div>
        )}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="例如：将主色调改为蓝色，导航栏加上 Logo 占位区域，按钮圆角更大一些…"
          className="w-full resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            提交意见
          </button>
        </div>
      </div>
    </div>
  );
}
