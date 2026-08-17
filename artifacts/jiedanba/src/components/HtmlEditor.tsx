import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Quote,
  List, ListOrdered, Undo2, Redo2, Minus, RemoveFormatting,
  AlignLeft, AlignCenter, AlignRight,
  ImagePlus, Loader2, FileCode2, Link2, Link2Off,
  Table as TableIcon, Highlighter,
} from "lucide-react";

/* 常用文字颜色(适合公告排版) */
const TEXT_COLORS = [
  { label: "默认", value: "" },
  { label: "红色", value: "#dc2626" },
  { label: "橙色", value: "#ea580c" },
  { label: "金色", value: "#ca8a04" },
  { label: "绿色", value: "#16a34a" },
  { label: "蓝色", value: "#2563eb" },
  { label: "紫色", value: "#9333ea" },
  { label: "灰色", value: "#64748b" },
];

const FONT_SIZES = [
  { label: "小号", value: "13px" },
  { label: "正常", value: "" },
  { label: "较大", value: "18px" },
  { label: "大号", value: "22px" },
  { label: "特大", value: "28px" },
];

interface HtmlEditorProps {
  /** HTML 字符串 */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  hasError?: boolean;
  minHeight?: string;
  /** 上传文件并返回可访问 URL,传入后工具栏出现「插入图片」 */
  onUploadImage?: (file: File) => Promise<string>;
  /** 开启后可切换 HTML 源码编辑 */
  enableSourceMode?: boolean;
}

/**
 * 面向非技术人员的所见即所得 HTML 编辑器(输出 HTML)。
 * 覆盖公告排版常用能力:标题/字号/颜色/高亮/对齐/列表/引用/链接/图片/表格,
 * 并保留 HTML 源码模式供精细控制。
 */
export function HtmlEditor({
  value,
  onChange,
  placeholder = "在此输入内容…",
  hasError = false,
  minHeight,
  onUploadImage,
  enableSourceMode = false,
}: HtmlEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "md-editor-inner outline-none prose prose-sm max-w-none text-slate-700 leading-relaxed",
      },
    },
  });

  // 外部 value 同步(如编辑已有公告)。源码模式下不回灌,避免规范化改写与光标丢失;
  // 退出源码模式时本 effect 因 sourceMode 变化重新执行,一次性同步。
  useEffect(() => {
    if (!editor || sourceMode) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor, sourceMode]);

  if (!editor) return null;

  const ToolbarBtn = ({
    onClick, active, disabled, title, children,
  }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled || sourceMode}
      title={title}
      className={`p-1.5 rounded-lg text-sm transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;

  const currentBlock = editor.isActive("heading", { level: 1 }) ? "h1"
    : editor.isActive("heading", { level: 2 }) ? "h2"
    : editor.isActive("heading", { level: 3 }) ? "h3"
    : "p";

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址(以 https:// 开头)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div
      className={`border rounded-xl transition focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${
        hasError ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        {/* 段落样式 */}
        <select
          value={currentBlock}
          disabled={sourceMode}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v === "p") chain.setParagraph().run();
            else chain.toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
          }}
          className="h-8 border border-slate-200 rounded-lg px-1.5 text-xs text-slate-600 bg-white outline-none disabled:opacity-40"
          title="段落样式"
        >
          <option value="p">正文</option>
          <option value="h1">大标题</option>
          <option value="h2">中标题</option>
          <option value="h3">小标题</option>
        </select>
        {/* 字号 */}
        <select
          value={(editor.getAttributes("textStyle").fontSize as string | undefined) ?? ""}
          disabled={sourceMode}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v) chain.setFontSize(v).run();
            else chain.unsetFontSize().run();
          }}
          className="h-8 border border-slate-200 rounded-lg px-1.5 text-xs text-slate-600 bg-white outline-none disabled:opacity-40"
          title="字号"
        >
          {FONT_SIZES.map(s => <option key={s.label} value={s.value}>{s.label}</option>)}
        </select>
        {/* 颜色 */}
        <select
          value={(editor.getAttributes("textStyle").color as string | undefined) ?? ""}
          disabled={sourceMode}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v) chain.setColor(v).run();
            else chain.unsetColor().run();
          }}
          className="h-8 border border-slate-200 rounded-lg px-1.5 text-xs bg-white outline-none disabled:opacity-40"
          style={{ color: (editor.getAttributes("textStyle").color as string | undefined) || "#475569" }}
          title="文字颜色"
        >
          {TEXT_COLORS.map(c => (
            <option key={c.label} value={c.value} style={{ color: c.value || "#475569" }}>{c.label}</option>
          ))}
        </select>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="高亮标记">
          <Highlighter size={15} />
        </ToolbarBtn>
        <Divider />
        {/* 行内格式 */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗 (Ctrl+B)">
          <Bold size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体 (Ctrl+I)">
          <Italic size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="下划线 (Ctrl+U)">
          <UnderlineIcon size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线">
          <Strikethrough size={15} />
        </ToolbarBtn>
        <Divider />
        {/* 对齐 */}
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="左对齐">
          <AlignLeft size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="居中">
          <AlignCenter size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="右对齐">
          <AlignRight size={15} />
        </ToolbarBtn>
        <Divider />
        {/* 块级 */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">
          <List size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表">
          <ListOrdered size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用块">
          <Quote size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分隔线">
          <Minus size={15} />
        </ToolbarBtn>
        <Divider />
        {/* 链接 */}
        <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="插入/编辑链接">
          <Link2 size={15} />
        </ToolbarBtn>
        {editor.isActive("link") && (
          <ToolbarBtn onClick={() => editor.chain().focus().unsetLink().run()} title="移除链接">
            <Link2Off size={15} />
          </ToolbarBtn>
        )}
        {/* 图片 */}
        {onUploadImage && (
          <>
            <ToolbarBtn onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} title="插入图片">
              {uploadingImage ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
            </ToolbarBtn>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploadingImage(true);
                try {
                  const url = await onUploadImage(file);
                  editor.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, "") }).run();
                } catch {
                  /* 上传方负责 toast 提示 */
                } finally {
                  setUploadingImage(false);
                }
              }}
            />
          </>
        )}
        {/* 表格 */}
        <ToolbarBtn
          onClick={() => {
            if (editor.isActive("table")) editor.chain().focus().deleteTable().run();
            else editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          }}
          active={editor.isActive("table")}
          title={editor.isActive("table") ? "删除表格" : "插入表格(3×3)"}
        >
          <TableIcon size={15} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="清除格式">
          <RemoveFormatting size={15} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销 (Ctrl+Z)">
          <Undo2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做 (Ctrl+Shift+Z)">
          <Redo2 size={15} />
        </ToolbarBtn>
        {enableSourceMode && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setSourceMode(s => !s); }}
              title={sourceMode ? "返回可视化编辑" : "编辑 HTML 源码"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                sourceMode ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              <FileCode2 size={14} /> {sourceMode ? "可视化" : "源码"}
            </button>
          </>
        )}
      </div>

      {/* 编辑区 */}
      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{ minHeight: minHeight ?? "200px" }}
          className="w-full px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-700 outline-none resize-y rounded-b-xl bg-slate-50/50"
          placeholder="在此直接编辑 HTML 源码…"
        />
      ) : (
        <div style={minHeight ? { minHeight } : undefined} className="cursor-text" onClick={() => editor.commands.focus()}>
          <EditorContent editor={editor} className="px-4 py-3" />
        </div>
      )}
    </div>
  );
}
