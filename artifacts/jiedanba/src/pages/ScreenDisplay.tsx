import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   Config
═══════════════════════════════════════════════════════════════ */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const REFRESH_SEC = 60;
const CHART_INTERVAL = 9000;

const C = {
  cyan:   "#22d3ee",
  green:  "#4ade80",
  purple: "#a78bfa",
  amber:  "#fbbf24",
  pink:   "#f472b6",
  blue:   "#60a5fa",
  bg:     "#07101f",
};

const PIE_COLORS = [C.cyan, C.green, C.purple, C.amber, C.pink];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#0b1830",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#e2eaf8",
  fontSize: 12,
};

const CHART_TABS = ["近14天增长趋势", "需求状态分布", "用户角色分布"];

/* ═══════════════════════════════════════════════════════════════
   CSS keyframes (injected once)
═══════════════════════════════════════════════════════════════ */

const KEYFRAMES = `
  @keyframes orb1 {
    0%,100% { transform:translate(0,0) scale(1); }
    50% { transform:translate(50px,-40px) scale(1.08); }
  }
  @keyframes orb2 {
    0%,100% { transform:translate(0,0) scale(1); }
    50% { transform:translate(-35px,30px) scale(0.92); }
  }
  @keyframes orb3 {
    0%,100% { transform:translate(0,0) scale(1); }
    50% { transform:translate(20px,50px) scale(1.05); }
  }
  @keyframes kpi-enter {
    from { opacity:0; transform:translateY(32px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes chart-enter {
    from { opacity:0; transform:translateY(12px) scale(0.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes feed-scroll {
    from { transform:translateY(0); }
    to   { transform:translateY(-50%); }
  }
  @keyframes ticker-run {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes live-dot {
    0%,100% { opacity:1; box-shadow:0 0 6px currentColor; }
    50%     { opacity:0.3; box-shadow:none; }
  }
  @keyframes shimmer {
    0%   { background-position:200% center; }
    100% { background-position:-200% center; }
  }
  @keyframes header-glow {
    0%,100% { opacity:0.5; }
    50%     { opacity:1; }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════ */

function hexRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

async function fetchScreen(): Promise<ScreenData> {
  const r = await fetch(`${BASE}/api/screen`);
  if (!r.ok) throw new Error("数据加载失败");
  return r.json();
}

/* ═══════════════════════════════════════════════════════════════
   Hook: count-up
═══════════════════════════════════════════════════════════════ */

function useCountUp(target: number, ready: boolean, duration = 1800, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      if (!target) { setVal(0); return; }
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - t0) / duration, 1);
        setVal(Math.round(target * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(id);
  }, [target, ready]);
  return val;
}

/* ═══════════════════════════════════════════════════════════════
   Component: LiveClock
═══════════════════════════════════════════════════════════════ */

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#f0f8ff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {now.toLocaleTimeString("zh-CN", { hour12: false })}
      </div>
      <div style={{ fontSize: 11, color: "#2d4a6a", marginTop: 3, letterSpacing: "0.06em" }}>
        {now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Component: CountdownRing
═══════════════════════════════════════════════════════════════ */

function CountdownRing({ n, total }: { n: number; total: number }) {
  const r = 19;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - n / total);
  const color = n <= 10 ? C.amber : C.cyan;
  return (
    <div style={{ position: "relative", width: 50, height: 50, flexShrink: 0 }}>
      <svg width={50} height={50} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={25} cy={25} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2.5} />
        <circle cx={25} cy={25} r={r} fill="none" stroke={color}
          strokeWidth={2.5} strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{n}s</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Component: KpiCard
═══════════════════════════════════════════════════════════════ */

function KpiCard({ label, value, unit = "", accent, icon, delay, ready }: {
  label: string; value: number; unit?: string;
  accent: string; icon: string; delay: number; ready: boolean;
}) {
  const counted = useCountUp(value, ready, 1800, delay);
  const display = counted >= 10000
    ? `${(counted / 10000).toFixed(1)}万`
    : counted.toLocaleString("zh-CN");

  return (
    <div style={{
      flex: 1, minWidth: 0, position: "relative", overflow: "hidden",
      background: "rgba(255,255,255,0.038)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 18,
      padding: "16px 18px 18px",
      animation: `kpi-enter 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}>
      {/* top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent} 0%, transparent 80%)`,
      }} />
      {/* corner decoration */}
      <div style={{
        position: "absolute", right: -18, bottom: -18,
        width: 70, height: 70, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${hexRgb(accent)},0.12), transparent 70%)`,
      }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#3a587a", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `rgba(${hexRgb(accent)},0.14)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15,
        }}>
          {icon}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1 }}>
        <span style={{
          fontSize: 36, fontWeight: 900, color: accent,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 24px rgba(${hexRgb(accent)},0.45)`,
        }}>
          {display}
        </span>
        {unit && <span style={{ fontSize: 13, color: "#2d4a6a" }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Component: ActivityFeed  (vertical auto-scroll)
═══════════════════════════════════════════════════════════════ */

function ActivityFeed({ ticker1, ticker2 }: { ticker1: { text: string }[]; ticker2: { text: string }[] }) {
  const items = useMemo(() => {
    const all = [
      ...ticker1.map(t => ({ text: t.text, type: "activity" as const })),
      ...ticker2.map(t => ({ text: t.text, type: "achieve" as const })),
    ];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.length ? [...all, ...all] : [];
  }, [ticker1, ticker2]);

  const half = Math.max(1, items.length / 2);
  const duration = half * 3;

  const ICONS = { activity: "⚡", achieve: "🏆" };
  const COLORS = { activity: C.cyan, achieve: C.amber };

  if (!items.length) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#2d4a6a" }}>暂无动态</div>;
  }

  return (
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, insetInline: 0, height: 36, zIndex: 1, background: "linear-gradient(to bottom, rgba(8,14,28,0.95), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, insetInline: 0, height: 36, zIndex: 1, background: "linear-gradient(to top, rgba(8,14,28,0.95), transparent)", pointerEvents: "none" }} />
      <div style={{ animation: `feed-scroll ${duration}s linear infinite`, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => {
          const col = COLORS[item.type];
          return (
            <div key={i} style={{
              background: `rgba(${hexRgb(col)},0.04)`,
              border: `1px solid rgba(${hexRgb(col)},0.15)`,
              borderLeft: `3px solid ${col}`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex", alignItems: "flex-start", gap: 10,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{ICONS[item.type]}</span>
              <span style={{ fontSize: 13, color: "#b8d0e8", lineHeight: 1.55 }}>{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Component: Ticker  (horizontal infinite scroll)
═══════════════════════════════════════════════════════════════ */

function Ticker({ items, color, speed = 60 }: { items: { text: string }[]; color: string; speed?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const text = items.length ? items.map(i => `◆  ${i.text}`).join("      ") : "暂无数据";
  const doubled = `${text}      ${text}`;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const half = el.scrollWidth / 2;
    let pos = 0, raf: number;
    const step = () => {
      pos += speed / 60;
      if (pos >= half) pos -= half;
      el.style.transform = `translateX(-${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items, speed]);

  return (
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, insetBlock: 0, width: 48, zIndex: 1, background: "linear-gradient(to right, rgba(8,14,28,1), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, insetBlock: 0, width: 48, zIndex: 1, background: "linear-gradient(to left, rgba(8,14,28,1), transparent)", pointerEvents: "none" }} />
      <div ref={trackRef} style={{ display: "inline-block", whiteSpace: "nowrap", color, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
        {doubled}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Component: GlassPanel
═══════════════════════════════════════════════════════════════ */

function GlassPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main page
═══════════════════════════════════════════════════════════════ */

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

  useEffect(() => {
    setCountdown(REFRESH_SEC);
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_SEC : c - 1), 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  useEffect(() => {
    const t = setInterval(() => {
      setChartIdx(i => (i + 1) % 3);
      setChartKey(k => k + 1);
    }, CHART_INTERVAL);
    return () => clearInterval(t);
  }, []);

  const switchChart = (i: number) => { setChartIdx(i); setChartKey(k => k + 1); };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        width: "100vw", height: "100vh",
        background: `linear-gradient(140deg, #070e20 0%, #081526 45%, #06101d 100%)`,
        color: "#e8f4ff",
        fontFamily: "'PingFang SC','Microsoft YaHei',system-ui,sans-serif",
        display: "flex", flexDirection: "column",
        overflow: "hidden", position: "relative",
      }}>

        {/* ── Animated background orbs ── */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
          <div style={{
            position:"absolute", top:"-5%", left:"8%",
            width:560, height:560, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(34,211,238,0.09) 0%, transparent 68%)",
            animation:"orb1 14s ease-in-out infinite",
          }} />
          <div style={{
            position:"absolute", bottom:"5%", right:"6%",
            width:480, height:480, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(167,139,250,0.09) 0%, transparent 68%)",
            animation:"orb2 18s ease-in-out infinite",
          }} />
          <div style={{
            position:"absolute", top:"38%", right:"28%",
            width:360, height:360, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 68%)",
            animation:"orb3 11s ease-in-out infinite",
          }} />
          {/* Subtle grid */}
          <div style={{
            position:"absolute", inset:0,
            backgroundImage:`
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize:"72px 72px",
          }} />
        </div>

        {/* ════════════════════════════════════════════════
            HEADER
        ════════════════════════════════════════════════ */}
        <header style={{
          zIndex:1, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 36px",
          background:"rgba(255,255,255,0.025)",
          backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
          borderBottom:"1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Left: logo + title */}
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{
              width:46, height:46, borderRadius:14, flexShrink:0,
              background:`linear-gradient(135deg, ${C.cyan} 0%, ${C.blue} 100%)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, fontWeight:900, color:"#fff",
              boxShadow:`0 0 28px rgba(${hexRgb(C.cyan)},0.45)`,
            }}>接</div>
            <div>
              <div style={{
                fontSize:24, fontWeight:900, letterSpacing:"0.07em", lineHeight:1.1,
                background:`linear-gradient(90deg, #ffffff 0%, ${C.cyan} 55%, ${C.purple} 100%)`,
                backgroundSize:"200%",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>
                接单吧  OPC 撮合交易平台  数据大屏
              </div>
              <div style={{ fontSize:10.5, color:"#1e3a58", letterSpacing:"0.14em", marginTop:3 }}>
                JIEDANBA · OPC MATCHING PLATFORM · REAL-TIME SHOWCASE
              </div>
            </div>
          </div>
          {/* Right: clock + ring */}
          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
            <LiveClock />
            <CountdownRing n={countdown} total={REFRESH_SEC} />
          </div>
        </header>

        {/* ════════════════════════════════════════════════
            KPI CARDS
        ════════════════════════════════════════════════ */}
        <div style={{
          zIndex:1, flexShrink:0,
          display:"flex", gap:10, padding:"12px 36px",
        }}>
          <KpiCard label="平台总用户"   value={kpi?.totalUsers ?? 0}       accent={C.cyan}   icon="👥" delay={0}   ready={ready} />
          <KpiCard label="OPC 数量"     value={kpi?.opcCount ?? 0}          accent={C.blue}   icon="🎯" delay={70}  ready={ready} />
          <KpiCard label="发单企业"     value={kpi?.publisherCount ?? 0}    accent={C.purple} icon="🏢" delay={140} ready={ready} />
          <KpiCard label="已发布需求"   value={kpi?.publishedDemands ?? 0}  accent={C.amber}  icon="📋" delay={210} ready={ready} />
          <KpiCard label="进行中订单"   value={kpi?.inProgressOrders ?? 0}  accent={C.cyan}   icon="⚡" delay={280} ready={ready} />
          <KpiCard label="已完成订单"   value={kpi?.completedOrders ?? 0}   accent={C.green}  icon="✅" delay={350} ready={ready} />
          <KpiCard label="订单完成率"   value={kpi?.completionRate ?? 0}    unit="%" accent={C.pink} icon="📈" delay={420} ready={ready} />
          <KpiCard label="平台累计结算" value={kpi?.totalSettled ?? 0}      unit="元" accent={C.amber} icon="💰" delay={490} ready={ready} />
        </div>

        {/* ════════════════════════════════════════════════
            MAIN: Chart carousel  +  Activity feed
        ════════════════════════════════════════════════ */}
        <div style={{
          zIndex:1, flex:1, minHeight:0,
          display:"flex", gap:10, padding:"0 36px",
        }}>

          {/* ── Chart Carousel (left 62%) ── */}
          <GlassPanel style={{ flex:62, display:"flex", flexDirection:"column", overflow:"hidden", padding:"16px 22px 14px" }}>
            {/* Tab bar */}
            <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", gap:8 }}>
                {CHART_TABS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => switchChart(i)}
                    style={{
                      padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                      fontSize:12, fontWeight:700, letterSpacing:"0.04em",
                      transition:"all 0.3s ease",
                      background: chartIdx === i
                        ? `linear-gradient(90deg, rgba(${hexRgb(C.cyan)},0.2), rgba(${hexRgb(C.purple)},0.2))`
                        : "transparent",
                      color: chartIdx === i ? "#f0f8ff" : "#2d4a6a",
                      boxShadow: chartIdx === i ? `0 0 0 1px rgba(${hexRgb(C.cyan)},0.4)` : `0 0 0 1px rgba(255,255,255,0.05)`,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Dot indicators */}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {[0,1,2].map(i => (
                  <button key={i} onClick={() => switchChart(i)} style={{
                    width: chartIdx===i ? 22 : 7, height:7, borderRadius:4, border:"none", cursor:"pointer", padding:0,
                    background: chartIdx===i ? C.cyan : "rgba(255,255,255,0.15)",
                    transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                ))}
              </div>
            </div>

            {/* Chart area with enter animation */}
            <div key={chartKey} style={{ flex:1, minHeight:0, animation:"chart-enter 0.45s ease both" }}>
              {chartIdx === 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.timeSeries ?? []} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill:"#2a4060", fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"#2a4060", fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color:C.cyan }} />
                    <Legend wrapperStyle={{ fontSize:12, color:"#3a5a7a", paddingTop:6 }} />
                    <Line type="monotone" dataKey="newUsers"   name="新增用户" stroke={C.cyan}   strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:C.cyan   }} />
                    <Line type="monotone" dataKey="newDemands" name="新增需求" stroke={C.green}  strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:C.green  }} />
                    <Line type="monotone" dataKey="newOrders"  name="新增订单" stroke={C.purple} strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:C.purple }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {chartIdx === 1 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.demandStatusChart ?? []} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill:"#2a4060", fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"#2a4060", fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill:"rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="value" name="需求数" radius={[7,7,0,0]} isAnimationActive>
                      {(data?.demandStatusChart ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
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
                      {(data?.userRoleChart ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString(), "人数"]} />
                    <Legend
                      wrapperStyle={{ fontSize:13 }}
                      formatter={(val, entry: { payload?: { value: number } }) => (
                        <span style={{ color:"#7a9ab8" }}>{val} <span style={{ color:"#2d4a6a" }}>({entry.payload?.value ?? 0}人)</span></span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassPanel>

          {/* ── Activity Feed (right 38%) ── */}
          <GlassPanel style={{ flex:38, display:"flex", flexDirection:"column", overflow:"hidden", padding:"16px 20px" }}>
            <div style={{ flexShrink:0, marginBottom:14, display:"flex", alignItems:"center", gap:9 }}>
              <div style={{
                width:8, height:8, borderRadius:"50%", background:C.green,
                boxShadow:`0 0 8px ${C.green}`, color:C.green,
                animation:"live-dot 1.8s ease-in-out infinite",
              }} />
              <span style={{ fontSize:13, fontWeight:800, color:"#6a8aaa", letterSpacing:"0.07em", textTransform:"uppercase" }}>
                实时动态
              </span>
            </div>
            {data
              ? <ActivityFeed ticker1={data.ticker1} ticker2={data.ticker2} />
              : <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#1e3a58", fontSize:13 }}>数据加载中…</div>
            }
          </GlassPanel>
        </div>

        {/* ════════════════════════════════════════════════
            TICKERS
        ════════════════════════════════════════════════ */}
        <div style={{
          zIndex:1, flexShrink:0,
          borderTop:"1px solid rgba(255,255,255,0.04)",
          background:"rgba(0,0,0,0.2)",
        }}>
          <div style={{ display:"flex", alignItems:"center", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <div style={{ flexShrink:0, padding:"0 14px 0 36px", fontSize:11, fontWeight:900, color:C.cyan, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>
              🎉 动态
            </div>
            <Ticker items={data?.ticker1 ?? []} color={C.cyan} speed={55} />
          </div>
          <div style={{ display:"flex", alignItems:"center", padding:"6px 0" }}>
            <div style={{ flexShrink:0, padding:"0 14px 0 36px", fontSize:11, fontWeight:900, color:C.amber, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>
              🏆 喜报
            </div>
            <Ticker items={data?.ticker2 ?? []} color={C.amber} speed={48} />
          </div>
        </div>
      </div>
    </>
  );
}
