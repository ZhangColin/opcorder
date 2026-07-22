import { Loader2, Play, AlertCircle } from "lucide-react";
import type { DemoData } from "@/hooks/useDemoStatus";

interface DemoStatusBadgeProps {
  demo: DemoData | null | undefined;
  loading?: boolean;
  onPreview?: () => void;
  size?: "sm" | "md";
}

export function DemoStatusBadge({ demo, loading, onPreview, size = "md" }: DemoStatusBadgeProps) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
        <Loader2 size={12} className="animate-spin" /> Demo 加载中…
      </span>
    );
  }
  if (!demo) return null;

  const isSmall = size === "sm";
  const px = isSmall ? "px-2 py-0.5" : "px-3 py-1.5";
  const iconSize = isSmall ? 11 : 13;
  const textSize = isSmall ? "text-[10px]" : "text-xs";

  if (demo.status === "generating") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold text-amber-600 bg-amber-50 ${px} rounded-full`}>
        <Loader2 size={iconSize} className="animate-spin" /> Demo 生成中
      </span>
    );
  }
  if (demo.status === "updating") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold text-blue-600 bg-blue-50 ${px} rounded-full`}>
        <Loader2 size={iconSize} className="animate-spin" /> Demo 更新中
      </span>
    );
  }
  if (demo.status === "error") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold text-slate-500 bg-slate-100 ${px} rounded-full`}>
        <AlertCircle size={iconSize} /> 生成失败
      </span>
    );
  }
  if (demo.status === "ready") {
    return (
      <button
        onClick={onPreview}
        className={`inline-flex items-center gap-1.5 ${textSize} font-bold text-white bg-emerald-500 hover:bg-emerald-600 ${px} rounded-full transition-colors`}
      >
        <Play size={iconSize} className="fill-white" /> 预览 Demo
      </button>
    );
  }
  return null;
}
