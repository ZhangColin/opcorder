import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import {
  Bold, Italic, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Undo2, Redo2, Minus, Quote, RemoveFormatting,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "请输入内容…",
  minHeight = "200px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none prose prose-sm max-w-none text-slate-700 leading-relaxed",
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({
    onClick, active, disabled, title, children,
  }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg text-sm transition-colors ${active ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"} disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
  const Sep = () => <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;

  return (
    <div className="border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="一级标题"><Heading1 size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="二级标题"><Heading2 size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="三级标题"><Heading3 size={15} /></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗"><Bold size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体"><Italic size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线"><Strikethrough size={15} /></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用块"><Quote size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表"><List size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表"><ListOrdered size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分隔线"><Minus size={15} /></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="清除格式"><RemoveFormatting size={15} /></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销"><Undo2 size={15} /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做"><Redo2 size={15} /></Btn>
      </div>
      <EditorContent editor={editor} className="px-4 py-3 cursor-text" onClick={() => editor.commands.focus()} />
    </div>
  );
}

interface RichTextViewProps {
  html: string;
  className?: string;
}

export function RichTextView({ html, className = "" }: RichTextViewProps) {
  if (!html) return null;
  return (
    <div
      className={`prose prose-sm max-w-none text-slate-700 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
