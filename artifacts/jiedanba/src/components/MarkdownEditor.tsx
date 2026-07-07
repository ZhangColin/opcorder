import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { useEffect } from "react";
import {
  Bold, Italic, Strikethrough, Code, Quote,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Undo2, Redo2, Minus, RemoveFormatting,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  hasError?: boolean;
  minHeight?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "请详细描述任务要求、工作内容、交付物规格、验收标准等…",
  hasError = false,
  minHeight,
}: MarkdownEditorProps) {
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
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
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
    },
  });

  // Sync external value into editor (e.g. AI fill-in)
  useEffect(() => {
    if (!editor) return;
    const currentMd = (editor.storage as unknown as Record<string, { getMarkdown: () => string }>).markdown.getMarkdown();
    if (currentMd !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

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
      </div>

      {/* Editor area — grows with content */}
      <div style={minHeight ? { minHeight } : undefined} className="cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} className="px-4 py-3" />
      </div>
    </div>
  );
}
