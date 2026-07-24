import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { v2Get } from "@/lib/v2api";
import { getAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, RefreshCw, ChevronDown, X, FileText, Download } from "lucide-react";
import type { ContractTemplate, ContractPlaceholderDef } from "@workspace/db";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(method: string, path: string, body?: unknown): Promise<any> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? `请求失败 (${res.status})`); }
  return res.json();
}

interface TemplateListRes { total: number; page: number; limit: number; items: ContractTemplate[] }
interface PlaceholderListRes { items: ContractPlaceholderDef[] }

const CHANNEL_LABELS: Record<string, string> = { a: "A（发单方）", b: "B（OPC）" };
const SIGN_TYPE_LABELS: Record<string, string> = { company: "对公签署", personal: "个人签署", both: "对公+个人" };
const GROUP_LABELS: Record<string, string> = {
  demand: "需求信息", order: "订单信息", payment: "金额付款", milestone: "里程碑",
  platform: "平台信息", party_a: "甲方信息", party_b: "乙方信息",
};

const DEFAULT_FORM = {
  title: "", demandType: "", channel: "a" as "a" | "b",
  signType: "company" as "company" | "personal" | "both",
  isStandard: true, markdownContent: "", esignTemplateId: "", isActive: true,
  variableMapping: {} as Record<string, string>,
  originalFileUrl: "", originalFileName: "",
};

/* ────────────────────────────────────────
   Inline Markdown renderer with placeholder highlighting
   ──────────────────────────────────────── */
function MarkdownPreview({ markdown, placeholders }: { markdown: string; placeholders: ContractPlaceholderDef[] }) {
  const sampleMap = Object.fromEntries(placeholders.map(p => [p.key, p.exampleValue || p.label]));

  const rendered = markdown
    .split(/(\{\{[^{}]+\}\})/g)
    .map((part, i) => {
      if (/^\{\{[^{}]+\}\}$/.test(part)) {
        const sample = sampleMap[part] ?? part.slice(2, -2);
        return (
          <mark key={i} style={{ background: "#fef08a", borderRadius: 3, padding: "0 2px" }} title={part}>
            {sample}
          </mark>
        );
      }
      return part;
    });

  const lines = markdown.split("\n");
  let inList = false;
  const elements: JSX.Element[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const h3 = raw.match(/^### (.+)/); if (h3) { elements.push(<h3 key={i} className="text-base font-bold mt-3">{renderInline(h3[1], sampleMap)}</h3>); continue; }
    const h2 = raw.match(/^## (.+)/); if (h2) { elements.push(<h2 key={i} className="text-lg font-bold mt-4">{renderInline(h2[1], sampleMap)}</h2>); continue; }
    const h1 = raw.match(/^# (.+)/); if (h1) { elements.push(<h1 key={i} className="text-xl font-bold mt-4 text-center">{renderInline(h1[1], sampleMap)}</h1>); continue; }
    if (raw.trim() === "") { elements.push(<div key={i} className="h-2" />); continue; }
    const li = raw.match(/^[-*] (.+)/);
    if (li) { elements.push(<li key={i} className="ml-4 list-disc">{renderInline(li[1], sampleMap)}</li>); continue; }
    elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(raw, sampleMap)}</p>);
  }

  return <div className="prose prose-sm max-w-none p-4 text-sm leading-relaxed">{elements}</div>;
}

function renderInline(text: string, sampleMap: Record<string, string>): React.ReactNode[] {
  return text.split(/(\{\{[^{}]+\}\})/g).map((part, i) => {
    if (/^\{\{[^{}]+\}\}$/.test(part)) {
      const sample = sampleMap[part] ?? part.slice(2, -2);
      return <mark key={i} style={{ background: "#fef08a", borderRadius: 3, padding: "0 2px" }} title={part}>{sample}</mark>;
    }
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g).map((bp, j) => {
      if (/^\*\*[^*]+\*\*$/.test(bp)) return <strong key={j}>{bp.slice(2, -2)}</strong>;
      return bp;
    });
    return <span key={i}>{boldParts}</span>;
  });
}

