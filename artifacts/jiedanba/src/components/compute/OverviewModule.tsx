import { useQuery } from "@tanstack/react-query";
import { Code2, Cpu, Zap, Wallet, ShoppingCart, Receipt, CheckCircle2 } from "lucide-react";
import { cGet } from "./api";
import type { Overview } from "./types";
import { Card, LoadingState, ErrorState, StatusBadge, fenToYuan, fmtDate } from "./shared";

function TaskCard({
  icon,
  title,
  running,
  total,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  running: number;
  total: number;
  color: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="text-2xl font-black text-primary font-display">
            {running}
            <span className="text-sm font-bold text-slate-400"> / {total}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">运行中 / 总数</p>
    </Card>
  );
}

const GUIDE_STEPS = [
  { n: 1, label: "创建开发环境" },
  { n: 2, label: "提交训练任务" },
  { n: 3, label: "部署推理服务" },
  { n: 4, label: "调用 API 接口" },
];

export default function OverviewModule() {
  const { data, isLoading, error } = useQuery<Overview>({
    queryKey: ["/compute/overview"],
    queryFn: () => cGet<Overview>("/overview"),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const nb = data?.notebooks ?? { running: 0, total: 0 };
  const tr = data?.trainingJobs ?? { running: 0, total: 0 };
  const inf = data?.inferenceServices ?? { running: 0, total: 0 };

  return (
    <div className="space-y-6">
      {/* 新手引导 */}
      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={16} className="text-primary" />
          <span className="text-sm font-bold text-primary">新手入门</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {GUIDE_STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-3 py-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  {s.n}
                </span>
                <span className="text-xs font-bold text-slate-600">{s.label}</span>
              </div>
              {i < GUIDE_STEPS.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* 任务概况 + 余额 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TaskCard icon={<Code2 size={22} className="text-blue-600" />} title="模型开发" running={nb.running} total={nb.total} color="bg-blue-50" />
        <TaskCard icon={<Cpu size={22} className="text-violet-600" />} title="模型训练" running={tr.running} total={tr.total} color="bg-violet-50" />
        <TaskCard icon={<Zap size={22} className="text-emerald-600" />} title="推理服务" running={inf.running} total={inf.total} color="bg-emerald-50" />
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50">
              <Wallet size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">可用余额</p>
              <p className="text-2xl font-black text-primary font-display">{fenToYuan(data?.balanceFen)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">账户可用余额</p>
        </Card>
      </div>

      {/* 最近订单 / 账单 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-primary">最近订单</h3>
          </div>
          {(data?.recentOrders?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">暂无订单</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data!.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{o.itemName ?? o.orderNo}</p>
                    <p className="text-[11px] text-slate-400">{fmtDate(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-slate-700">{fenToYuan(o.amountFen)}</span>
                    <StatusBadge status={o.status ?? undefined} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Receipt size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-primary">最近账单</h3>
          </div>
          {(data?.recentBills?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">暂无账单</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data!.recentBills.map((b) => {
                const income = b.direction === "income";
                return (
                  <li key={b.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{b.itemType ?? b.billNo}</p>
                      <p className="text-[11px] text-slate-400">{fmtDate(b.billedAt)}</p>
                    </div>
                    <span className={`text-sm font-bold ${income ? "text-emerald-600" : "text-red-500"}`}>
                      {income ? "+" : "-"}
                      {fenToYuan(b.amountFen)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
