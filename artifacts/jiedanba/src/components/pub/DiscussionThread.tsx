import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Paperclip, Loader2, Reply } from "lucide-react";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Post {
  id: number;
  parentType: string;
  parentId: number;
  replyToId: number | null;
  content: string;
  attachments: Array<{ name: string; url: string }>;
  isInternal: boolean;
  authorId: number;
  authorNickname: string;
  authorRole: string;
  createdAt: string;
}

interface DiscussionThreadProps {
  parentType: string;
  parentId: number;
  placeholder?: string;
  readOnly?: boolean;
}

function RoleTag({ role }: { role: string }) {
  if (role === "admin") return <span className="text-[10px] bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 font-bold">运营方</span>;
  if (role === "publisher") return <span className="text-[10px] bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-bold">发单方</span>;
  if (role === "opc") return <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5 font-bold">OPC</span>;
  return null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DiscussionThread({ parentType, parentId, placeholder = "输入回复内容…", readOnly = false }: DiscussionThreadProps) {
  const { toast } = useToast();
  const { userId } = useCurrentUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyToNickname, setReplyToNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await v2Get<{ items: Post[] }>(`/discussions?parentType=${parentType}&parentId=${parentId}&limit=200`);
      setPosts(data.items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [parentType, parentId]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setAttachments(prev => [...prev, { name: file.name, url }]);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const newPost = await v2Post<Post>("/discussions", {
        parentType,
        parentId,
        replyToId,
        content: content.trim(),
        attachments,
      });
      setPosts(prev => [...prev, newPost]);
      setContent("");
      setAttachments([]);
      setReplyToId(null);
      setReplyToNickname("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: any) {
      toast({ title: "发送失败", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> 加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-6">暂无讨论，率先发起对话</p>
      )}

      <div className="space-y-3">
        {posts.map(post => {
          const isMine = post.authorId === userId;
          const replyTarget = post.replyToId ? posts.find(p => p.id === post.replyToId) : null;
          return (
            <div key={post.id} className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {post.authorNickname?.[0] ?? "?"}
              </div>
              <div className={`max-w-[75%] space-y-1 ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`flex items-center gap-2 text-xs text-slate-400 ${isMine ? "flex-row-reverse" : ""}`}>
                  <span className="font-medium text-slate-600">{post.authorNickname}</span>
                  <RoleTag role={post.authorRole} />
                  <span>{formatTime(post.createdAt)}</span>
                  {!readOnly && (
                    <button
                      onClick={() => { setReplyToId(post.id); setReplyToNickname(post.authorNickname); }}
                      className="hover:text-primary transition-colors"
                    >
                      <Reply size={12} />
                    </button>
                  )}
                </div>
                {replyTarget && (
                  <div className="text-xs text-slate-400 border-l-2 border-slate-300 pl-2 py-0.5 bg-slate-50 rounded-r italic">
                    {replyTarget.authorNickname}：{replyTarget.content.slice(0, 50)}{replyTarget.content.length > 50 ? "…" : ""}
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  isMine ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-slate-200 rounded-tl-sm"
                }`}>
                  {post.content}
                </div>
                {post.attachments?.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    className={`text-xs flex items-center gap-1 underline ${isMine ? "text-white/80" : "text-primary"}`}>
                    <Paperclip size={11} /> {a.name}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          {replyToId && (
            <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 border-b border-slate-200 text-xs text-slate-500">
              <span>回复 <strong>{replyToNickname}</strong></span>
              <button onClick={() => { setReplyToId(null); setReplyToNickname(""); }} className="text-slate-400 hover:text-red-500">✕</button>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-2">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-lg px-2 py-1">
                  <Paperclip size={11} /> {a.name}
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-blue-400 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
          )}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
            placeholder={placeholder}
            rows={3}
            className="w-full px-4 py-3 text-sm outline-none resize-none bg-transparent placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </button>
              <span className="text-xs text-slate-300">⌘+Enter 快捷发送</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="flex items-center gap-1.5 bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
