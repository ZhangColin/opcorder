import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Strikethrough, Code, Quote,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Undo2, Redo2, Minus, RemoveFormatting,
  ImagePlus, Loader2, FileCode2,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  hasError?: boolean;
  minHeight?: string;
  /** 传入后工具栏出现「插入图片」按钮:上传文件并返回可访问 URL */
  onUploadImage?: (file: File) => Promise<string>;
  /** 开启后工具栏出现「源码」切换,可直接编辑 Markdown 原文 */
  enableSourceMode?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "请详细描述任务要求、工作内容、交付物规格、验收标准等…",
  hasError = false,
  minHeight,
  onUploadImage,
  enableSourceMode = false,
}: MarkdownEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    onUpdate({ editor }) {
      const md = (editor.storage as unknown as Record<string, { getMarkdown: () => string }>).markdown.getMarkdown();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "md-editor-inner outline-none prose prose-sm max-w-none text-slate-700 leading-relaxed",
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        const html = event.clipboardData?.getData("text/html");
        // When the clipboard has both HTML and plain text and the plain text
        // looks like Markdown, bypass tiptap's HTML path.
        // tiptap-markdown's own clipboardTextParser uses `inline: true` which
        // strips all block-level structure (headings, lists, tables, code blocks).
        // Instead, we call parser.parse() WITHOUT inline:true, convert the
        // resulting HTML to a ProseMirror Slice, and dispatch it directly.
        if (html && text && /(?:^|\n)#{1,6} |^\*\*|^__|\*[^*\s]|^[-*+] |\[.+\]\(|\n```|^\d+\. /m.test(text)) {
          const mdParser = editor?.storage?.markdown?.parser;
          if (mdParser) {
            const renderedHtml = mdParser.parse(text);
            const wrapper = document.createElement("div");
            wrapper.innerHTML = renderedHtml.trim();
            const $pos = view.state.doc.resolve(view.state.selection.from);
            const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(wrapper, {
              preserveWhitespace: true,
              context: $pos,
            });
            view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync external value into editor (e.g. AI fill-in)。
  // 源码模式下不回灌:textarea 每次击键都会更新 value,若同步进 Tiptap 再被
  // markdown 序列化规范化写回,会改写用户尚未写完的源码并丢失光标位置。
  // 退出源码模式时本 effect 会因 sourceMode 变化重新执行,一次性完成同步。
  useEffect(() => {
    if (!editor || sourceMode) return;
    const currentMd = (editor.storage as unknown as Record<string, { getMarkdown: () => string }>).markdown.getMarkdown();
    if (currentMd !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor, sourceMode]);

  if (!editor) return null;

  const ToolbarBtn = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;

  return (
    <div
      className={`border rounded-xl transition focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${
        hasError ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        {/* Headings */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="一级标题"
        >
          <Heading1 size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="二级标题"
        >
          <Heading2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="三级标题"
        >
          <Heading3 size={15} />
        </ToolbarBtn>
        <Divider />
        {/* Inline formatting */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="加粗 (Ctrl+B)"
        >
          <Bold size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="斜体 (Ctrl+I)"
        >
          <Italic size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="删除线"
        >
          <Strikethrough size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="行内代码"
        >
          <Code size={15} />
        </ToolbarBtn>
        <Divider />
        {/* Block formatting */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="引用块"
        >
          <Quote size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="无序列表"
        >
          <List size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="有序列表"
        >
          <ListOrdered size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分隔线"
        >
          <Minus size={15} />
        </ToolbarBtn>
        {onUploadImage && (
          <>
            <Divider />
            <ToolbarBtn
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage || sourceMode}
              title="插入图片"
            >
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
        <Divider />
        {/* Clear + History */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="清除格式"
        >
          <RemoveFormatting size={15} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做 (Ctrl+Shift+Z)"
        >
          <Redo2 size={15} />
        </ToolbarBtn>
        {enableSourceMode && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setSourceMode(s => !s); }}
              title={sourceMode ? "返回可视化编辑" : "编辑 Markdown 源码"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                sourceMode ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              <FileCode2 size={14} /> {sourceMode ? "可视化" : "源码"}
            </button>
          </>
        )}
      </div>

      {/* Editor area — grows with content */}
      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{ minHeight: minHeight ?? "200px" }}
          className="w-full px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-700 outline-none resize-y rounded-b-xl bg-slate-50/50"
          placeholder="在此直接编辑 Markdown 源码…"
        />
      ) : (
        <div style={minHeight ? { minHeight } : undefined} className="cursor-text" onClick={() => editor.commands.focus()}>
          <EditorContent editor={editor} className="px-4 py-3" />
        </div>
      )}
    </div>
  );
}
