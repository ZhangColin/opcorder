import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost } from "./api";
import type { Favorite, RepoItem } from "./types";
import { Card, EmptyState, LoadingState, ErrorState } from "./shared";
import { RepoCard } from "./RepoModule";

export default function FavoritesModule() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<Favorite[]>({
    queryKey: ["/compute/favorites"],
    queryFn: () => cList<Favorite>("/favorites"),
  });

  const fav = useMutation({
    mutationFn: (targetId: number) => cPost("/favorites/toggle", { targetType: "repo_item", targetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/compute/favorites"] });
      toast({ title: "已取消收藏" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const list = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-primary font-display">我的收藏</h2>
        <p className="text-xs text-slate-400 mt-0.5">收藏的仓库条目</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="还没有收藏任何条目" /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((f) =>
            f.item ? (
              <RepoCard
                key={f.id}
                item={f.item as RepoItem}
                favored
                onToggleFav={() => fav.mutate((f.item as RepoItem).id)}
              />
            ) : (
              <Card key={f.id} className="flex items-center justify-center min-h-[120px]">
                <span className="text-xs font-bold text-slate-400">该条目已不可见</span>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
