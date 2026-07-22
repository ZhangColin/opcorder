import { useState } from "react";
import { X, Download } from "lucide-react";
import type { DemoData } from "@/hooks/useDemoStatus";
import { DemoFeedbackDialog } from "./DemoFeedbackDialog";
import { useQueryClient } from "@tanstack/react-query";

interface DemoPreviewModalProps {
  demandId: number;
  demo: DemoData;
  demandTitle?: string;
  showAdminControls?: boolean;
  onClose: () => void;
  onRegenerate?: () => void;
  onDownload?: () => void;
  onShowVersions?: () => void;
}

/** Merge index.html + style.css + app.js into a single self-contained srcdoc string.
 *  Removes external <link href="style.css"> and <script src="app.js"> references
 *  before inlining, because srcdoc has no base URL to fetch those from. */
function buildSrcdoc(files: Record<string, string>): string {
  let html = files["index.html"] ?? "<!DOCTYPE html><html><head></head><body></body></html>";
  const css = files["style.css"] ?? "";
  const js = files["app.js"] ?? "";

  // Strip external file references (they 404 in srcdoc context)
  html = html.replace(/<link[^>]+href=["']style\.css["'][^>]*\/?>/gi, "");
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/gi, "");
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*(\/?>)/gi, "");

  // Inline CSS
  if (css) {
    html = html.includes("</head>")
      ? html.replace("</head>", `<style>\n${css}\n</style>\n</head>`)
      : html.replace("<body", `<style>\n${css}\n</style>\n<body`);
  }

  // Inject global error handler BEFORE user code so async errors (DOMContentLoaded
  // callbacks etc.) are also caught — try/catch only covers synchronous errors.
  if (js) {
    const errorHandler = `window.onerror = function(msg, src, line, col, err) {
  var _eb = document.getElementById('__demo_error_banner__');
  if (!_eb) {
    _eb = document.createElement('div');
    _eb.id = '__demo_error_banner__';
    _eb.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:#fef2f2;color:#b91c1c;font-size:13px;font-family:monospace;border-top:2px solid #fca5a5;z-index:9999;white-space:pre-wrap';
    document.body && document.body.appendChild(_eb);
  }
  _eb.textContent = 'JS Error: ' + (err ? err.message : msg) + (line ? ' (line ' + line + ')' : '');
  return true;
};`;
    const errorHandlerTag = `<script>\n${errorHandler}\n</script>`;
    const userCodeTag = `<script>\n${js}\n</script>`;
    const combined = errorHandlerTag + "\n" + userCodeTag;
    html = html.includes("</body>")
      ? html.replace("</body>", combined + "\n</body>")
      : html + combined;
  }

  return html;
}

export function DemoPreviewModal({
  demandId,
  demo,
  demandTitle,
  showAdminControls,
  onClose,
  onRegenerate,
  onDownload,
  onShowVersions,
}: DemoPreviewModalProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const queryClient = useQueryClient();

  const files = demo.files ?? {};

  const handleFeedbackAccepted = () => {
    setShowFeedback(false);
    onClose();
    queryClient.invalidateQueries({ queryKey: ["demo", demandId] });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {demandTitle ? `Demo 预览 — ${demandTitle}` : "Demo 预览"}
          </p>
          <p className="text-xs text-slate-400">v{demo.version} · 只读预览</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showAdminControls && (
            <>
              {onShowVersions && (
                <button
                  onClick={onShowVersions}
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  历史版本
                </button>
              )}
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={13} /> 下载 zip
                </button>
              )}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-900/40 hover:bg-amber-900/60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  重新生成
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ height: "100%" }}>
        <iframe
          srcDoc={buildSrcdoc(files)}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0 bg-white"
          title="Demo 预览"
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <p className="text-xs text-slate-500">Demo 由 AI 自动生成，仅供参考</p>
        <button
          onClick={() => setShowFeedback(true)}
          className="flex items-center gap-1.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 px-4 py-2 rounded-xl transition-colors"
        >
          提修改意见
        </button>
      </div>

      {showFeedback && (
        <DemoFeedbackDialog
          demandId={demandId}
          onClose={() => setShowFeedback(false)}
          onAccepted={handleFeedbackAccepted}
        />
      )}
    </div>
  );
}
