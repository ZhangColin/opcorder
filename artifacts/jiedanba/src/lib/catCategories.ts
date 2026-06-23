import { useQuery } from "@tanstack/react-query";
import { STORAGE_BASE } from "@/lib/v2api";

export interface CatCategory {
  id: number;
  code: string;
  name: string;
}

const LEGACY_LABELS: Record<string, string> = {
  website:     "网站建设",
  app:         "App 开发",
  miniprogram: "小程序",
  ecommerce:   "电商运营",
  design:      "设计制作",
  marketing:   "营销推广",
  education:   "教育培训",
  software:    "软件开发",
  content:     "内容设计",
  other:       "其他",
};

export function useDemandTypeLabel() {
  const { data: categories = [] } = useQuery<CatCategory[]>({
    queryKey: ["cat-categories-public"],
    queryFn: () =>
      fetch(`${STORAGE_BASE}/api/cat-categories`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
    staleTime: 10 * 60 * 1000,
  });

  const codeMap = new Map(categories.map(c => [c.code, c.name]));
  const nameSet = new Set(categories.map(c => c.name));

  function resolveDemandType(type: string | null | undefined): string {
    if (!type) return "—";
    if (nameSet.has(type)) return type;
    if (codeMap.has(type)) return codeMap.get(type)!;
    if (LEGACY_LABELS[type]) return LEGACY_LABELS[type];
    return type;
  }

  return { resolveDemandType, categories };
}
