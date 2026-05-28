import { Star, Timer, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { BidApplication } from "@workspace/api-client-react";

type QuoteLayer = {
  code: string;
  label: string;
  tier: string;
  tierLabel: string;
  price?: number;
  coefficient?: number;
};

type QuoteSnapshot = {
  baseLayers?: QuoteLayer[];
  adjustLayers?: QuoteLayer[];
  adjustmentPercent?: number;
  adjustmentReason?: string;
  rawBase?: number;
  calibratedBase?: number;
  factorProduct?: number;
  adjustedPrice?: number;
  maintenanceFee?: number;
  finalPrice?: number;
  maintenanceTierLabel?: string;
};

interface Props {
  bids: BidApplication[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  onSelectBid: (bid: BidApplication) => void;
  selectedBidId?: number | null;
  commissionRate?: number;
}

const OPC_LEVEL_COLOR: Record<string, string> = {
  C: "bg-slate-100 text-slate-600",
  B: "bg-blue-100 text-blue-700",
  A: "bg-amber-100 text-amber-700",
};

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={10}
          className={s <= Math.round(score) ? "fill-amber-400 text-amber-400" : "text-slate-200"}
        />
      ))}
      <span className="text-[11px] text-slate-500 ml-1">{score.toFixed(1)}</span>
    </div>
  );
}

function asSnap(raw: Record<string, unknown> | null | undefined): QuoteSnapshot | null {
  if (!raw) return null;
  return raw as unknown as QuoteSnapshot;
}

function collectDimRows(bids: BidApplication[]): { section: "base" | "adjust"; code: string; label: string }[] {
  const baseCodes: Map<string, string> = new Map();
  const adjustCodes: Map<string, string> = new Map();
  for (const bid of bids) {
    const snap = asSnap(bid.quoteCardSnapshot);
    if (!snap) continue;
    for (const l of snap.baseLayers ?? []) {
      if (!baseCodes.has(l.code)) baseCodes.set(l.code, l.label);
    }
    for (const l of snap.adjustLayers ?? []) {
      if (!adjustCodes.has(l.code)) adjustCodes.set(l.code, l.label);
    }
  }
  const rows: { section: "base" | "adjust"; code: string; label: string }[] = [];
  baseCodes.forEach((label, code) => rows.push({ section: "base", code, label }));
  adjustCodes.forEach((label, code) => rows.push({ section: "adjust", code, label }));
  return rows;
}

