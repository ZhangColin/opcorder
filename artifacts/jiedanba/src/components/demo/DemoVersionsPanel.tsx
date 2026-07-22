import { useState, useEffect } from "react";
import { X, Loader2, Clock } from "lucide-react";
import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface VersionEntry {
  version: number;
  isCurrent: boolean;
  feedback: string | null;
  createdAt: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
}

interface DemoVersionsPanelProps {
  demandId: number;
  currentVersion: number;
  onClose: () => void;
}

function buildSrcdoc(files: Record<string, string>): string {
  let html = files["index.html"] ?? "<!DOCTYPE html><html><head></head><body></body></html>";
  const css = files["style.css"] ?? "";
  const js = files["app.js"] ?? "";

  html = html.replace(/<link[^>]+href=["']style\.css["'][^>]*\/?>/gi, "");
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/gi, "");
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*(\/?>)/gi, "");

  if (css) {
    html = html.includes("</head>")
      ? html.replace("</head>", `<style>\n${css}\n</style>\n</head>`)
      : html.replace("<body", `<style>\n${css}\n</style>\n<body`);
  }

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
    const combined = `<script>\n${errorHandler}\n</script>\n<script>\n${js}\n</script>`;
    html = html.includes("</body>")
      ? html.replace("</body>", combined + "\n</body>")
      : html + combined;
  }

  return html;
}

export function DemoVersionsPanel({ demandId, currentVersion, onClose }: DemoVersionsPanelProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VersionEntry | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${BASE}/api/demands/${demandId}/demo/versions`, { headers })
      .then(r => r.json())
      .then(data => {
        const list = (data.data ?? []) as VersionEntry[];
        setVersions(list);
        if (list.length > 0) setSelected(list[list.length - 1]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [demandId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <p className="text-sm font-bold text-white">Demo 历史版本</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: timeline */}
          <div className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto">
            <div className="p-4 space-y-2">
              {[...versions].reverse().map((v) => (
                <button
                  key={v.version}
                  onClick={() => setSelected(v)}
                  className={`w-full text-left p-3 rounded-xl transition-colors border ${
                    selected?.version === v.version
                      ? "bg-primary/20 border-primary/40"
                      : "bg-slate-800/50 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-black text-white">v{v.version}</span>
                    {v.isCurrent && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded-full">当前</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock size={10} />
                    <span className="text-[10px]">
                      {new Date(v.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {v.feedback && (
                    <p className="text-[10px] text-slate-400 mt-1 truncate" title={v.feedback}>
                      {v.feedback}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {selected ? (
              <iframe
                key={selected.version}
                srcDoc={buildSrcdoc(selected.files)}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0 bg-white"
                title={`Demo v${selected.version}`}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                选择版本以预览
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
