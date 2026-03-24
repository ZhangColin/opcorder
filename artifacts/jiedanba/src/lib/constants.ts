export const DEMAND_TYPES: Record<string, string> = {
  ai_education: "AI教育课程开发",
  gov_training: "政企AI培训",
  ai_research: "AI研学项目",
  party_building: "党建AI应用",
  livestream_media: "直播与新媒体",
  ai_tool_dev: "AI工具开发定制",
  other: "其他",
};

export const DEMAND_STATUSES: Record<string, { label: string, color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  pending_review: { label: "待审核", color: "bg-orange-100 text-orange-700" },
  published: { label: "抢单中", color: "bg-accent/20 text-accent-foreground" },
  matched: { label: "已匹配", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "执行中", color: "bg-primary/10 text-primary" },
  pending_acceptance: { label: "待验收", color: "bg-purple-100 text-purple-700" },
  completed: { label: "已完成", color: "bg-secondary/10 text-secondary" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-500" },
};

export const ORDER_STATUSES: Record<string, { label: string, color: string }> = {
  in_progress: { label: "执行中", color: "bg-primary/10 text-primary" },
  pending_acceptance: { label: "待验收", color: "bg-orange-100 text-orange-700" },
  completed: { label: "已完成", color: "bg-secondary/10 text-secondary" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-500" },
  disputed: { label: "争议中", color: "bg-destructive/10 text-destructive" },
};

export const OPC_LEVELS: Record<string, { label: string, color: string }> = {
  C: { label: "新手", color: "bg-slate-100 text-slate-700 border-slate-200" },
  B: { label: "进阶", color: "bg-blue-50 text-blue-700 border-blue-200" },
  A: { label: "专家", color: "bg-amber-50 text-amber-700 border-amber-200" },
  any: { label: "不限", color: "bg-gray-50 text-gray-600 border-gray-200" },
};
