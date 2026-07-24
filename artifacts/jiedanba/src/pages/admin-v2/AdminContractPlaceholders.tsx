import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { v2Get } from "@/lib/v2api";
import { getAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import type { ContractPlaceholderDef } from "@workspace/db";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function v2Put<T>(path: string, body: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? `请求失败`); }
  return res.json() as Promise<T>;
}

async function v2Post<T>(path: string, body: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? `请求失败`); }
  return res.json() as Promise<T>;
}

async function v2Delete(path: string) {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? `请求失败`); }
}

const GROUP_LABELS: Record<string, string> = {
  demand: "需求",
  order: "订单",
  payment: "付款",
  milestone: "里程碑",
  platform: "平台",
  party_a: "甲方",
  party_b: "乙方",
};

const GROUP_COLORS: Record<string, string> = {
  demand: "default",
  order: "secondary",
  payment: "outline",
  milestone: "outline",
  platform: "destructive",
  party_a: "default",
  party_b: "secondary",
};

interface PlaceholderListRes {
  items: ContractPlaceholderDef[];
}

const DEFAULT_FORM = {
  key: "",
  label: "",
  description: "",
  group: "demand" as ContractPlaceholderDef["group"],
  sourceField: "",
  exampleValue: "",
  sortOrder: 100,
};

export default function AdminContractPlaceholders() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<ContractPlaceholderDef | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [groupFilter, setGroupFilter] = useState("");

  const { data, isLoading } = useQuery<PlaceholderListRes>({
    queryKey: ["admin-contract-placeholder-defs"],
    queryFn: () => v2Get<PlaceholderListRes>("/contract-placeholder-defs"),
  });

  const saveMut = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editItem) {
        const { key: _k, group: _g, ...rest } = values;
        return v2Put(`/contract-placeholder-defs/${editItem.id}`, rest);
      }
      return v2Post(`/contract-placeholder-defs`, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contract-placeholder-defs"] });
      setShowForm(false);
      toast({ title: editItem ? "已更新" : "已创建" });
    },
    onError: (e: Error) => toast({ title: "保存失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => v2Delete(`/contract-placeholder-defs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contract-placeholder-defs"] });
      toast({ title: "已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditItem(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  }

  function openEdit(item: ContractPlaceholderDef) {
    setEditItem(item);
    setForm({
      key: item.key,
      label: item.label,
      description: item.description ?? "",
      group: item.group,
      sourceField: item.sourceField ?? "",
      exampleValue: item.exampleValue ?? "",
      sortOrder: item.sortOrder,
    });
    setShowForm(true);
  }

  const allItems = data?.items ?? [];
  const items = groupFilter ? allItems.filter(i => i.group === groupFilter) : allItems;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">合同占位符管理</h2>
        <Button size="sm" onClick={openCreate} className="flex items-center gap-1">
          <Plus className="h-4 w-4" /> 新建占位符
        </Button>
      </div>

      <div className="flex gap-2">
        <Select value={groupFilter || "__all__"} onValueChange={v => setGroupFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="全部分组" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部分组</SelectItem>
            {Object.entries(GROUP_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>占位符 key</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>分组</TableHead>
              <TableHead>来源字段</TableHead>
              <TableHead>示例值</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">加载中…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无占位符</TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm text-blue-600">{item.key}</TableCell>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell>
                  <Badge variant={GROUP_COLORS[item.group] as any}>
                    {GROUP_LABELS[item.group] ?? item.group}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{item.sourceField || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.exampleValue || "—"}</TableCell>
                <TableCell>
                  {item.isBuiltin ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" /> 内置
                    </div>
                  ) : (
                    <span className="text-xs text-green-600">自定义</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!item.isBuiltin && (
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`确认删除占位符「${item.key}」？`)) deleteMut.mutate(item.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "编辑占位符" : "新建占位符"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>占位符 key *</Label>
              <Input
                value={form.key}
                disabled={!!editItem}
                onChange={e => setForm(prev => ({ ...prev, key: e.target.value }))}
                placeholder="格式：{{变量名}}，如 {{合同金额}}"
                className="font-mono"
              />
              {!editItem && <p className="text-xs text-muted-foreground">必须以 {"{{"}...{"}} "}格式，创建后不可修改</p>}
            </div>
            <div className="space-y-1">
              <Label>显示标签 *</Label>
              <Input
                value={form.label}
                onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="如：合同金额"
              />
            </div>
            <div className="space-y-1">
              <Label>描述</Label>
              <Input
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="简要描述该占位符的含义"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>分组 *</Label>
                <Select
                  value={form.group}
                  disabled={!!editItem}
                  onValueChange={v => setForm(prev => ({ ...prev, group: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GROUP_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 100 }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>来源字段</Label>
              <Input
                value={form.sourceField}
                onChange={e => setForm(prev => ({ ...prev, sourceField: e.target.value }))}
                placeholder="如：client_demands.budget_max"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>示例值</Label>
              <Input
                value={form.exampleValue}
                onChange={e => setForm(prev => ({ ...prev, exampleValue: e.target.value }))}
                placeholder="如：100000.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending || !form.key.trim() || !form.label.trim()}
            >
              {saveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
