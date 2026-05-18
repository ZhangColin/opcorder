import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 格式化预算区间，优先显示 budgetMin–budgetMax，相同时显示单值，兜底 budget 字段 */
export function formatBudget(min?: number | null, max?: number | null, fallback?: number | null): string {
  const lo = min ?? fallback ?? 0;
  const hi = max ?? fallback ?? 0;
  if (!lo && !hi) return "面议";
  if (!hi || lo === hi) return `¥${lo.toLocaleString()}`;
  return `¥${lo.toLocaleString()} – ¥${hi.toLocaleString()}`;
}
