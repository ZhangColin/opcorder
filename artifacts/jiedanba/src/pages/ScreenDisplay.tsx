import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ════════════════════════════════════════════════
   Types
════════════════════════════════════════════════ */
type ScreenData = {
  kpi: {
    totalUsers: number; opcCount: number; publisherCount: number;
    publishedDemands: number; inProgressOrders: number; completedOrders: number;
    completionRate: number; totalSettled: number;
  };
  timeSeries: { date: string; label: string; newUsers: number; newDemands: number; newOrders: number }[];
  demandStatusChart: { status: string; label: string; value: number }[];
  userRoleChart: { role: string; label: string; value: number }[];
  ticker1: { text: string }[];
  ticker2: { text: string }[];
};

/* ════════════════════════════════════════════════
   Config
════════════════════════════════════════════════ */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const REFRESH_SEC = 60;
const CHART_INTERVAL = 9000;

const A = {
  indigo: "#6366f1", blue:   "#3b82f6", cyan:   "#06b6d4",
  green:  "#22c55e", amber:  "#f59e0b", pink:   "#ec4899",
  purple: "#8b5cf6", teal:   "#14b8a6",
};

const PIE_COLORS  = [A.cyan, A.green, A.purple, A.amber, A.pink];
const CHART_TABS  = ["近14天增长趋势", "需求状态分布", "用户角色分布"];

const DEMAND_STATUS_COLORS: Record<string, string> = {
  published: A.blue, matched: A.cyan, in_progress: A.purple,
  pending_acceptance: A.amber, completed: A.green,
};

/* ════════════════════════════════════════════════
   CSS keyframes
════════════════════════════════════════════════ */
const KF = `
  @keyframes blob1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-40px) scale(1.1)} }
  @keyframes blob2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,50px) scale(0.9)} }
  @keyframes blob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,30px) scale(1.05)} }
  @keyframes kpiIn { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
  @keyframes chartIn { from{opacity:0;transform:scale(0.97) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes feedUp { from{transform:translateY(0)} to{transform:translateY(-50%)} }
  @keyframes tickRun { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes liveDot { 0%,100%{opacity:1;box-shadow:0 0 6px currentColor} 50%{opacity:0.3;box-shadow:none} }
  @keyframes progressFill { from{width:0} to{width:var(--w)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes numberPop { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
`;

/* ════════════════════════════════════════════════
   Helpers
════════════════════════════════════════════════ */
function rgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}
async function fetchScreen(): Promise<ScreenData> {
  const r = await fetch(`${BASE}/api/screen`);
  if (!r.ok) throw new Error("数据加载失败");
  return r.json();
}

/* ════════════════════════════════════════════════
   Hook: count-up
════════════════════════════════════════════════ */
function useCountUp(target: number, ready: boolean, duration = 1600, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - t0) / duration, 1);
        setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(id);
  }, [target, ready]);
  return val;
}

