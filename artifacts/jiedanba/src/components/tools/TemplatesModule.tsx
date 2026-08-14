import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Bot, Workflow, Plus, Star, LayoutTemplate } from "lucide-react";
import { MarketAgent, AppType, CATEGORIES, ListResponse, tGet, tPost } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner, GhostButton } from "./shared";

export default function TemplatesModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [appType, setAppType] = useState<"" | AppType>("");
  const [category, setCategory] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/templates"],
    queryFn: () => tGet<ListResponse<MarketAgent>>("/tools/templates"),
  });

  const addMut = useMutation({
    mutationFn: (id: number) => tPost(`/tools/templates/${id}/add-to-workspace`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/tools/agents"] });
      toast({ title: "已克隆到智能体管理", description: "可在「智能体管理」中查看并编辑" });
    },
    onError: (e: any) => toast({ title: "添加失败", description: e.message, variant: "destructive" }),
  });

  const templates = (data?.items ?? []).filter((t) => {
    if (appType && t.appType !== appType) return false;
    if (category && t.category !== category) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      if (!(`${t.name} ${t.description ?? ""}`.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="模板市场" desc="从优质模板一键开始，克隆到工作区即可自由修改" />

      <div className="relative max-w-md mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索模板"
          className="w-full rounded-xl border border-border/60 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-slate-400 font-semibold mr-1">应用类型</span>
        {([["", "全部"], ["agent", "Agent"], ["workflow", "工作流"]] as const).map(([v, l]) => (
          <GhostButton key={v} active={appType === v} onClick={() => setAppType(v)}>{l}</GhostButton>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        <span className="text-xs text-slate-400 font-semibold mr-1">标签类型</span>
        <GhostButton active={category === ""} onClick={() => setCategory("")}>全部</GhostButton>
        {CATEGORIES.map((c) => <GhostButton key={c} active={category === c} onClick={() => setCategory(c)}>{c}</GhostButton>)}
      </div>

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       templates.length === 0 ? <EmptyState text="暂无模板" icon={<LayoutTemplate size={26} className="text-primary/40" />} /> : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                  {t.appType === "agent" ? <Bot size={20} className="text-primary" /> : <Workflow size={20} className="text-primary" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{t.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">@{t.authorName ?? "官方"}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] mb-3">{t.description || "暂无描述"}</p>
              {t.tags && t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {t.tags.slice(0, 4).map((x) => <span key={x} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{x}</span>)}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-4 mt-auto">
                <span className="inline-flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" />{(t.rating ?? 0).toFixed(1)}</span>
              </div>
              <button
                onClick={() => addMut.mutate(t.id)}
                disabled={addMut.isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 border-t border-border/40 mt-0"
              >
                <Plus size={15} />添加到工作区
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
