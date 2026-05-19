import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** Renders a Markdown string as safe, styled rich text. */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const html = useMemo(() => {
    if (!content) return "";
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div
      className={`prose prose-sm max-w-none
        prose-headings:font-bold prose-headings:text-slate-800 prose-headings:mt-4 prose-headings:mb-2
        prose-p:my-1 prose-p:leading-relaxed prose-p:text-slate-600
        prose-strong:font-bold prose-strong:text-slate-700
        prose-em:italic
        prose-code:bg-slate-100 prose-code:text-blue-800 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.82em] prose-code:font-mono
        prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-slate-500
        prose-ul:pl-5 prose-ul:my-1 prose-ol:pl-5 prose-ol:my-1
        prose-li:my-0.5
        prose-hr:border-slate-200
        ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Strip markdown syntax and return plain text — for list/card previews. */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")       // bold
    .replace(/\*(.+?)\*/g, "$1")           // italic
    .replace(/~~(.+?)~~/g, "$1")           // strikethrough
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1") // code
    .replace(/^\s*[-*+]\s+/gm, "")         // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "")         // ordered list markers
    .replace(/^\s*>\s+/gm, "")             // blockquotes
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")    // links
    .replace(/^---+$/gm, "")              // horizontal rules
    .replace(/\n{2,}/g, " ")              // collapse multiple newlines
    .replace(/\n/g, " ")                  // remaining newlines → space
    .trim();
}