/* ════════════════════════════════════════════════
   Component: LiveClock
════════════════════════════════════════════════ */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#18181b", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {now.toLocaleTimeString("zh-CN", { hour12: false })}
      </div>
      <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 3, letterSpacing: "0.06em" }}>
        {now.toLocaleDateString("zh-CN", { year:"numeric", month:"long", day:"numeric", weekday:"short" })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Component: CountdownRing
════════════════════════════════════════════════ */
function CountdownRing({ n, total }: { n: number; total: number }) {
  const r = 18, circ = 2 * Math.PI * r;
  const color = n <= 10 ? A.amber : A.indigo;
  return (
    <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
      <svg width={46} height={46} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={23} cy={23} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={2.5} />
        <circle cx={23} cy={23} r={r} fill="none" stroke={color}
          strokeWidth={2.5} strokeDasharray={circ} strokeDashoffset={circ * (1 - n/total)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize: 9, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>{n}s</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Component: KpiCard
════════════════════════════════════════════════ */
function KpiCard({ label, value, unit="", accent, icon, delay, ready }: {
  label: string; value: number; unit?: string;
  accent: string; icon: string; delay: number; ready: boolean;
}) {
  const counted = useCountUp(value, ready, 1600, delay);
  const display = counted >= 10000
    ? `${(counted / 10000).toFixed(1)}万`
    : counted.toLocaleString("zh-CN");
  return (
    <div style={{
      flex: 1, minWidth: 0, position: "relative", overflow: "hidden",
      background: "rgba(255,255,255,0.82)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `1px solid rgba(${rgb(accent)},0.18)`,
      borderRadius: 18,
      padding: "14px 16px 16px",
      boxShadow: `0 4px 24px rgba(${rgb(accent)},0.12), 0 1px 4px rgba(0,0,0,0.06)`,
      animation: `kpiIn 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
        background:`linear-gradient(90deg, ${accent}, transparent)` }} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#71717a", letterSpacing:"0.07em", textTransform:"uppercase" }}>
          {label}
        </span>
        <div style={{
          width:28, height:28, borderRadius:8,
          background:`rgba(${rgb(accent)},0.12)`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
        }}>{icon}</div>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4, lineHeight:1 }}>
        <span style={{
          fontSize: 34, fontWeight: 900, color: accent,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 2px 12px rgba(${rgb(accent)},0.25)`,
        }}>{display}</span>
        {unit && <span style={{ fontSize: 12, color: "#a1a1aa" }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Component: TodayStat — single "today" metric card
════════════════════════════════════════════════ */
function TodayStat({ label, value, accent, icon, delay }: {
  label: string; value: number; accent: string; icon: string; delay: number;
}) {
  return (
    <div style={{
      flex: 1,
      background: `linear-gradient(135deg, rgba(${rgb(accent)},0.12) 0%, rgba(${rgb(accent)},0.04) 100%)`,
      border: `1px solid rgba(${rgb(accent)},0.22)`,
      borderRadius: 14,
      padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 4,
      animation: `kpiIn 0.6s ease ${delay}ms both`,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#71717a", letterSpacing:"0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value > 0 ? `+${value}` : value}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Component: DemandProgress — horizontal progress bar row
════════════════════════════════════════════════ */
function DemandProgress({ label, value, total, color, delay }: {
  label: string; value: number; total: number; color: string; delay: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delay + 200);
    return () => clearTimeout(id);
  }, [delay]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, animation:`fadeIn 0.5s ease ${delay}ms both` }}>
      <div style={{ width: 52, fontSize: 12, fontWeight: 700, color: "#52525b", flexShrink: 0, textAlign: "right" }}>
        {label}
      </div>
      <div style={{
        flex: 1, height: 8, borderRadius: 6,
        background: `rgba(${rgb(color)},0.12)`,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 6,
          background: `linear-gradient(90deg, ${color}, rgba(${rgb(color)},0.7))`,
          width: visible ? `${pct}%` : "0%",
          transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 8px rgba(${rgb(color)},0.4)`,
        }} />
      </div>
      <div style={{ width: 56, fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
        {value} <span style={{ color: "#a1a1aa", fontWeight: 400 }}>({pct}%)</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Component: Ticker
════════════════════════════════════════════════ */
function Ticker({ items, color, speed = 55 }: { items: { text: string }[]; color: string; speed?: number }) {
  const text = items.length ? items.map(i => `◆  ${i.text}`).join("      ") : "暂无数据";
  const doubled = `${text}      ${text}`;
  const duration = Math.max(30, text.length * 0.15);
  return (
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
      <div style={{ position:"absolute", left:0, insetBlock:0, width:50, zIndex:1, background:"linear-gradient(to right, var(--ticker-bg), transparent)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:0, insetBlock:0, width:50, zIndex:1, background:"linear-gradient(to left, var(--ticker-bg), transparent)", pointerEvents:"none" }} />
      <div style={{
        display:"inline-block", whiteSpace:"nowrap",
        animation:`tickRun ${duration}s linear infinite`,
        color, fontSize:12.5, fontWeight:700, letterSpacing:"0.03em",
      }}>{doubled}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Component: SectionHeader
════════════════════════════════════════════════ */
function SectionHeader({ title, dot, color = A.indigo }: { title: string; dot?: boolean; color?: string }) {
  return (
    <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      {dot && (
        <div style={{
          width:8, height:8, borderRadius:"50%", background:color, color,
          boxShadow:`0 0 8px ${color}`, animation:"liveDot 1.8s ease-in-out infinite",
        }} />
      )}
      <span style={{ fontSize:12, fontWeight:800, color:"#52525b", letterSpacing:"0.07em", textTransform:"uppercase" }}>
        {title}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Main Page
════════════════════════════════════════════════ */
export default function ScreenDisplay() {
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const [chartIdx, setChartIdx] = useState(0);
  const [chartKey, setChartKey] = useState(0);

  const { data, dataUpdatedAt } = useQuery<ScreenData>({
    queryKey: ["screen"],
    queryFn: fetchScreen,
    refetchInterval: REFRESH_SEC * 1000,
    staleTime: 0,
  });

  const ready = !!data;
  const kpi = data?.kpi;

  // Countdown
  useEffect(() => {
    setCountdown(REFRESH_SEC);
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_SEC : c - 1), 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  // Chart carousel
  useEffect(() => {
    const t = setInterval(() => {
      setChartIdx(i => (i + 1) % 3);
      setChartKey(k => k + 1);
    }, CHART_INTERVAL);
    return () => clearInterval(t);
  }, []);

  const switchChart = (i: number) => { setChartIdx(i); setChartKey(k => k + 1); };

  // Today's stats from last timeSeries entry
  const today = useMemo(() => {
    if (!data?.timeSeries?.length) return { newUsers: 0, newDemands: 0, newOrders: 0 };
    return data.timeSeries[data.timeSeries.length - 1];
  }, [data]);

  // Total demand count for progress bars
  const totalDemands = useMemo(() => {
    return (data?.demandStatusChart ?? []).reduce((s, d) => s + d.value, 0);
  }, [data]);

  const cardStyle = {
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(20px)" as const,
    WebkitBackdropFilter: "blur(20px)" as const,
    border: "1px solid rgba(255,255,255,0.9)",
    borderRadius: 20,
    boxShadow: "0 8px 32px rgba(99,102,241,0.08), 0 2px 8px rgba(0,0,0,0.06)",
  };

  const chartTip = {
    backgroundColor: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 10,
    color: "#18181b",
    fontSize: 12,
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
  };

  return (
    <>
      <style>{KF}</style>
      <div style={{
        width:"100vw", height:"100vh",
        background:"linear-gradient(155deg, #eef2ff 0%, #f5f3ff 30%, #fdf4ff 55%, #f0fdf4 80%, #fffbeb 100%)",
        color:"#18181b",
        fontFamily:"'PingFang SC','Microsoft YaHei',system-ui,sans-serif",
        display:"flex", flexDirection:"column",
        overflow:"hidden", position:"relative",
      }}>

        {/* ── Decorative blobs ── */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
          <div style={{
            position:"absolute", top:"-8%", left:"3%", width:500, height:500, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)",
            animation:"blob1 15s ease-in-out infinite",
          }} />
          <div style={{
            position:"absolute", bottom:"2%", right:"5%", width:420, height:420, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 65%)",
            animation:"blob2 19s ease-in-out infinite",
          }} />
          <div style={{
            position:"absolute", top:"35%", right:"22%", width:320, height:320, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 65%)",
            animation:"blob3 12s ease-in-out infinite",
          }} />
          {/* Light grid */}
          <div style={{
            position:"absolute", inset:0,
            backgroundImage:`linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)`,
            backgroundSize:"70px 70px",
          }} />
        </div>

        {/* ════════════════════════════════════════════════
            HEADER
        ════════════════════════════════════════════════ */}
        <header style={{
          zIndex:1, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 36px",
          background:"rgba(255,255,255,0.65)",
          backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
          borderBottom:"1px solid rgba(255,255,255,0.8)",
          boxShadow:"0 1px 0 rgba(99,102,241,0.08)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{
              width:46, height:46, borderRadius:14, flexShrink:0,
              background:`linear-gradient(135deg, ${A.indigo} 0%, ${A.cyan} 100%)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, fontWeight:900, color:"#fff",
              boxShadow:`0 4px 20px rgba(${rgb(A.indigo)},0.4)`,
            }}>接</div>
            <div>
              <div style={{
                fontSize:22, fontWeight:900, letterSpacing:"0.06em", lineHeight:1.1,
                background:`linear-gradient(90deg, #1e1b4b 0%, ${A.indigo} 40%, ${A.cyan} 75%, ${A.green} 100%)`,
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>
                接单吧  OPC 撮合交易平台  数据大屏
              </div>
              <div style={{ fontSize:10, color:"#c4c4cf", letterSpacing:"0.14em", marginTop:3 }}>
                JIEDANBA · OPC MATCHING PLATFORM · REAL-TIME SHOWCASE
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            {/* Status badge */}
            <div style={{
              display:"flex", alignItems:"center", gap:7,
              background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.25)",
              borderRadius:20, padding:"5px 12px",
            }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:A.green, color:A.green, animation:"liveDot 2s ease-in-out infinite" }} />
              <span style={{ fontSize:11, fontWeight:700, color:"#16a34a", letterSpacing:"0.04em" }}>平台运行正常</span>
            </div>
            <LiveClock />
            <CountdownRing n={countdown} total={REFRESH_SEC} />
          </div>
        </header>

        {/* ════════════════════════════════════════════════
            KPI CARDS
        ════════════════════════════════════════════════ */}
        <div style={{ zIndex:1, flexShrink:0, display:"flex", gap:10, padding:"12px 36px" }}>
          <KpiCard label="平台总用户"   value={kpi?.totalUsers ?? 0}       accent={A.indigo} icon="👥" delay={0}   ready={ready} />
          <KpiCard label="OPC 数量"     value={kpi?.opcCount ?? 0}          accent={A.blue}   icon="🎯" delay={60}  ready={ready} />
          <KpiCard label="发单企业"     value={kpi?.publisherCount ?? 0}    accent={A.purple} icon="🏢" delay={120} ready={ready} />
          <KpiCard label="已发布需求"   value={kpi?.publishedDemands ?? 0}  accent={A.cyan}   icon="📋" delay={180} ready={ready} />
          <KpiCard label="进行中订单"   value={kpi?.inProgressOrders ?? 0}  accent={A.teal}   icon="⚡" delay={240} ready={ready} />
          <KpiCard label="已完成订单"   value={kpi?.completedOrders ?? 0}   accent={A.green}  icon="✅" delay={300} ready={ready} />
          <KpiCard label="订单完成率"   value={kpi?.completionRate ?? 0} unit="%" accent={A.pink}  icon="📈" delay={360} ready={ready} />
          <KpiCard label="平台累计结算" value={kpi?.totalSettled ?? 0}  unit="元" accent={A.amber} icon="💰" delay={420} ready={ready} />
        </div>

        {/* ════════════════════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════════════════════ */}
        <div style={{ zIndex:1, flex:1, minHeight:0, display:"flex", gap:10, padding:"0 36px" }}>

          {/* ── Left: Chart carousel ── */}
          <div style={{ flex:60, ...cardStyle, display:"flex", flexDirection:"column", overflow:"hidden", padding:"16px 22px 14px" }}>
            {/* Tab bar */}
            <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", gap:6 }}>
                {CHART_TABS.map((label, i) => (
                  <button key={i} onClick={() => switchChart(i)} style={{
                    padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                    fontSize:12, fontWeight:700, letterSpacing:"0.03em",
                    transition:"all 0.3s ease",
                    background: chartIdx === i
                      ? `linear-gradient(90deg, rgba(${rgb(A.indigo)},0.15), rgba(${rgb(A.cyan)},0.15))`
                      : "transparent",
                    color: chartIdx === i ? A.indigo : "#a1a1aa",
                    boxShadow: chartIdx === i ? `0 0 0 1.5px rgba(${rgb(A.indigo)},0.35)` : `0 0 0 1px rgba(0,0,0,0.07)`,
                  }}>{label}</button>
                ))}
              </div>
              {/* Dot indicators */}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {[0,1,2].map(i => (
                  <button key={i} onClick={() => switchChart(i)} style={{
                    width: chartIdx===i ? 22 : 7, height:7, borderRadius:4, border:"none", cursor:"pointer", padding:0,
                    background: chartIdx===i ? A.indigo : "rgba(0,0,0,0.12)",
                    transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                ))}
              </div>
            </div>

            {/* Chart area */}
            <div key={chartKey} style={{ flex:1, minHeight:0, animation:"chartIn 0.45s ease both" }}>
              {chartIdx === 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.timeSeries ?? []} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="label" tick={{ fill:"#a1a1aa", fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"#a1a1aa", fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTip} />
                    <Legend wrapperStyle={{ fontSize:12, color:"#71717a", paddingTop:6 }} />
                    <Line type="monotone" dataKey="newUsers"   name="新增用户" stroke={A.indigo} strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
                    <Line type="monotone" dataKey="newDemands" name="新增需求" stroke={A.cyan}   strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
                    <Line type="monotone" dataKey="newOrders"  name="新增订单" stroke={A.green}  strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {chartIdx === 1 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.demandStatusChart ?? []} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="label" tick={{ fill:"#a1a1aa", fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"#a1a1aa", fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTip} cursor={{ fill:"rgba(99,102,241,0.04)" }} />
                    <Bar dataKey="value" name="需求数" radius={[7,7,0,0]} isAnimationActive>
                      {(data?.demandStatusChart ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartIdx === 2 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" nameKey="label"
                      data={data?.userRoleChart ?? []}
                      cx="50%" cy="44%" innerRadius="36%" outerRadius="62%"
                      paddingAngle={6} isAnimationActive>
                      {(data?.userRoleChart ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTip} formatter={(v: number) => [v.toLocaleString(), "人数"]} />
                    <Legend wrapperStyle={{ fontSize:13 }}
                      formatter={(val, e: { payload?: { value: number } }) => (
                        <span style={{ color:"#52525b" }}>{val} <span style={{ color:"#a1a1aa" }}>({e.payload?.value ?? 0}人)</span></span>
                      )} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Right: Today stats + Demand progress ── */}
          <div style={{ flex:40, display:"flex", flexDirection:"column", gap:10, minHeight:0 }}>

            {/* Today's highlights */}
            <div style={{ ...cardStyle, flexShrink:0, padding:"14px 18px" }}>
              <SectionHeader title="今日实时新增" dot color={A.green} />
              <div style={{ display:"flex", gap:10 }}>
                <TodayStat label="新用户" value={today.newUsers}   accent={A.indigo} icon="👤" delay={100} />
                <TodayStat label="新需求" value={today.newDemands} accent={A.cyan}   icon="📋" delay={180} />
                <TodayStat label="新订单" value={today.newOrders}  accent={A.green}  icon="🤝" delay={260} />
              </div>
            </div>

            {/* Demand status progress bars */}
            <div style={{ ...cardStyle, flex:1, minHeight:0, padding:"14px 18px", display:"flex", flexDirection:"column" }}>
              <SectionHeader title="需求全周期进度看板" />
              <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-around" }}>
                {(data?.demandStatusChart ?? []).map((d, i) => (
                  <DemandProgress
                    key={d.status}
                    label={d.label}
                    value={d.value}
                    total={totalDemands}
                    color={DEMAND_STATUS_COLORS[d.status] ?? PIE_COLORS[i % PIE_COLORS.length]}
                    delay={i * 80}
                  />
                ))}
                {!data && [0,1,2,3,4].map(i => (
                  <div key={i} style={{ height:8, background:"rgba(0,0,0,0.05)", borderRadius:4 }} />
                ))}
              </div>
              {/* Total */}
              {data && (
                <div style={{
                  marginTop:10, paddingTop:10, borderTop:"1px solid rgba(0,0,0,0.06)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  fontSize:12, color:"#71717a",
                }}>
                  <span>需求总计</span>
                  <span style={{ fontWeight:800, color:A.indigo, fontSize:16 }}>
                    {totalDemands} <span style={{ fontSize:12, fontWeight:400, color:"#a1a1aa" }}>条</span>
                  </span>
                </div>
              )}
            </div>

            {/* Completion rate ring */}
            <div style={{ ...cardStyle, flexShrink:0, padding:"14px 18px", display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ position:"relative", width:70, height:70, flexShrink:0 }}>
                <svg width={70} height={70} style={{ transform:"rotate(-90deg)" }}>
                  <circle cx={35} cy={35} r={28} fill="none" stroke="rgba(34,197,94,0.1)" strokeWidth={6} />
                  <circle cx={35} cy={35} r={28} fill="none" stroke={A.green}
                    strokeWidth={6} strokeDasharray={2*Math.PI*28}
                    strokeDashoffset={2*Math.PI*28*(1-(kpi?.completionRate??0)/100)}
                    strokeLinecap="round" style={{ transition:"stroke-dashoffset 1.2s ease" }} />
                </svg>
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:14, fontWeight:900, color:A.green }}>{kpi?.completionRate ?? 0}%</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:"#18181b" }}>订单完成率</div>
                <div style={{ fontSize:11, color:"#71717a", marginTop:3 }}>
                  已完成 <span style={{ color:A.green, fontWeight:700 }}>{kpi?.completedOrders ?? 0}</span> 单 ·
                  进行中 <span style={{ color:A.teal, fontWeight:700 }}>{kpi?.inProgressOrders ?? 0}</span> 单
                </div>
              </div>
              <div style={{ flex:1, borderLeft:"1px solid rgba(0,0,0,0.06)", paddingLeft:14, marginLeft:4 }}>
                <div style={{ fontSize:11, color:"#71717a" }}>累计结算金额</div>
                <div style={{ fontSize:20, fontWeight:900, color:A.amber, marginTop:2 }}>
                  {kpi ? (kpi.totalSettled >= 10000
                    ? `${(kpi.totalSettled / 10000).toFixed(1)}万`
                    : kpi.totalSettled.toLocaleString("zh-CN")) : "—"} <span style={{ fontSize:12, fontWeight:400, color:"#a1a1aa" }}>元</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            TICKERS
        ════════════════════════════════════════════════ */}
        <div style={{ zIndex:1, flexShrink:0 }}>
          {/* Ticker 1 */}
          <div style={{
            display:"flex", alignItems:"center", padding:"7px 0",
            background:`linear-gradient(90deg, rgba(${rgb(A.indigo)},0.08) 0%, rgba(${rgb(A.cyan)},0.04) 100%)`,
            borderTop:"1px solid rgba(99,102,241,0.12)",
            "--ticker-bg":"rgba(238,242,255,0.95)",
          } as React.CSSProperties}>
            <div style={{ flexShrink:0, padding:"0 14px 0 36px", fontSize:11, fontWeight:900, color:A.indigo, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>
              🎉 平台动态
            </div>
            <Ticker items={data?.ticker1 ?? []} color={A.indigo} />
          </div>
          {/* Ticker 2 */}
          <div style={{
            display:"flex", alignItems:"center", padding:"7px 0",
            background:`linear-gradient(90deg, rgba(${rgb(A.amber)},0.07) 0%, rgba(${rgb(A.pink)},0.04) 100%)`,
            borderTop:"1px solid rgba(245,158,11,0.1)",
            "--ticker-bg":"rgba(255,253,245,0.95)",
          } as React.CSSProperties}>
            <div style={{ flexShrink:0, padding:"0 14px 0 36px", fontSize:11, fontWeight:900, color:A.amber, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>
              🏆 喜报连连
            </div>
            <Ticker items={data?.ticker2 ?? []} color={A.amber} />
          </div>
        </div>
      </div>
    </>
  );
}
