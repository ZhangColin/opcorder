import { useState } from "react";
import { Download, Loader2, Paperclip } from "lucide-react";
import { renderMarkdownHtml } from "@/components/MarkdownContent";

type Attachment = { name: string; url: string };

function isMarkdown(name: string) {
  return name.toLowerCase().endsWith(".md");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ContestAttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function openAttachment(attachment: Attachment) {
    if (!isMarkdown(attachment.name)) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }

    const viewer = window.open("", "_blank");
    if (!viewer) {
      setError("浏览器阻止了新窗口，请允许弹窗后重试");
      return;
    }
    viewer.opener = null;

    const key = `view:${attachment.url}`;
    setBusyKey(key);
    setError("");
    viewer.document.write("<p style=\"font-family:sans-serif;padding:24px\">正在加载文档…</p>");

    try {
      const response = await fetch(attachment.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`读取失败 (${response.status})`);
      const bytes = await response.arrayBuffer();
      const markdown = new TextDecoder("utf-8").decode(bytes);
      const renderedMarkdown = renderMarkdownHtml(markdown);
      viewer.document.open();
      viewer.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(attachment.name)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#f8fafc;color:#334155;font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
    main{max-width:960px;margin:32px auto;padding:40px 48px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 1px 3px #0000000d}
    h1,h2,h3,h4,h5,h6{color:#0f172a;font-weight:700;line-height:1.35;margin:1.6em 0 .65em}
    h1{font-size:2em;border-bottom:1px solid #e2e8f0;padding-bottom:.35em;margin-top:0}
    h2{font-size:1.5em;border-bottom:1px solid #e2e8f0;padding-bottom:.3em}
    h3{font-size:1.25em}
    p{margin:.8em 0}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    strong{color:#1e293b}
    ul,ol{padding-left:1.6em;margin:.75em 0}
    li{margin:.3em 0}
    blockquote{margin:1em 0;padding:.4em 1em;border-left:4px solid #93c5fd;background:#eff6ff;color:#475569}
    code{padding:.15em .4em;border-radius:5px;background:#f1f5f9;color:#1d4ed8;font:0.9em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{margin:1em 0;padding:18px;overflow:auto;border-radius:10px;background:#0f172a;color:#e2e8f0;line-height:1.6}
    pre code{padding:0;background:transparent;color:inherit}
    table{width:100%;border-collapse:collapse;margin:1em 0;display:block;overflow-x:auto}
    th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}
    th{background:#f1f5f9;color:#1e293b}
    hr{border:0;border-top:1px solid #e2e8f0;margin:2em 0}
    img{max-width:100%;height:auto;border-radius:8px}
    input[type=checkbox]{margin-right:.45em}
    @media(max-width:700px){main{margin:0;padding:24px 18px;border:0;border-radius:0;min-height:100vh}}
  </style>
</head>
<body><main>${renderedMarkdown}</main></body>
</html>`);
      viewer.document.close();
    } catch (err) {
      viewer.close();
      setError(err instanceof Error ? err.message : "文档打开失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function downloadAttachment(attachment: Attachment) {
    const key = `download:${attachment.url}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch(attachment.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`下载失败 (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载失败，请重试");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {attachments.map((attachment, index) => {
        const viewKey = `view:${attachment.url}`;
        const downloadKey = `download:${attachment.url}`;
        return (
          <div key={`${attachment.url}:${index}`} className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => openAttachment(attachment)}
              disabled={busyKey === viewKey}
              className="flex min-w-0 items-center gap-1 text-left text-blue-600 hover:underline disabled:opacity-60"
            >
              {busyKey === viewKey ? <Loader2 size={11} className="shrink-0 animate-spin" /> : <Paperclip size={11} className="shrink-0" />}
              <span className="truncate">{attachment.name}</span>
            </button>
            <button
              type="button"
              onClick={() => downloadAttachment(attachment)}
              disabled={busyKey === downloadKey}
              className="ml-1 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-60"
            >
              {busyKey === downloadKey ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              下载
            </button>
          </div>
        );
      })}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}