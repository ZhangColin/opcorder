import { useState } from "react";
import { Loader2, RefreshCw, Download, History, Play, AlertCircle } from "lucide-react";
import { useDemoStatus } from "@/hooks/useDemoStatus";
import { DemoStatusBadge } from "./DemoStatusBadge";
import { DemoPreviewModal } from "./DemoPreviewModal";
import { DemoVersionsPanel } from "./DemoVersionsPanel";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DemoManagePanelProps {
  demandId: number;
  demandTitle?: string;
}

async function apiPost(path: string, body?: unknown) {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  return res.json();
}

export function DemoManagePanel({ demandId, demandTitle }: DemoManagePanelProps) {
  const qc = useQueryClient();
  const { data: demo, isLoading } = useDemoStatus(demandId);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const triggerRegenerate = async (withConfirm: boolean) => {
    if (withConfirm && !confirm("确认重新生成 Demo？当前版本将保留在历史记录中。")) return;
    setRegenerating(true);
    try {
      await apiPost(`/api/demands/${demandId}/demo/regenerate`);
      qc.invalidateQueries({ queryKey: ["demo", demandId] });
    } catch (err: any) {
      alert(err.message ?? "生成失败");
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerate = () => triggerRegenerate(true);

  const handleDownload = async () => {
    if (!demo || !demo.version) return;
    setDownloading(true);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE}/api/demands/${demandId}/demo/versions/${demo.version}/download`, { headers });
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `demo-v${demo.version}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message ?? "下载失败");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-6">
        <Loader2 size={16} className="animate-spin" /> 加载 Demo 状态…
      </div>
    );
  }

  if (!demo) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-4">
        <p className="text-slate-500 text-sm">该需求暂未生成 Demo。</p>
        <button
          onClick={() => triggerRegenerate(false)}
          disabled={regenerating}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-white" />}
          立即生成 Demo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Demo 状态</p>
            <DemoStatusBadge demo={demo} onPreview={() => setShowPreview(true)} />
          </div>
          {demo.status === "ready" && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-xl transition-colors"
              >
                <Play size={13} className="fill-white" /> 预览 Demo
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                下载 zip
              </button>
              <button
                onClick={() => setShowVersions(true)}
                className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
              >
                <History size={13} /> 历史版本
              </button>
            </div>
          )}
        </div>
        {demo.status === "error" && demo.errorMsg && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600">{demo.errorMsg}</p>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
          <p className="text-xs text-slate-400">版本 v{demo.version}</p>
          <p className="text-xs text-slate-400">更新于 {new Date(demo.updatedAt).toLocaleString("zh-CN")}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRegenerate}
          disabled={regenerating || demo.status === "generating" || demo.status === "updating"}
          className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          重新生成
        </button>
      </div>

      {showPreview && demo.status === "ready" && (
        <DemoPreviewModal
          demandId={demandId}
          demo={demo}
          demandTitle={demandTitle}
          showAdminControls
          onClose={() => setShowPreview(false)}
          onRegenerate={handleRegenerate}
          onDownload={handleDownload}
          onShowVersions={() => { setShowPreview(false); setShowVersions(true); }}
        />
      )}

      {showVersions && (
        <DemoVersionsPanel
          demandId={demandId}
          currentVersion={demo.version}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
