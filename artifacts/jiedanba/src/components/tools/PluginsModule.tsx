import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Puzzle, Download, Check, ExternalLink } from "lucide-react";
import { Plugin, ListResponse, tGet, tPost } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner } from "./shared";

export default function PluginsModule() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/plugins"],
    queryFn: () => tGet<ListResponse<Plugin>>("/tools/plugins"),
  });

  const installMut = useMutation({
    mutationFn: (id: number) => tPost(`/tools/plugins/${id}/install`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/tools/plugins"] });
      toast({ title: "已安装" });
    },
    onError: (e: any) => toast({ title: "安装失败", description: e.message, variant: "destructive" }),
  });

  const plugins = data?.items ?? [];

  return (
    <div>
      <PageHeader title="工具市场" desc="安装第三方插件，扩展智能体能力" />

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       plugins.length === 0 ? <EmptyState text="暂无插件" icon={<Puzzle size={26} className="text-primary/40" />} /> : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {plugins.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <Puzzle size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{p.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">@{p.author ?? "官方"}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 line-clamp-3 min-h-[3.6rem] mb-3">{p.description || "暂无描述"}</p>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-4 mt-auto">
                <span className="inline-flex items-center gap-1"><Download size={13} />{p.installCount ?? 0} 次安装</span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                <button
                  onClick={() => installMut.mutate(p.id)}
                  disabled={installMut.isPending || p.installed}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${
                    p.installed ? "bg-green-50 text-green-600" : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  {p.installed ? <><Check size={15} />已安装</> : <><Download size={15} />安装</>}
                </button>
                <button className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl text-slate-500 border border-border/60 hover:text-primary hover:border-primary/40 transition-colors">
                  <ExternalLink size={14} />查看详情
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