export function QuoteCardCompareView({ bids, budgetMin, budgetMax, onSelectBid, selectedBidId, commissionRate = 0.10 }: Props) {
  const adjBasePrice = (p: number) => Math.round(p / (1 - commissionRate));
  const adjRawBase = (raw: number) => Math.round(raw / (1 - commissionRate));
  const pendingBids = bids.filter(b => b.status === "pending");
  const sortedBids = [...pendingBids].sort((a, b) => {
    const pa = a.quotedPrice ?? 0;
    const pb = b.quotedPrice ?? 0;
    if (pa === 0 && pb === 0) return 0;
    if (pa === 0) return 1;
    if (pb === 0) return -1;
    return pa - pb;
  });

  const quotedBids = sortedBids.filter(b => (b.quotedPrice ?? 0) > 0 && b.quoteCardSnapshot);
  const plainBids = sortedBids.filter(b => !((b.quotedPrice ?? 0) > 0 && b.quoteCardSnapshot));

  const dimRows = collectDimRows(quotedBids);
  const hasBaseRows = dimRows.some(r => r.section === "base");
  const hasAdjRows = dimRows.some(r => r.section === "adjust");

  function isOverBudget(price?: number | null) {
    if (!price || price <= 0) return false;
    if (budgetMax && price > budgetMax) return true;
    return false;
  }

  function isBelowBudget(price?: number | null) {
    if (!price || price <= 0) return false;
    if (budgetMin && price < budgetMin) return true;
    return false;
  }

  const hasCompare = quotedBids.length >= 1;

  return (
    <div className="space-y-4">
      {(budgetMin || budgetMax) && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <span className="font-bold text-slate-600">预算区间：</span>
          <span className="font-mono font-bold text-primary">
            ¥{(budgetMin ?? 0).toLocaleString()} ~ ¥{(budgetMax ?? 0).toLocaleString()}
          </span>
          <span className="text-slate-400 ml-2">· 超出预算区间的报价列将标红提示</span>
        </div>
      )}

      {hasCompare && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="w-36 min-w-36 bg-slate-50 border-b border-r border-slate-200 px-4 py-3 text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">报价维度</span>
                </th>
                {quotedBids.map((bid, idx) => {
                  const over = isOverBudget(bid.quotedPrice);
                  const below = isBelowBudget(bid.quotedPrice);
                  const isLowest = idx === 0;
                  return (
                    <th
                      key={bid.id}
                      className={`min-w-44 border-b border-r border-slate-200 px-4 py-3 last:border-r-0 ${over ? "bg-red-50" : below ? "bg-amber-50" : isLowest ? "bg-green-50" : "bg-white"}`}
                    >
                      <div className="space-y-2">
                        {isLowest && !over && (
                          <div className="inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            🏆 最低价
                          </div>
                        )}
                        {over && (
                          <div className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            <AlertTriangle size={9} /> 超出预算
                          </div>
                        )}
                        {below && !over && (
                          <div className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            <TrendingDown size={9} /> 低于下限
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0 overflow-hidden">
                            {bid.opcAvatar
                              ? <img src={bid.opcAvatar} alt={bid.opcNickname} className="w-full h-full object-cover" />
                              : (bid.opcNickname?.[0] ?? "O")}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-sm text-slate-800 truncate">{bid.opcNickname ?? `OPC #${bid.opcId}`}</span>
                              {bid.opcLevel && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${OPC_LEVEL_COLOR[bid.opcLevel] ?? "bg-slate-100 text-slate-600"}`}>
                                  {bid.opcLevel}级
                                </span>
                              )}
                            </div>
                            {bid.opcCreditScore !== undefined && <StarRating score={bid.opcCreditScore} />}
                            {bid.opcCompletedOrders !== undefined && (
                              <span className="text-[10px] text-slate-400">已完成 {bid.opcCompletedOrders} 单</span>
                            )}
                          </div>
                        </div>
                        {bid.estimatedDays && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Timer size={11} /> 预计 {bid.estimatedDays} 天
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hasBaseRows && (
                <tr>
                  <td colSpan={quotedBids.length + 1} className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">基准层</span>
                  </td>
                </tr>
              )}
              {dimRows.filter(r => r.section === "base").map(row => (
                <tr key={row.code} className="hover:bg-slate-50/50 transition-colors">
                  <td className="border-b border-r border-slate-100 px-4 py-3 bg-slate-50">
                    <span className="text-xs font-bold text-slate-600">{row.label}</span>
                    <span className="text-[10px] text-slate-400 ml-1 font-mono">{row.code}</span>
                  </td>
                  {quotedBids.map(bid => {
                    const snap = asSnap(bid.quoteCardSnapshot);
                    const layer = (snap?.baseLayers ?? []).find(l => l.code === row.code);
                    const over = isOverBudget(bid.quotedPrice);
                    const below = isBelowBudget(bid.quotedPrice);
                    return (
                      <td key={bid.id} className={`border-b border-r border-slate-100 px-4 py-3 last:border-r-0 text-center ${over ? "bg-red-50/40" : below ? "bg-amber-50/40" : ""}`}>
                        {layer ? (
                          <div>
                            <div className="text-sm font-bold text-slate-700">{layer.tierLabel}</div>
                            <div className="text-xs text-slate-400 mt-0.5">+¥{adjBasePrice(layer.price ?? 0).toLocaleString()}</div>
                          </div>
                        ) : (
                          <Minus size={14} className="text-slate-200 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {dimRows.filter(r => r.section === "base").length > 0 && (
                <tr className="bg-slate-50/60">
                  <td className="border-b border-r border-slate-200 px-4 py-2.5 bg-slate-50">
                    <span className="text-xs font-bold text-slate-500">基准小计</span>
                  </td>
                  {quotedBids.map(bid => {
                    const snap = asSnap(bid.quoteCardSnapshot);
                    const over = isOverBudget(bid.quotedPrice);
                    const below = isBelowBudget(bid.quotedPrice);
                    return (
                      <td key={bid.id} className={`border-b border-r border-slate-200 px-4 py-2.5 last:border-r-0 text-center ${over ? "bg-red-50/40" : below ? "bg-amber-50/40" : ""}`}>
                        <span className="text-sm font-bold text-slate-700">¥{adjRawBase(snap?.rawBase ?? 0).toLocaleString()}</span>
                      </td>
                    );
                  })}
                </tr>
              )}

              {dimRows.some(r => r.section === "base") && quotedBids.some(b => (asSnap(b.quoteCardSnapshot)?.adjustmentPercent ?? 0) !== 0) && (
                <tr className="bg-violet-50/30">
                  <td className="border-b border-r border-slate-100 px-4 py-2.5 bg-violet-50/50">
                    <span className="text-xs font-bold text-violet-600">OPC自调</span>
                  </td>
                  {quotedBids.map(bid => {
                    const snap = asSnap(bid.quoteCardSnapshot);
                    const adj = snap?.adjustmentPercent ?? 0;
                    const over = isOverBudget(bid.quotedPrice);
                    const below = isBelowBudget(bid.quotedPrice);
                    return (
                      <td key={bid.id} className={`border-b border-r border-slate-100 px-4 py-2.5 last:border-r-0 text-center ${over ? "bg-red-50/40" : below ? "bg-amber-50/40" : ""}`}>
                        {adj !== 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            {adj > 0
                              ? <TrendingUp size={12} className="text-red-500" />
                              : <TrendingDown size={12} className="text-green-500" />}
                            <span className={`text-xs font-bold ${adj > 0 ? "text-red-600" : "text-green-600"}`}>
                              {adj > 0 ? "+" : ""}{adj}%
                            </span>
                          </div>
                        ) : (
                          <Minus size={14} className="text-slate-200 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {hasAdjRows && (
                <tr>
                  <td colSpan={quotedBids.length + 1} className="px-4 py-2 bg-amber-50/60 border-b border-slate-200">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">调整层（系数）</span>
                  </td>
                </tr>
              )}
              {dimRows.filter(r => r.section === "adjust").map(row => (
                <tr key={row.code} className="hover:bg-slate-50/50 transition-colors">
                  <td className="border-b border-r border-slate-100 px-4 py-3 bg-amber-50/30">
                    <span className="text-xs font-bold text-amber-700">{row.label}</span>
                    <span className="text-[10px] text-slate-400 ml-1 font-mono">{row.code}</span>
                  </td>
                  {quotedBids.map(bid => {
                    const snap = asSnap(bid.quoteCardSnapshot);
                    const layer = (snap?.adjustLayers ?? []).find(l => l.code === row.code);
                    const over = isOverBudget(bid.quotedPrice);
                    const below = isBelowBudget(bid.quotedPrice);
                    return (
                      <td key={bid.id} className={`border-b border-r border-slate-100 px-4 py-3 last:border-r-0 text-center ${over ? "bg-red-50/40" : below ? "bg-amber-50/40" : ""}`}>
                        {layer ? (
                          <div>
                            <div className="text-sm font-bold text-amber-700">{layer.tierLabel}</div>
                            <div className="text-xs text-slate-400 mt-0.5">×{layer.coefficient}</div>
                          </div>
                        ) : (
                          <Minus size={14} className="text-slate-200 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}


              <tr className="bg-slate-50">
                <td className="border-b border-r border-slate-200 px-4 py-3">
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">最终报价</span>
                </td>
                {quotedBids.map(bid => {
                  const over = isOverBudget(bid.quotedPrice);
                  const below = isBelowBudget(bid.quotedPrice);
                  return (
                    <td key={bid.id} className={`border-b border-r border-slate-200 px-4 py-3 last:border-r-0 text-center ${over ? "bg-red-50" : below ? "bg-amber-50" : ""}`}>
                      {over ? (
                        <div className="space-y-1">
                          <div className="text-xl font-black text-red-600">¥{(bid.quotedPrice as number).toLocaleString()}</div>
                          <div className="text-[10px] text-red-500 font-bold flex items-center justify-center gap-0.5">
                            <AlertTriangle size={9} /> 超出预算 ¥{((bid.quotedPrice as number) - (budgetMax ?? 0)).toLocaleString()}
                          </div>
                        </div>
                      ) : below ? (
                        <div className="space-y-1">
                          <div className="text-xl font-black text-amber-600">¥{(bid.quotedPrice as number).toLocaleString()}</div>
                          <div className="text-[10px] text-amber-600 font-bold">低于预算下限</div>
                        </div>
                      ) : (
                        <div className="text-xl font-black text-green-600">¥{(bid.quotedPrice as number).toLocaleString()}</div>
                      )}
                    </td>
                  );
                })}
              </tr>

              <tr>
                <td className="border-r border-slate-200 px-4 py-4 bg-white">
                  <span className="text-xs text-slate-400">操作</span>
                </td>
                {quotedBids.map(bid => {
                  const over = isOverBudget(bid.quotedPrice);
                  const below = isBelowBudget(bid.quotedPrice);
                  const isSelected = selectedBidId === bid.id;
                  return (
                    <td key={bid.id} className={`border-r border-slate-200 px-4 py-4 last:border-r-0 text-center ${over ? "bg-red-50/30" : below ? "bg-amber-50/30" : ""}`}>
                      <button
                        onClick={() => onSelectBid(bid)}
                        disabled={isSelected}
                        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm ${
                          isSelected
                            ? "bg-green-100 text-green-700 cursor-default"
                            : over
                            ? "bg-red-50 border-2 border-red-300 text-red-600 hover:bg-red-100"
                            : below
                            ? "bg-amber-50 border-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                            : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                        }`}
                      >
                        {isSelected ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={14} /> 已选择
                          </span>
                        ) : (
                          "选择此报价"
                        )}
                      </button>
                      {over && !isSelected && (
                        <p className="text-[10px] text-red-400 mt-1">报价超出预算，确认后仍可选择</p>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {plainBids.length > 0 && (
        <div className="space-y-2">
          {quotedBids.length > 0 && (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2">未填报价卡 · 仅方案申请</p>
          )}
          {plainBids.map((bid, idx) => (
            <div key={bid.id} className="bg-white rounded-2xl border-2 border-slate-200 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden">
                {bid.opcAvatar
                  ? <img src={bid.opcAvatar} alt={bid.opcNickname} className="w-full h-full object-cover" />
                  : (bid.opcNickname?.[0] ?? "O")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-sm">{bid.opcNickname ?? `OPC #${bid.opcId}`}</span>
                  {bid.opcLevel && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${OPC_LEVEL_COLOR[bid.opcLevel] ?? "bg-slate-100 text-slate-600"}`}>
                      {bid.opcLevel}级
                    </span>
                  )}
                  {bid.opcCreditScore !== undefined && <StarRating score={bid.opcCreditScore} />}
                </div>
                {bid.proposal && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{bid.proposal}</p>
                )}
                {bid.estimatedDays && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Timer size={11} /> 预计 {bid.estimatedDays} 天
                  </div>
                )}
              </div>
              <button
                onClick={() => onSelectBid(bid)}
                className="shrink-0 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                选择
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingBids.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
          <p className="font-medium">暂无待审核的报价申请</p>
        </div>
      )}
    </div>
  );
}
