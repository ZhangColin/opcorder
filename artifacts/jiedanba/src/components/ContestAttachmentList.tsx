import { useState } from "react";
import { Download, Loader2, Paperclip } from "lucide-react";

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
      viewer.document.open();
      viewer.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(attachment.name)}</title>
  <style>
    body{margin:0;background:#f8fafc;color:#1e293b;font:15px/1.75 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    main{max-width:960px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px #0000000d}
    pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
  </style>
</head>
<body><main><pre>${escapeHtml(markdown)}</pre></main></body>
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