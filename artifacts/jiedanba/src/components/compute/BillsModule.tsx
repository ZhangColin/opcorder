import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { cGet, cList } from "./api";
import type { Bill, Account } from "./types";
import {
  Card, EmptyState, LoadingState, ErrorState, TableShell, fmtDate, fenToYuan,
} from "./shared";

export default function BillsModule() {
  const bills = useQuery<Bill[]>({
    queryKey: ["/compute/bills"],
    queryFn: () => cList<Bill>("/bills"),
  });
  const account = useQuery<Account>({
    queryKey: ["/compute/account"],
    queryFn: () => cGet<Account>("/account"),
  });

  const list = bills.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display">账单管理</h2>
          <p className="text-xs text-slate-400 mt-0.5">账户流水明细</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-2 border border-border/50 shadow-sm">
          <Wallet size={16} className="text-amber-600" />
          <span className="text-xs font-bold text-slate-500">可用余额</span>
          <span className="text-base font-black text-primary">{fenToYuan(account.data?.balanceFen)}</span>
        </div>
      </div>

      {bills.isLoading ? (
        <LoadingState />
      ) : bills.error ? (
        <ErrorState message={(bills.error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无账单流水" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">账单号</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">方向</th>
              <th className="px-4 py-3">金额</th>
              <th className="px-4 py-3">时间</th>
            </>
          }
        >
          {list.map((b) => {
            const income = b.direction === "income";
            return (
              <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.billNo}</td>
                <td className="px-4 py-3 text-slate-500">{b.itemType ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${income ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {income ? "收入" : "支出"}
                  </span>
                </td>
                <td className={`px-4 py-3 font-bold ${income ? "text-emerald-600" : "text-red-500"}`}>
                  {income ? "+" : "-"}
                  {fenToYuan(b.amountFen)}
                </td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(b.billedAt)}</td>
              </tr>
            );
          })}
        </TableShell>
      )}
    </div>
  );
}
