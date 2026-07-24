import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { v2Get, v2Fetch, v2Delete, v2Url } from "@/lib/v2api";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Eye, RefreshCw, FileText } from "lucide-react";
import type { ContractTemplate } from "@workspace/db";

interface TemplateListRes {
  total: number;
  page: number;
  limit: number;
  items: ContractTemplate[];
}

const CHANNEL_LABELS: Record<string, string> = { a: "A 通道（发单方）", b: "B 通道（OPC）" };
const SIGN_TYPE_LABELS: Record<string, string> = { company: "企业签署", personal: "个人签署", both: "企业+个人" };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function v2Put<T>(path: string, body: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function v2Post<T>(path: string, body: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const DEFAULT_FORM = {
  title: "",
  demandType: "",
  channel: "a" as "a" | "b",
  signType: "company" as "company" | "personal" | "both",
  isStandard: true,
  markdownContent: "",
  esignTemplateId: "",
  isActive: true,
};

export default function AdminContractTemplates() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [editItem, setEditItem] = useState<ContractTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [previewMd, setPreviewMd] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const saveMut = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editItem) {
        return v2Put(`/contract-templates/${editItem.id}`, values);
      }
      return v2Post(`/contract-templates`, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contract-templates"] });
      setShowForm(false);
      toast({ title: editItem ? "已更新" : "已创建" });
    },
    onError: (e: Error) => toast({ title: "保存失败", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (item: ContractTemplate) =>
      v2Put(`/contract-templates/${item.id}`, { isActive: !item.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-contract-templates"] }),
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => v2Delete(`/contract-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contract-templates"] });
      toast({ title: "已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditItem(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  }

  function openEdit(item: ContractTemplate) {
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
    });
    setShowForm(true);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = getAccessToken();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/v2/contract-templates/parse-file`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as any).error ?? "上传失败");
      }
      const { markdownContent, originalFileUrl, originalFileName } = await res.json();
      setForm(prev => ({ ...prev, markdownContent, originalFileName, originalFileUrl }));
      toast({ title: "文件解析成功", description: "已自动填入 Markdown 内容" });
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

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
          <SelectTrigger className="w-44">
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
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无模板</TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>{item.demandType || <span className="text-muted-foreground text-xs">通用</span>}</TableCell>
                <TableCell>
                  <Badge variant={item.channel === "a" ? "default" : "secondary"}>
                    {CHANNEL_LABELS[item.channel]}
                  </Badge>
                </TableCell>
                <TableCell>{SIGN_TYPE_LABELS[item.signType]}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {item.esignTemplateId || "—"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={item.isActive}
                    onCheckedChange={() => toggleMut.mutate(item)}
                    disabled={toggleMut.isPending}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {item.markdownContent && (
                      <Button variant="ghost" size="icon" title="预览内容" onClick={() => setPreviewMd(item.markdownContent!)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`确认删除模板「${item.title}」？`)) deleteMut.mutate(item.id); }}
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

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "编辑合同模板" : "新建合同模板"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>模板名称 *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="如：标准OPC服务合同（A通道）"
                />
              </div>
              <div className="space-y-1">
                <Label>适用需求类型</Label>
                <Input
                  value={form.demandType}
                  onChange={e => setForm(prev => ({ ...prev, demandType: e.target.value }))}
                  placeholder="留空表示通用，如：software_dev"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>合同通道 *</Label>
                <Select value={form.channel} onValueChange={v => setForm(prev => ({ ...prev, channel: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">A 通道（平台→发单方）</SelectItem>
                    <SelectItem value="b">B 通道（平台→OPC）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>对方签署方式</Label>
                <Select value={form.signType} onValueChange={v => setForm(prev => ({ ...prev, signType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">企业签署</SelectItem>
                    <SelectItem value="personal">个人签署</SelectItem>
                    <SelectItem value="both">企业+个人均可</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>e签宝模板 ID</Label>
              <Input
                value={form.esignTemplateId}
                onChange={e => setForm(prev => ({ ...prev, esignTemplateId: e.target.value }))}
                placeholder="在 e签宝开放平台创建模板后填入，留空则使用PDF直接发起"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>合同正文（Markdown）</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    导入 PDF / DOCX
                  </Button>
                </div>
              </div>
              <Textarea
                value={form.markdownContent}
                onChange={e => setForm(prev => ({ ...prev, markdownContent: e.target.value }))}
                placeholder="在此编写合同正文 Markdown，使用 {{占位符}} 插入动态内容，如 {{需求编号}} {{甲方名称}}"
                className="font-mono text-sm min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground">
                使用 {"{{占位符}}"} 语法插入动态字段，如 {"{{需求编号}} {{甲方名称}} {{签署日期}}"}。占位符列表见「合同占位符管理」。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(prev => ({ ...prev, isActive: v }))}
              />
              <Label>启用此模板</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending || !form.title.trim()}
            >
              {saveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewMd !== null} onOpenChange={() => setPreviewMd(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />合同正文预览</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-muted rounded p-4 font-mono">
            {previewMd}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