/* ────────────────────────────────────────
   Template workbench (3-column editor)
   ──────────────────────────────────────── */
interface WorkbenchProps {
  form: typeof DEFAULT_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof DEFAULT_FORM>>;
  placeholders: ContractPlaceholderDef[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}

function TemplateWorkbench({ form, setForm, placeholders, onSave, onCancel, saving, isNew }: WorkbenchProps) {
  const [uploading, setUploading] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groups = [...new Set(placeholders.map(p => p.group))];

  function insertAtCursor(text: string) {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const newVal = before + text + after;
    setForm(prev => ({ ...prev, markdownContent: newVal }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (form.markdownContent.trim()) {
      if (!confirm("编辑器中已有内容，上传后将自动覆盖。继续吗？")) return;
    }
    setUploading(true);
    try {
      const token = getAccessToken();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/v2/contract-templates/convert-to-markdown`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? "上传失败"); }
      const { markdownContent, originalFileUrl, originalFileName } = await res.json();
      setForm(prev => ({ ...prev, markdownContent, originalFileUrl, originalFileName }));
      toast({ title: "文件解析成功", description: "Markdown 已填入编辑器，请检查并调整内容" });
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const missingPlaceholders = (() => {
    if (!form.isStandard || !form.esignTemplateId.trim()) return [];
    const re = /\{\{[^{}]+\}\}/g;
    const found = [...(form.markdownContent.matchAll(re))].map(m => m[0]);
    const unique = [...new Set(found)];
    return unique.filter(k => !form.variableMapping[k]);
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Top meta bar */}
      <div className="flex gap-3 p-3 border-b bg-muted/30 flex-wrap items-end">
        <div className="flex-1 min-w-[160px] space-y-1">
          <Label className="text-xs">模板名称 *</Label>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="如：标准OPC服务合同（A通道）" className="h-8 text-sm" />
        </div>
        <div className="w-40 space-y-1">
          <Label className="text-xs">需求类型</Label>
          <Input value={form.demandType} onChange={e => setForm(p => ({ ...p, demandType: e.target.value }))} placeholder="留空表示通用" className="h-8 text-sm" />
        </div>
        <div className="w-40 space-y-1">
          <Label className="text-xs">通道 *</Label>
          <Select value={form.channel} onValueChange={v => setForm(p => ({ ...p, channel: v as any }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">A 通道（发单方）</SelectItem>
              <SelectItem value="b">B 通道（OPC）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-xs">签署方式</Label>
          <Select value={form.signType} onValueChange={v => setForm(p => ({ ...p, signType: v as any }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="company">对公签署</SelectItem>
              <SelectItem value="personal">个人签署</SelectItem>
              <SelectItem value="both">对公+个人</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-52 space-y-1">
          <Label className="text-xs">e签宝模板 ID</Label>
          <Input value={form.esignTemplateId} onChange={e => setForm(p => ({ ...p, esignTemplateId: e.target.value }))} placeholder="留空则使用PDF直接发起" className="h-8 text-sm font-mono" />
        </div>
        <div className="flex items-center gap-4 self-end pb-0.5">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Switch checked={form.isStandard} onCheckedChange={v => setForm(p => ({ ...p, isStandard: v }))} />
            标准合同
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
            启用
          </label>
        </div>
      </div>

      {/* Validation warning */}
      {missingPlaceholders.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          ⚠ 标准合同须完善变量映射，以下占位符尚未映射到 e签宝变量名：
          <span className="font-mono ml-1">{missingPlaceholders.join("、")}</span>
        </div>
      )}

      {/* 3-column main area */}
      <div className="flex flex-1 overflow-hidden divide-x" style={{ minHeight: 0, height: "calc(100vh - 340px)" }}>

        {/* Left: file upload */}
        <div className="w-56 shrink-0 flex flex-col bg-muted/20 p-3 gap-3 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">原始文件</p>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={handleFileUpload} />
          <Button
            type="button" variant="outline" size="sm" className="w-full flex items-center gap-1.5 text-xs" disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? "解析中…" : "上传 PDF / DOCX"}
          </Button>
          <p className="text-[11px] text-muted-foreground">上传后自动转为 Markdown 填入编辑器，需人工校对内容</p>

          {form.originalFileName && (
            <div className="bg-background rounded border p-2 text-xs space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate" title={form.originalFileName}>{form.originalFileName}</span>
              </div>
              {form.originalFileUrl && (
                <a href={form.originalFileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline text-[11px]">
                  <Download className="h-3 w-3" /> 下载原稿
                </a>
              )}
            </div>
          )}

          {/* Variable mapping (only when esignTemplateId set) */}
          {form.esignTemplateId.trim() && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">变量映射</p>
              <p className="text-[11px] text-muted-foreground">
                将合同中的 {"{{占位符}}"} 映射到 e签宝模板变量名。
              </p>
              {(() => {
                const re = /\{\{[^{}]+\}\}/g;
                const found = [...new Set([...(form.markdownContent.matchAll(re))].map(m => m[0]))];
                return found.map(key => (
                  <div key={key} className="space-y-0.5">
                    <p className="text-[11px] font-mono text-blue-700">{key}</p>
                    <Input
                      value={form.variableMapping[key] ?? ""}
                      onChange={e => setForm(p => ({
                        ...p, variableMapping: { ...p.variableMapping, [key]: e.target.value }
                      }))}
                      placeholder="e签宝变量名"
                      className="h-7 text-xs"
                    />
                  </div>
                ));
              })()}
            </>
          )}
        </div>

        {/* Middle: editor + placeholder toolbar */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-1">插入占位符：</span>
            {groups.map(g => {
              const gItems = placeholders.filter(p => p.group === g);
              return (
                <DropdownMenu key={g}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1">
                      {GROUP_LABELS[g] ?? g} <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">{GROUP_LABELS[g] ?? g}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {gItems.map(p => (
                      <DropdownMenuItem key={p.key} className="text-xs flex flex-col items-start gap-0.5"
                        onSelect={() => insertAtCursor(p.key)}>
                        <span className="font-mono text-blue-700">{p.key}</span>
                        <span className="text-muted-foreground text-[11px]">{p.label}{p.description ? ` — ${p.description}` : ""}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
          <Textarea
            ref={editorRef}
            value={form.markdownContent}
            onChange={e => setForm(p => ({ ...p, markdownContent: e.target.value }))}
            placeholder={"在此编辑合同正文（Markdown 格式）\n\n使用上方工具栏插入 {{占位符}}，或直接手写 {{占位符名称}}\n\n# 合同标题\n\n## 第一条 项目概述\n\n甲方（{{甲方名称}}）委托乙方（{{乙方名称}}）..."}
            className="flex-1 font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0"
            style={{ minHeight: 0 }}
          />
        </div>

        {/* Right: live preview */}
        <div className="w-80 shrink-0 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">实时预览</p>
            <p className="text-[11px] text-muted-foreground">占位符显示为示例值（高亮）</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {form.markdownContent.trim()
              ? <MarkdownPreview markdown={form.markdownContent} placeholders={placeholders} />
              : <p className="text-xs text-muted-foreground p-4 text-center mt-8">编辑器有内容后此处自动预览</p>
            }
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
        <Button variant="ghost" onClick={onCancel}>返回列表</Button>
        <Button onClick={onSave} disabled={saving || !form.title.trim()}>
          {saving ? "保存中…" : isNew ? "创建模板" : "保存修改"}
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   Main page: list view
   ──────────────────────────────────────── */
export default function AdminContractTemplates() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [editItem, setEditItem] = useState<ContractTemplate | null>(null);
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [form, setForm] = useState<typeof DEFAULT_FORM>(DEFAULT_FORM);
  const [isNew, setIsNew] = useState(false);

  const queryKey = ["admin-contract-templates", page, search, channelFilter];
  const { data, isLoading } = useQuery<TemplateListRes>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (channelFilter) params.set("channel", channelFilter);
      return v2Get<TemplateListRes>(`/contract-templates?${params}`);
    },
  });

  const { data: phData } = useQuery<PlaceholderListRes>({
    queryKey: ["admin-contract-placeholder-defs"],
    queryFn: () => v2Get<PlaceholderListRes>("/contract-placeholder-defs"),
  });
  const placeholders = phData?.items ?? [];

  const saveMut = useMutation({
    mutationFn: async (values: typeof DEFAULT_FORM) => {
      const payload = {
        title: values.title,
        demandType: values.demandType || undefined,
        channel: values.channel,
        signType: values.signType,
        isStandard: values.isStandard,
        markdownContent: values.markdownContent,
        esignTemplateId: values.esignTemplateId || undefined,
        variableMapping: values.variableMapping,
        isActive: values.isActive,
        originalFileUrl: values.originalFileUrl || undefined,
        originalFileName: values.originalFileName || undefined,
      };
      if (editItem) return apiFetch("PUT", `/contract-templates/${editItem.id}`, payload);
      return apiFetch("POST", `/contract-templates`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contract-templates"] });
      setShowWorkbench(false);
      toast({ title: editItem ? "已更新" : "已创建", description: form.title });
    },
    onError: (e: Error) => toast({ title: "保存失败", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (item: ContractTemplate) => apiFetch("PUT", `/contract-templates/${item.id}`, { isActive: !item.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-contract-templates"] }),
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch("DELETE", `/contract-templates/${id}`).catch(() => fetch(`${BASE}/api/v2/contract-templates/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getAccessToken()}` } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-contract-templates"] }); toast({ title: "已删除" }); },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditItem(null);
    setForm({ ...DEFAULT_FORM });
    setIsNew(true);
    setShowWorkbench(true);
  }

  async function openEdit(item: ContractTemplate) {
    setEditItem(item);
    setForm({
      title: item.title,
      demandType: item.demandType ?? "",
      channel: item.channel,
      signType: item.signType,
      isStandard: item.isStandard,
      markdownContent: item.markdownContent ?? "",
      esignTemplateId: item.esignTemplateId ?? "",
      isActive: item.isActive,
      variableMapping: (item.variableMapping as Record<string, string>) ?? {},
      originalFileUrl: item.originalFileUrl ?? "",
      originalFileName: item.originalFileName ?? "",
    });
    setIsNew(false);
    setShowWorkbench(true);
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  if (showWorkbench) {
    return (
      <div className="flex flex-col h-full">
        <TemplateWorkbench
          form={form}
          setForm={setForm}
          placeholders={placeholders}
          onSave={() => saveMut.mutate(form)}
          onCancel={() => setShowWorkbench(false)}
          saving={saveMut.isPending}
          isNew={isNew}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">合同模板管理</h2>
        <Button size="sm" onClick={openCreate} className="flex items-center gap-1">
          <Plus className="h-4 w-4" /> 新建模板
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="搜索模板名称…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-56"
        />
        <Select value={channelFilter || "__all__"} onValueChange={v => { setChannelFilter(v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部通道" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部通道</SelectItem>
            <SelectItem value="a">A 通道（发单方）</SelectItem>
            <SelectItem value="b">B 通道（OPC）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>模板名称</TableHead>
              <TableHead>需求类型</TableHead>
              <TableHead>通道</TableHead>
              <TableHead>签署方式</TableHead>
              <TableHead>e签宝模板ID</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">加载中…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无模板，点击「新建模板」开始</TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>{item.demandType || <span className="text-muted-foreground text-xs">通用</span>}</TableCell>
                <TableCell>
                  <Badge variant={item.channel === "a" ? "default" : "secondary"}>
                    {CHANNEL_LABELS[item.channel]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{SIGN_TYPE_LABELS[item.signType]}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                  {item.esignTemplateId || "—"}
                </TableCell>
                <TableCell>
                  <Switch checked={item.isActive} onCheckedChange={() => toggleMut.mutate(item)} disabled={toggleMut.isPending} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="编辑">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`确认删除模板「${item.title}」？`)) deleteMut.mutate(item.id); }}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <span className="text-sm self-center">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}
