interface QuoteTierData {
  tier: string; tierLabel: string;
  basePrice: number; coefficient?: number | null;
}
interface QuoteDimData {
  code: string; label: string;
  tiers: QuoteTierData[];
}
interface QuoteCategoryConfig {
  category: string;
  base: QuoteDimData[];
  adjustment: QuoteDimData[];
  optional: QuoteDimData[];
}

interface BdItem {
  item: string;
  amount: number;
  note?: string;
}

interface Props {
  bd: BdItem[];
  note?: string | null;
  totalPrice?: number;
  quoteConfig?: QuoteCategoryConfig | null;
}

export function BreakdownDisplay({ bd, note, totalPrice, quoteConfig }: Props) {
  if (!bd || bd.length === 0) return null;

  const isSpecial = (item: string) =>
    item.startsWith("综合调整（") ||
    item.startsWith("调整系数（×") ||
    item.startsWith("维护包（") ||
    item === "备注";

  const baseDimItems = bd.filter(b => b.amount !== 0 && !isSpecial(b.item));
  const adjustDimItems = bd.filter(b => b.amount === 0 && !isSpecial(b.item));
  const adjPctItem = bd.find(b => b.item.startsWith("综合调整（"));
  const adjFactorItem = bd.find(b => b.item.startsWith("调整系数（×"));
  const maintItem = bd.find(b => b.item.startsWith("维护包（"));

  const baseTotal = baseDimItems.reduce((s, b) => s + b.amount, 0);
  const baseAfterAdj = baseTotal + (adjPctItem?.amount ?? 0);
  const afterFactor = baseAfterAdj + (adjFactorItem?.amount ?? 0);

  const pctMatch = adjPctItem?.item.match(/([+-]?\d+(?:\.\d+)?%)/);
  const factorMatch = adjFactorItem?.item.match(/×(\d+\.\d+)/);

  const getCoefficient = (itemLabel: string): number | null => {
    if (!quoteConfig) return null;
    for (const dim of quoteConfig.adjustment ?? []) {
      for (const tier of dim.tiers) {
        if (`${dim.label}（${tier.tierLabel}）` === itemLabel) return tier.coefficient ?? null;
      }
    }
    return null;
  };

  const noteItem = bd.find(b => b.item === "备注");
  const resolvedNote = noteItem?.note ?? note ?? null;

  const hasGroups = baseDimItems.length > 0 || adjPctItem || adjustDimItems.length > 0 || adjFactorItem || maintItem;

  if (!hasGroups) {
    return (
      <div className="space-y-1 mb-3">
        {bd.map((b, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{b.item}{b.note && <span className="text-slate-400 text-xs ml-1">· {b.note}</span>}</span>
            <span className="font-medium text-slate-800">¥{Number(b.amount).toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-3">
      {/* 基准层 */}
      {baseDimItems.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">基</span>
              <span className="text-xs font-bold text-slate-600">基准层</span>
            </div>
            <span className="text-xs font-bold text-slate-700">¥{baseTotal.toLocaleString()}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {baseDimItems.map((b, i) => (
              <div key={i} className="flex justify-between items-center px-3 py-1.5 text-sm">
                <span className="text-slate-500">{b.item}</span>
                <span className="text-slate-700 font-medium">¥{b.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 微调 */}
      {adjPctItem && (
        <div className="border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-700 text-[10px] font-black flex items-center justify-center">%</span>
              <span className="text-xs font-bold text-amber-700">微调</span>
              {pctMatch && <span className="text-[11px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">{pctMatch[1]}</span>}
            </div>
            <span className="text-xs font-bold text-amber-700">→ ¥{baseAfterAdj.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-1.5 text-sm">
            <span className="text-slate-500">{adjPctItem.item}</span>
            <span className={`font-medium ${adjPctItem.amount >= 0 ? "text-amber-600" : "text-green-600"}`}>
              {adjPctItem.amount >= 0 ? "+" : ""}¥{adjPctItem.amount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* 调整层 */}
      {(adjustDimItems.length > 0 || adjFactorItem) && (
        <div className="border border-orange-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-orange-200 text-orange-700 text-[10px] font-black flex items-center justify-center">×</span>
              <span className="text-xs font-bold text-orange-700">调整层</span>
              {factorMatch && <span className="text-[11px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">×{factorMatch[1]}</span>}
            </div>
            <span className="text-xs font-bold text-orange-700">→ ¥{afterFactor.toLocaleString()}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {adjustDimItems.map((b, i) => {
              const coef = getCoefficient(b.item);
              return (
                <div key={i} className="flex justify-between items-center px-3 py-1.5 text-sm">
                  <span className="text-slate-500">{b.item}</span>
                  <span className="text-orange-500 font-medium text-xs">{coef != null ? `×${coef.toFixed(2)}` : "系数项"}</span>
                </div>
              );
            })}
            {adjFactorItem && (
              <div className="flex justify-between items-center px-3 py-1.5 text-sm bg-orange-50/40">
                <span className="text-slate-500">{adjFactorItem.item}（影响额）</span>
                <span className="text-orange-600 font-medium">+¥{adjFactorItem.amount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 可选层 / 维护包 */}
      {maintItem && (
        <div className="border border-green-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-green-50">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-green-200 text-green-700 text-[10px] font-black flex items-center justify-center">+</span>
              <span className="text-xs font-bold text-green-700">可选层</span>
            </div>
            <span className="text-xs font-bold text-green-700">+¥{maintItem.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-1.5 text-sm">
            <span className="text-slate-500">{maintItem.item}</span>
            <span className="text-green-600 font-medium">+¥{maintItem.amount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 合计 */}
      {totalPrice != null && (
        <div className="flex justify-between items-center px-3 py-1.5 bg-primary/5 rounded-xl border border-primary/10">
          <span className="text-xs font-bold text-primary">合计</span>
          <span className="text-sm font-black text-primary">¥{totalPrice.toLocaleString()}</span>
        </div>
      )}

      {/* 备注 */}
      {resolvedNote && (
        <p className="text-xs text-slate-500 p-2.5 bg-slate-50 rounded-xl border border-slate-100">💬 {resolvedNote}</p>
      )}
    </div>
  );
}
