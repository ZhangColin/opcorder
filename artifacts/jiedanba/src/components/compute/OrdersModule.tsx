import { useQuery } from "@tanstack/react-query";
import { cList } from "./api";
import type { Order } from "./types";
import {
  Card, StatusBadge, EmptyState, LoadingState, ErrorState, TableShell, fmtDate, fenToYuan,
} from "./shared";

export default function OrdersModule() {
  const { data, isLoading, error } = useQuery<Order[]>({
    queryKey: ["/compute/orders"],
    queryFn: () => cList<Order>("/orders"),
  });

  const list = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-primary font-display">订单管理</h2>
        <p className="text-xs text-slate-400 mt-0.5">查看历史订单</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无订单" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">订单号</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">商品</th>
              <th className="px-4 py-3">金额</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">下单时间</th>
            </>
          }
        >
          {list.map((o) => (
            <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{o.orderNo}</td>
              <td className="px-4 py-3 text-slate-500">{o.itemType ?? "—"}</td>
              <td className="px-4 py-3 text-slate-700 font-bold">{o.itemName ?? "—"}</td>
              <td className="px-4 py-3 font-bold text-slate-700">{fenToYuan(o.amountFen)}</td>
              <td className="px-4 py-3"><StatusBadge status={o.status ?? undefined} /></td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(o.createdAt)}</td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  );
}
