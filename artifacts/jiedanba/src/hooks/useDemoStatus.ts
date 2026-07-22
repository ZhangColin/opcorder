import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";

export type DemoStatus = "generating" | "ready" | "updating" | "error";

export interface DemoData {
  status: DemoStatus;
  version: number;
  files: Record<string, string> | null;
  dependencies: Record<string, string>;
  entryFile: string;
  errorMsg?: string;
  updatedAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchDemo(demandId: number): Promise<DemoData | null> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/demands/${demandId}/demo`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("获取 Demo 状态失败");
  return res.json();
}

export function useDemoStatus(demandId: number | undefined) {
  return useQuery<DemoData | null>({
    queryKey: ["demo", demandId],
    queryFn: () => fetchDemo(demandId!),
    enabled: !!demandId,
    refetchInterval: (query) => {
      const data = query.state.data as DemoData | null | undefined;
      if (!data) return false;
      if (data.status === "generating" || data.status === "updating") return 5000;
      return false;
    },
    staleTime: 3000,
  });
}
