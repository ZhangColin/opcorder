import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between py-3 border-t border-slate-100 mt-2">
      <span className="text-xs text-slate-400">{from}–{to} / 共 {total} 条</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-slate-600 px-2">第 {page} / {totalPages} 页</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
