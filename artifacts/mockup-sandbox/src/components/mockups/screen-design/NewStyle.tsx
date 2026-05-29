import { useEffect, useRef, useState } from "react";

const KF = `
  @keyframes orb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(55px,-40px)} }
  @keyframes orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-40px,45px)} }
  @keyframes orb3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,35px)} }
  @keyframes feedScroll { from{transform:translateY(0)} to{transform:translateY(-50%)} }
  @keyframes tickerScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
`;

/* ── Glass Panel ─────────────────────────────── */
function Panel({ children, title, className = "" }: {
  children: React.ReactNode; title?: string; className?: string
}) {
  return (
    <div className={`relative rounded-2xl overflow-hidden flex flex-col ${className}`}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
      }}>
      {title && (
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Gradient indicator bar */}
          <div className="w-1 h-5 rounded-full" style={{ background: "linear-gradient(180deg, #c084fc, #f472b6)" }} />
          <span className="text-[18px] font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.85)" }}>{title}</span>
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0 p-3">
        {children}
      </div>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────── */
function KpiCard({ title, value, sub, gradFrom, gradTo, delay = 0 }: {
  title: string; value: string; sub?: string; gradFrom: string; gradTo: string; delay?: number
}) {
  return (
    <div className="relative rounded-2xl p-4 flex flex-col justify-between overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.13)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
        animationDelay: `${delay}ms`
      }}>
      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${gradFrom}, ${gradTo})` }} />
      {/* Subtle bg glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${gradFrom}, transparent)` }} />

      <span className="text-[15px] font-medium tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>{title}</span>
      <div className="mt-2">
        <span className="text-[40px] font-black font-mono tabular-nums" style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {value}
        </span>
        {sub && <span className="text-[13px] ml-1" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ── Demand Row ──────────────────────────────── */
const STATUS: Record<string, { label: string; grad: string }> = {
  published:   { label: "招募中", grad: "linear-gradient(90deg,#a78bfa,#c084fc)" },
  matched:     { label: "已匹配", grad: "linear-gradient(90deg,#e879f9,#f472b6)" },
  in_progress: { label: "进行中", grad: "linear-gradient(90deg,#f472b6,#fb7185)" },
  completed:   { label: "已完成", grad: "linear-gradient(90deg,#34d399,#6ee7b7)" },
};

const DEMANDS = [
  { pub: "华为云", title: "HarmonyOS 4.0 生态应用开发", budget: "¥80,000", status: "in_progress" },
  { pub: "字节跳动", title: "TikTok 短视频推流算法优化", budget: "¥120,000", status: "matched" },
  { pub: "蚂蚁集团", title: "区块链合规场景落地实施", budget: "¥200,000", status: "published" },
  { pub: "宁德时代", title: "电池管理系统 OTA 升级方案", budget: "¥95,000", status: "completed" },
  { pub: "美团优选", title: "供应链数字化仓配系统", budget: "¥60,000", status: "in_progress" },
  { pub: "小鹏汽车", title: "XNGP 智能驾驶数据标注", budget: "¥150,000", status: "published" },
  { pub: "京东物流", title: "AGV 调度算法效率优化", budget: "¥75,000", status: "matched" },
];

function DemandFeed() {
  const doubled = [...DEMANDS, ...DEMANDS];
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.animation = `feedScroll ${DEMANDS.length * 2.8}s linear infinite`;
  }, []);

  return (
    <div className="flex-1 overflow-hidden relative min-h-0">
      <div className="absolute top-0 inset-x-0 h-8 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(60,15,100,0.7), transparent)" }} />
      <div className="absolute bottom-0 inset-x-0 h-8 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(60,15,100,0.7), transparent)" }} />
      <div ref={trackRef} style={{ animation: `feedScroll ${DEMANDS.length * 2.8}s linear infinite` }}>
        {doubled.map((d, i) => {
          const s = STATUS[d.status] ?? STATUS.published;
          return (
            <div key={i} className="flex items-center gap-2 py-2 px-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-[12px] font-bold shrink-0 w-14 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{d.pub}</span>
              <span className="flex-1 text-[12px] truncate min-w-0" style={{ color: "rgba(255,255,255,0.8)" }}>{d.title}</span>
              <span className="text-[11px] font-bold shrink-0" style={{ color: "#fbbf24" }}>{d.budget}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: s.grad, color: "white" }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Bar Row ─────────────────────────────────── */
function BarRow({ label, pct, count, grad }: { label: string; pct: number; count: number; grad: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] w-14 text-right shrink-0" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: grad }} />
      </div>
      <span className="text-[12px] w-16 font-mono shrink-0" style={{ color: "rgba(255,255,255,0.5)" }}>{count} ({pct}%)</span>
    </div>
  );
}

/* ── Pie (SVG) ───────────────────────────────── */
const PIE_DATA = [
  { label: "数字化转型", pct: 38, color: "#a78bfa" },
  { label: "AI 应用开发", pct: 27, color: "#f472b6" },
  { label: "数据工程", pct: 18, color: "#fbbf24" },
  { label: "系统集成", pct: 12, color: "#34d399" },
  { label: "其他", pct: 5,  color: "rgba(255,255,255,0.3)" },
];

function PieChart() {
  let cumulative = 0;
  const r = 38, cx = 50, cy = 50, circumference = 2 * Math.PI * r;
  const arcs = PIE_DATA.map(d => {
    const strokeDasharray = `${(d.pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -cumulative / 100 * circumference;
    cumulative += d.pct;
    return { ...d, strokeDasharray, strokeDashoffset };
  });

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="shrink-0" style={{ width: 100, height: 100 }}>
        <svg viewBox="0 0 100 100" width="100" height="100">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
          {arcs.map((a, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={a.color} strokeWidth={13}
              strokeDasharray={a.strokeDasharray}
              strokeDashoffset={a.strokeDashoffset}
              style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }} />
          ))}
        </svg>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {PIE_DATA.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{d.label}</span>
            </div>
            <span className="text-[13px] font-black font-mono shrink-0" style={{ color: d.color }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Trend (SVG Spark) ───────────────────────── */
const TREND_OPC = [110,130,148,162,175,188,204,216,228,244,257,270,285,300];
const TREND_PUB = [30,36,42,47,52,57,63,68,74,80,85,91,97,104];

function Sparkline({ values, color, width = 320, height = 60 }: { values: number[]; color: string; width?: number; height?: number }) {
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(" ");
  const fillPts = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function TrendChart() {
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-4 shrink-0">
        {[{ label: "OPC 累计", color: "#a78bfa" }, { label: "发单方累计", color: "#f472b6" }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: l.color }} />
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>{l.label}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 relative w-full">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0,1,2,3].map(i => (
            <div key={i} className="w-full" style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 320 80">
          <defs>
            <linearGradient id="gopc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gpub" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* OPC area */}
          {(() => {
            const min = Math.min(...TREND_OPC), max = Math.max(...TREND_OPC);
            const pts = TREND_OPC.map((v,i) => `${(i/(TREND_OPC.length-1))*320},${80-((v-min)/(max-min||1))*70}`).join(" ");
            return <>
              <polygon points={`0,80 ${pts} 320,80`} fill="url(#gopc)" />
              <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" />
            </>;
          })()}
          {/* Publisher area */}
          {(() => {
            const min = Math.min(...TREND_PUB), max = Math.max(...TREND_PUB);
            const pts = TREND_PUB.map((v,i) => `${(i/(TREND_PUB.length-1))*320},${80-((v-min)/(max-min||1))*60-10}`).join(" ");
            return <>
              <polygon points={`0,80 ${pts} 320,80`} fill="url(#gpub)" />
              <polyline points={pts} fill="none" stroke="#f472b6" strokeWidth="2" strokeLinejoin="round" />
            </>;
          })()}
        </svg>
      </div>
      <div className="flex justify-between shrink-0">
        {["5/16","5/18","5/20","5/22","5/24","5/26","5/28","5/29"].map(d => (
          <span key={d} className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{d}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Ticker ──────────────────────────────────── */
function Ticker({ items, grad, label }: { items: string[]; grad: string; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const text = items.join("　｜　");
  const doubled = text + "　｜　" + text;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const dur = el.scrollWidth / 2 / 60;
    el.style.animation = `tickerScroll ${dur}s linear infinite`;
  }, []);

  return (
    <div className="flex items-center h-9 overflow-hidden shrink-0"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
      <div className="shrink-0 text-[13px] font-bold px-5 py-2 whitespace-nowrap"
        style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {label}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute left-0 inset-y-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(40,10,80,0.8), transparent)" }} />
        <div className="absolute right-0 inset-y-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(40,10,80,0.8), transparent)" }} />
        <div ref={trackRef} className="inline-block whitespace-nowrap text-[14px] font-semibold py-2"
          style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {doubled}
        </div>
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────── */
export function NewStyle() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hms = time.toTimeString().slice(0, 8);

  return (
    <>
      <style>{KF}</style>
      <div className="relative w-screen h-screen overflow-hidden flex flex-col"
        style={{
          fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',system-ui,sans-serif",
          background: "linear-gradient(135deg, #1e0845 0%, #3b1080 25%, #5b1888 45%, #7d1060 70%, #4a0828 90%, #200510 100%)",
          color: "white",
        }}>

        {/* ── Ambient orbs ───────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute rounded-full"
            style={{ width: 600, height: 600, top: "-10%", left: "-5%", background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)", animation: "orb1 18s ease-in-out infinite" }} />
          <div className="absolute rounded-full"
            style={{ width: 500, height: 500, bottom: "-10%", right: "-5%", background: "radial-gradient(circle, rgba(236,72,153,0.16) 0%, transparent 65%)", animation: "orb2 22s ease-in-out infinite" }} />
          <div className="absolute rounded-full"
            style={{ width: 350, height: 350, top: "35%", right: "30%", background: "radial-gradient(circle, rgba(192,38,211,0.12) 0%, transparent 65%)", animation: "orb3 16s ease-in-out infinite" }} />
          {/* Subtle top-center highlight, like in the brand poster */}
          <div className="absolute"
            style={{ top: 0, left: "20%", right: "20%", height: 300, background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.2), transparent 70%)" }} />
        </div>

        {/* ── Header ─────────────────────────────── */}
        <div className="relative z-10 flex items-center justify-between px-8 py-3 h-20 shrink-0">
          {/* Top shimmer line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(192,132,252,0.6) 30%, rgba(244,114,182,0.6) 70%, transparent)" }} />

          {/* Left — clock */}
          <div className="w-[28%]">
            <div className="text-[40px] font-mono font-bold tracking-widest"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(192,132,252,0.7))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {hms}
            </div>
          </div>

          {/* Center — title */}
          <div className="flex-1 flex flex-col items-center">
            {/* Brand-poster style decorative lines */}
            <div className="flex items-center gap-3 mb-1">
              <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, rgba(192,132,252,0.5))" }} />
              <span className="text-[11px] tracking-[0.25em] font-light" style={{ color: "rgba(255,255,255,0.5)" }}>OPC撮合交易平台</span>
              <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, rgba(192,132,252,0.5))" }} />
            </div>
            <h1 className="text-[32px] font-black tracking-[0.06em]"
              style={{ background: "linear-gradient(135deg, #e9d5ff 0%, #f0abfc 40%, #f9a8d4 70%, #fda4af 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 40px rgba(168,85,247,0.3)" }}>
              接单吧 OPC 撮合交易平台 · 数据大屏
            </h1>
          </div>

          {/* Right — status */}
          <div className="w-[28%] flex justify-end">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ animation: "pulse 2s ease-in-out infinite", boxShadow: "0 0 10px #34d399" }} />
              <span className="text-[17px] text-emerald-300 font-medium tracking-wide">平台运行正常</span>
            </div>
          </div>
        </div>

        {/* ── Main content ───────────────────────── */}
        <div className="relative z-10 flex-1 min-h-0 flex gap-3 px-6 pb-2">

          {/* Left big column */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3 shrink-0" style={{ height: 130 }}>
              <KpiCard title="平台总用户" value="3,842" gradFrom="#a78bfa" gradTo="#c084fc" delay={0} />
              <KpiCard title="OPC 数量" value="2,109" gradFrom="#e879f9" gradTo="#f0abfc" delay={50} />
              <KpiCard title="发单企业" value="1,733" gradFrom="#f472b6" gradTo="#fb7185" delay={100} />
              <KpiCard title="已发布需求" value="847" gradFrom="#34d399" gradTo="#6ee7b7" delay={150} />
            </div>

            {/* Trend chart */}
            <Panel title="近14天增长趋势" className="flex-[5] min-h-0">
              <TrendChart />
            </Panel>

            {/* Bottom row */}
            <div className="flex-[4] min-h-0 flex gap-3">

              {/* Demand feed */}
              <Panel title="近期需求动态" className="flex-[5] min-h-0 overflow-hidden">
                <DemandFeed />
              </Panel>

              {/* Demand status bars */}
              <Panel title="需求状态" className="flex-[3.5] min-w-0">
                <div className="flex flex-col flex-1 min-h-0 justify-between">
                  <BarRow label="招募中" pct={35} count={296} grad="linear-gradient(90deg,#a78bfa,#c084fc)" />
                  <BarRow label="已匹配" pct={22} count={186} grad="linear-gradient(90deg,#e879f9,#f0abfc)" />
                  <BarRow label="进行中" pct={28} count={237} grad="linear-gradient(90deg,#f472b6,#fb7185)" />
                  <BarRow label="待验收" pct={8}  count={68}  grad="linear-gradient(90deg,#fbbf24,#fde68a)" />
                  <BarRow label="已完成" pct={7}  count={60}  grad="linear-gradient(90deg,#34d399,#6ee7b7)" />
                  <div className="flex justify-between pt-1 text-[12px]" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>需求总计</span>
                    <span className="font-bold" style={{ color: "#c084fc" }}>847 条</span>
                  </div>
                </div>
              </Panel>

              {/* Pie + QR */}
              <div className="flex-[3.5] flex flex-col gap-3 min-w-0">
                <Panel title="订单赛道占比" className="flex-1 min-h-0">
                  <PieChart />
                </Panel>
                {/* QR */}
                <div className="rounded-2xl flex items-center gap-3 px-3 py-2 shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)" }}>
                  <div className="p-1 rounded-lg bg-white shrink-0" style={{ boxShadow: "0 0 16px rgba(168,85,247,0.5)" }}>
                    <div className="w-14 h-14 rounded" style={{ background: "linear-gradient(135deg,#7c3aed,#be185d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="text-white font-black text-lg">二维码</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>扫码联系客服</div>
                    <div className="text-[14px] font-bold" style={{ background: "linear-gradient(135deg,#c084fc,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      www.opcorder.com
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right video column (placeholder) */}
          <div className="shrink-0 flex flex-col min-h-0" style={{ width: "calc((100vh - 80px - 72px - 24px) * 9/16 * 0.95)" }}>
            <div className="flex-1 min-h-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(16px)" }}>
              {/* Brand-style placeholder for the video area */}
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <span className="text-3xl">🎬</span>
                </div>
                <div>
                  <div className="text-[14px] font-semibold mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>宣传视频播放区</div>
                  <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>16:9 自动轮播</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Tickers ────────────────────────────── */}
        <div className="shrink-0 z-10">
          <Ticker
            label="👥 用户动态"
            grad="linear-gradient(90deg, #c084fc, #e879f9, #f472b6)"
            items={["OPC「张伟」完成华为云项目交付","新用户「李明科技」发布需求","「王芳」成功通过数字化转型认证","OPC「刘洋」获得5星好评","「陈晓」企业发布新需求：AI应用开发"]}
          />
          <Ticker
            label="📢 平台信息"
            grad="linear-gradient(90deg, #fbbf24, #fb923c)"
            items={["平台本月撮合成功率达 94.7%","数字化转型赛道OPC供给充足","新增企业认证功能已上线","资金安全由建设银行全程护航","www.opcorder.com 开放注册"]}
          />
        </div>

      </div>
    </>
  );
}
