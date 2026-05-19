import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { useEffect } from "react";
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Undo2, Redo2, Minus,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  hasError?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "请详细描述任务要求、工作内容、交付物规格、验收标准等…",
  minHeight = 220,
  hasError = false,
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable code block to keep it simple
        codeBlock: false,
        code: false,
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
    ],
    content: "",
    onUpdate({ editor }) {
      const md = (editor.storage.markdown as { getMarkdown: () => string }).getMarkdown();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-full prose prose-sm max-w-none text-slate-700 leading-relaxed",
      },
    },
  });

  // Sync external value changes (e.g. AI fill-in) into editor
  useEffect(() => {
    if (!editor) return;
    const currentMd = (editor.storage.markdown as { getMarkdown: () => string }).getMarkdown();
    if (currentMd !== value) {
      // Set markdown content without triggering onUpdate loop
      editor.commands.setContent(value, false, { preserveWhitespace: "full" });
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

  const Divider = () => <div className="w-px h-5 bg-slate-200 mx-0.5" />;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${
        hasError ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
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
        <Divider />
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

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="px-4 py-3 cursor-text"
        style={{ minHeight }}
        onClick={() => editor.commands.focus()}
      />
    </div>
  );
}
