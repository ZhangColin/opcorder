import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getValidAccessToken, clearSession } from "@/lib/auth";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ════════════════════════════════════════
   Types
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   Color palette — LED panel optimised
   深海军蓝底 + 高饱和发光色
════════════════════════════════════════ */
const BG   = "#09131f";          // deep navy (not pure black — LEDs look off at #000)
const SURF = "rgba(10,24,44,0.82)"; // panel surface
const LINE = "rgba(0,180,220,0.12)"; // grid & divider

const C = {
  cyan:   "#00c8e0",
  green:  "#00d87a",
  amber:  "#ffb020",
  purple: "#9d7cf0",
  pink:   "#f06090",
  blue:   "#3f90ff",
  teal:   "#00b8a0",
  text:   "#b8d8f0",   // cool off-white — easy on eyes
  dim:    "#2a4a64",   // muted label text
};

const PIE_COLORS  = [C.cyan, C.green, C.purple, C.amber, C.pink];
const CHART_TABS  = ["近14天增长趋势", "需求状态分布", "用户角色分布"];
const REFRESH_SEC = 60;
const CHART_SWAP  = 9000;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ════════════════════════════════════════
   Demand status colours
════════════════════════════════════════ */
const D_COLORS: Record<string, string> = {
  published: C.blue, matched: C.cyan,
  in_progress: C.purple, pending_acceptance: C.amber, completed: C.green,
};

/* ════════════════════════════════════════
   CSS keyframes
════════════════════════════════════════ */
const KF = `
  @keyframes orb1  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(55px,-40px)} }
  @keyframes orb2  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(-40px,45px)} }
  @keyframes orb3  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(25px,35px)} }
  @keyframes kpiIn { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes chartIn { from{opacity:0;transform:scale(0.97) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes feedScroll { from{transform:translateY(0)} to{transform:translateY(-50%)} }
  @keyframes tickRun    { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes liveDot { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes progIn  { from{width:0} to{width:var(--pct)} }
  @keyframes scanline {
    0%   { background-position: 0 0; }
    100% { background-position: 0 4px; }
  }
`;

/* ════════════════════════════════════════
   Helpers
════════════════════════════════════════ */
function rgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}
async function fetchScreen(): Promise<ScreenData> {
  const token = await getValidAccessToken(BASE);
  if (!token) {
    clearSession();
    window.location.href = `${BASE}/login`;
    throw new Error("未登录");
  }
  const r = await fetch(`${BASE}/api/screen`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401 || r.status === 403) {
    clearSession();
    window.location.href = `${BASE}/login`;
    throw new Error("登录已过期");
  }
  if (!r.ok) throw new Error("数据加载失败");
  return r.json();
}

/* ════════════════════════════════════════
   Hook: count-up
════════════════════════════════════════ */
function useCountUp(target: number, ready: boolean, ms = 1600, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - t0) / ms, 1);
        setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, ready]);
  return v;
}

/* ════════════════════════════════════════
   LiveClock
════════════════════════════════════════ */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign:"right" }}>
      <div style={{ fontSize:26, fontWeight:900, color:C.text, fontVariantNumeric:"tabular-nums", lineHeight:1,
        textShadow:`0 0 18px rgba(${rgb(C.cyan)},0.4)` }}>
        {now.toLocaleTimeString("zh-CN", { hour12:false })}
      </div>
      <div style={{ fontSize:11, color:C.dim, marginTop:3, letterSpacing:"0.08em" }}>
        {now.toLocaleDateString("zh-CN", { year:"numeric", month:"long", day:"numeric", weekday:"short" })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   CountdownRing
════════════════════════════════════════ */
function CountdownRing({ n, total }: { n: number; total: number }) {
  const r = 18, c2 = 2 * Math.PI * r;
  const color = n <= 10 ? C.amber : C.cyan;
  return (
    <div style={{ position:"relative", width:46, height:46, flexShrink:0 }}>
      <svg width={46} height={46} style={{ position:"absolute", transform:"rotate(-90deg)" }}>
        <circle cx={23} cy={23} r={r} fill="none" stroke={`rgba(${rgb(color)},0.15)`} strokeWidth={2.5} />
        <circle cx={23} cy={23} r={r} fill="none" stroke={color}
          strokeWidth={2.5} strokeDasharray={c2} strokeDashoffset={c2*(1-n/total)}
          strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear, stroke 0.3s",
          filter:`drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:9, fontWeight:900, color, fontVariantNumeric:"tabular-nums" }}>{n}s</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   KpiCard
════════════════════════════════════════ */
function KpiCard({ label, value, unit="", accent, icon, delay, ready }: {
  label: string; value: number; unit?: string;
  accent: string; icon: string; delay: number; ready: boolean;
}) {
  const n = useCountUp(value, ready, 1600, delay);
  const display = n >= 10000 ? `${(n/10000).toFixed(1)}万` : n.toLocaleString("zh-CN");
  return (
    <div style={{
      flex:1, minWidth:0, position:"relative", overflow:"hidden",
      background: SURF,
      border:`1px solid rgba(${rgb(accent)},0.28)`,
      borderRadius:14,
      padding:"13px 16px 15px",
      boxShadow:`0 0 20px rgba(${rgb(accent)},0.08), inset 0 1px 0 rgba(255,255,255,0.03)`,
      animation:`kpiIn 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}>
      {/* top glow bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, ${accent} 0%, transparent 70%)`,
        boxShadow:`0 0 8px ${accent}`,
      }} />
      {/* bottom right decorative circle */}
      <div style={{ position:"absolute", right:-16, bottom:-16, width:60, height:60, borderRadius:"50%",
        background:`radial-gradient(circle, rgba(${rgb(accent)},0.1) 0%, transparent 70%)` }} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontSize:10, fontWeight:700, color:C.dim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          {label}
        </span>
        <div style={{ width:26, height:26, borderRadius:7,
          background:`rgba(${rgb(accent)},0.14)`, border:`1px solid rgba(${rgb(accent)},0.25)`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>
          {icon}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4, lineHeight:1 }}>
        <span style={{ fontSize:34, fontWeight:900, color:accent,
          fontVariantNumeric:"tabular-nums",
          textShadow:`0 0 16px rgba(${rgb(accent)},0.5), 0 0 40px rgba(${rgb(accent)},0.2)`,
        }}>{display}</span>
        {unit && <span style={{ fontSize:12, color:C.dim }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   TodayStat — compact "today" card
════════════════════════════════════════ */
function TodayStat({ label, value, accent, icon }: {
  label: string; value: number; accent: string; icon: string;
}) {
  return (
    <div style={{
      flex:1, padding:"9px 12px",
      background:`rgba(${rgb(accent)},0.07)`,
      border:`1px solid rgba(${rgb(accent)},0.22)`,
      borderRadius:10,
      display:"flex", flexDirection:"column", gap:4,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ fontSize:14 }}>{icon}</span>
        <span style={{ fontSize:10, fontWeight:700, color:C.dim, letterSpacing:"0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize:24, fontWeight:900, color:accent, lineHeight:1,
        fontVariantNumeric:"tabular-nums",
        textShadow:`0 0 12px rgba(${rgb(accent)},0.5)` }}>
        {value > 0 ? `+${value}` : value}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   DemandProgress
════════════════════════════════════════ */
function DemandProgress({ label, value, total, color, delay }: {
  label: string; value: number; total: number; color: string; delay: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay + 400); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, animation:`fadeIn 0.5s ease ${delay}ms both` }}>
      <div style={{ width:44, fontSize:11, fontWeight:700, color:C.dim, flexShrink:0, textAlign:"right" }}>{label}</div>
      <div style={{ flex:1, height:6, borderRadius:4, background:`rgba(${rgb(color)},0.1)`, overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:4,
          background:`linear-gradient(90deg, ${color}, rgba(${rgb(color)},0.65))`,
          width: show ? `${pct}%` : "0%",
          transition:"width 1s cubic-bezier(0.4,0,0.2,1)",
          boxShadow:`0 0 8px rgba(${rgb(color)},0.6)`,
        }} />
      </div>
      <div style={{ width:58, fontSize:11, fontWeight:700, color, flexShrink:0 }}>
        {value} <span style={{ color:C.dim, fontWeight:400 }}>({pct}%)</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ActivityFeed — vertical auto-scroll
════════════════════════════════════════ */
function ActivityFeed({ ticker1, ticker2 }: { ticker1: { text: string }[]; ticker2: { text: string }[] }) {
  const items = useMemo(() => {
    const all = [
      ...ticker1.map(t => ({ text: t.text, type: "activity" as const })),
      ...ticker2.map(t => ({ text: t.text, type: "achieve"  as const })),
    ];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.length ? [...all, ...all] : [];
  }, [ticker1, ticker2]);

  const half = Math.max(1, items.length / 2);
  const duration = half * 2.8;

  const ICON  = { activity:"⚡", achieve:"🏆" };
  const COLOR = { activity: C.cyan, achieve: C.amber };

  if (!items.length) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.dim, fontSize:12 }}>
      暂无动态
    </div>
  );
  return (
    <div style={{ flex:1, overflow:"hidden", position:"relative", minHeight:0 }}>
      <div style={{ position:"absolute", top:0, insetInline:0, height:28, zIndex:1,
        background:`linear-gradient(to bottom, ${BG}, transparent)`, pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:0, insetInline:0, height:28, zIndex:1,
        background:`linear-gradient(to top, ${BG}, transparent)`, pointerEvents:"none" }} />
      <div style={{ animation:`feedScroll ${duration}s linear infinite`, display:"flex", flexDirection:"column", gap:6 }}>
        {items.map((item, i) => {
          const col = COLOR[item.type];
          return (
            <div key={i} style={{
              flexShrink:0,
              background:`rgba(${rgb(col)},0.05)`,
              border:`1px solid rgba(${rgb(col)},0.18)`,
              borderLeft:`3px solid ${col}`,
              borderRadius:8,
              padding:"8px 12px",
              display:"flex", alignItems:"flex-start", gap:8,
              boxShadow:`0 0 10px rgba(${rgb(col)},0.06)`,
            }}>
              <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>{ICON[item.type]}</span>
              <span style={{ fontSize:12, color:C.text, lineHeight:1.55 }}>{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Ticker — horizontal scroll
════════════════════════════════════════ */
function Ticker({ items, color, bgColor }: { items: { text: string }[]; color: string; bgColor: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const text = items.length ? items.map(i => `◆  ${i.text}`).join("      ") : "暂无数据";
  const doubled = `${text}      ${text}`;
  const speed = 55; // px/s

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
  }, [items]);

  return (
    <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", left:0, insetBlock:0, width:44, zIndex:1,
        background:`linear-gradient(to right, ${bgColor}, transparent)`, pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:0, insetBlock:0, width:44, zIndex:1,
        background:`linear-gradient(to left, ${bgColor}, transparent)`, pointerEvents:"none" }} />
      <div ref={trackRef} style={{ display:"inline-block", whiteSpace:"nowrap",
        color, fontSize:12.5, fontWeight:700, letterSpacing:"0.03em",
        textShadow:`0 0 8px rgba(${rgb(color)},0.5)` }}>
        {doubled}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Panel wrapper
════════════════════════════════════════ */
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: SURF,
      border:`1px solid ${LINE}`,
      borderRadius:16,
      boxShadow:`0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`,
      ...style,
    }}>{children}</div>
  );
}

/* ════════════════════════════════════════
   SectionLabel
════════════════════════════════════════ */
function SectionLabel({ title, color = C.cyan, live }: { title: string; color?: string; live?: boolean }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10, flexShrink:0 }}>
      {live && (
        <div style={{ width:7, height:7, borderRadius:"50%", background:color,
          boxShadow:`0 0 8px ${color}`, animation:"liveDot 2s ease-in-out infinite" }} />
      )}
      <span style={{ fontSize:11, fontWeight:800, color:C.dim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
        {title}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════
   Main page
════════════════════════════════════════ */
export default function ScreenDisplay() {
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const [chartIdx, setChartIdx]   = useState(0);
  const [chartKey, setChartKey]   = useState(0);

  const { data, dataUpdatedAt } = useQuery<ScreenData>({
    queryKey:["screen"], queryFn:fetchScreen,
    refetchInterval:REFRESH_SEC*1000, staleTime:0,
  });

  const ready = !!data;
  const kpi   = data?.kpi;

  useEffect(() => {
    setCountdown(REFRESH_SEC);
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_SEC : c - 1), 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  useEffect(() => {
    const t = setInterval(() => { setChartIdx(i => (i+1)%3); setChartKey(k => k+1); }, CHART_SWAP);
    return () => clearInterval(t);
  }, []);

  const switchChart = (i: number) => { setChartIdx(i); setChartKey(k => k+1); };

  const today = useMemo(() => {
    if (!data?.timeSeries?.length) return { newUsers:0, newDemands:0, newOrders:0 };
    return data.timeSeries[data.timeSeries.length - 1];
  }, [data]);

  const totalDemands = useMemo(() =>
    (data?.demandStatusChart ?? []).reduce((s, d) => s + d.value, 0), [data]);

  const chartTip = {
    backgroundColor:"#0b1d35", border:`1px solid ${LINE}`,
    borderRadius:8, color:C.text, fontSize:12,
    boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
  };

  return (
    <>
      <style>{KF}</style>
      <div style={{
        width:"100vw", height:"100vh",
        background:`linear-gradient(155deg, #070f1c 0%, #091520 50%, #07111d 100%)`,
        color:C.text,
        fontFamily:"'PingFang SC','Microsoft YaHei',system-ui,sans-serif",
        display:"flex", flexDirection:"column",
        overflow:"hidden", position:"relative",
      }}>

        {/* ── Background: orbs + subtle grid ── */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
          <div style={{ position:"absolute", top:"-5%", left:"5%", width:500, height:500, borderRadius:"50%",
            background:`radial-gradient(circle, rgba(${rgb(C.cyan)},0.08) 0%, transparent 65%)`,
            animation:"orb1 15s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"5%", right:"5%", width:420, height:420, borderRadius:"50%",
            background:`radial-gradient(circle, rgba(${rgb(C.purple)},0.08) 0%, transparent 65%)`,
            animation:"orb2 19s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:"40%", right:"25%", width:300, height:300, borderRadius:"50%",
            background:`radial-gradient(circle, rgba(${rgb(C.teal)},0.06) 0%, transparent 65%)`,
            animation:"orb3 12s ease-in-out infinite" }} />
          {/* Thin grid */}
          <div style={{ position:"absolute", inset:0,
            backgroundImage:`linear-gradient(rgba(0,180,220,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(0,180,220,0.04) 1px, transparent 1px)`,
            backgroundSize:"70px 70px" }} />
        </div>

        {/* ════ HEADER ════ */}
        <header style={{
          zIndex:1, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 32px",
          background:"rgba(7,15,28,0.7)",
          backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          borderBottom:`1px solid rgba(${rgb(C.cyan)},0.12)`,
          boxShadow:`0 1px 0 rgba(${rgb(C.cyan)},0.06)`,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{
              width:44, height:44, borderRadius:12, flexShrink:0,
              background:`linear-gradient(135deg, ${C.cyan} 0%, ${C.blue} 100%)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:21, fontWeight:900, color:"#fff",
              boxShadow:`0 0 24px rgba(${rgb(C.cyan)},0.5)`,
            }}>接</div>
            <div>
              <div style={{
                fontSize:21, fontWeight:900, letterSpacing:"0.07em", lineHeight:1.1,
                background:`linear-gradient(90deg, ${C.text} 0%, ${C.cyan} 45%, ${C.purple} 90%)`,
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>
                接单吧  OPC 撮合交易平台  数据大屏
              </div>
              <div style={{ fontSize:10, color:C.dim, letterSpacing:"0.14em", marginTop:3 }}>
                JIEDANBA · OPC MATCHING PLATFORM · REAL-TIME SHOWCASE
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            {/* Status badge */}
            <div style={{
              display:"flex", alignItems:"center", gap:7,
              background:`rgba(${rgb(C.green)},0.08)`,
              border:`1px solid rgba(${rgb(C.green)},0.3)`,
              borderRadius:20, padding:"5px 14px",
            }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.green,
                boxShadow:`0 0 8px ${C.green}`, animation:"liveDot 2s ease-in-out infinite" }} />
              <span style={{ fontSize:11, fontWeight:700, color:C.green, letterSpacing:"0.04em" }}>
                平台运行正常
              </span>
            </div>
            <LiveClock />
            <CountdownRing n={countdown} total={REFRESH_SEC} />
          </div>
        </header>

        {/* ════ KPI CARDS ════ */}
        <div style={{ zIndex:1, flexShrink:0, display:"flex", gap:9, padding:"10px 32px" }}>
          <KpiCard label="平台总用户"   value={kpi?.totalUsers ?? 0}        accent={C.cyan}   icon="👥" delay={0}   ready={ready} />
          <KpiCard label="OPC 数量"     value={kpi?.opcCount ?? 0}           accent={C.blue}   icon="🎯" delay={60}  ready={ready} />
          <KpiCard label="发单企业"     value={kpi?.publisherCount ?? 0}     accent={C.purple} icon="🏢" delay={120} ready={ready} />
          <KpiCard label="已发布需求"   value={kpi?.publishedDemands ?? 0}   accent={C.teal}   icon="📋" delay={180} ready={ready} />
          <KpiCard label="进行中订单"   value={kpi?.inProgressOrders ?? 0}   accent={C.cyan}   icon="⚡" delay={240} ready={ready} />
          <KpiCard label="已完成订单"   value={kpi?.completedOrders ?? 0}    accent={C.green}  icon="✅" delay={300} ready={ready} />
          <KpiCard label="订单完成率"   value={kpi?.completionRate ?? 0} unit="%" accent={C.pink}  icon="📈" delay={360} ready={ready} />
          <KpiCard label="平台累计结算" value={kpi?.totalSettled ?? 0}   unit="元" accent={C.amber} icon="💰" delay={420} ready={ready} />
        </div>

        {/* ════ MAIN CONTENT ════ */}
        <div style={{ zIndex:1, flex:1, minHeight:0, display:"flex", gap:9, padding:"0 32px" }}>

          {/* ── Left column: chart on top, 3 info panels below ── */}
          <div style={{ flex:60, display:"flex", flexDirection:"column", gap:9, minHeight:0 }}>

          {/* Chart carousel */}
          <Panel style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden", padding:"14px 20px 12px" }}>
            {/* Tab bar */}
            <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ display:"flex", gap:6 }}>
                {CHART_TABS.map((label, i) => (
                  <button key={i} onClick={() => switchChart(i)} style={{
                    padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                    fontSize:11.5, fontWeight:700, letterSpacing:"0.04em",
                    transition:"all 0.3s ease",
                    background: chartIdx === i ? `rgba(${rgb(C.cyan)},0.15)` : "transparent",
                    color: chartIdx === i ? C.cyan : C.dim,
                    boxShadow: chartIdx === i
                      ? `0 0 0 1px rgba(${rgb(C.cyan)},0.4), 0 0 12px rgba(${rgb(C.cyan)},0.1)`
                      : `0 0 0 1px rgba(255,255,255,0.06)`,
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {[0,1,2].map(i => (
                  <button key={i} onClick={() => switchChart(i)} style={{
                    width: chartIdx===i ? 22 : 7, height:7, borderRadius:4,
                    border:"none", cursor:"pointer", padding:0,
                    background: chartIdx===i ? C.cyan : `rgba(255,255,255,0.12)`,
                    boxShadow: chartIdx===i ? `0 0 8px ${C.cyan}` : "none",
                    transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                ))}
              </div>
            </div>

            <div key={chartKey} style={{ flex:1, minHeight:0, animation:"chartIn 0.45s ease both" }}>
              {chartIdx === 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.timeSeries ?? []} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`rgba(${rgb(C.cyan)},0.06)`} />
                    <XAxis dataKey="label" tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTip} />
                    <Legend wrapperStyle={{ fontSize:12, color:C.dim, paddingTop:6 }} />
                    <Line type="monotone" dataKey="newUsers"   name="新增用户" stroke={C.cyan}   strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:C.cyan   }} />
                    <Line type="monotone" dataKey="newDemands" name="新增需求" stroke={C.green}  strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:C.green  }} />
                    <Line type="monotone" dataKey="newOrders"  name="新增订单" stroke={C.purple} strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:C.purple }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {chartIdx === 1 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.demandStatusChart ?? []} margin={{ top:8, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`rgba(${rgb(C.cyan)},0.06)`} />
                    <XAxis dataKey="label" tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTip} cursor={{ fill:`rgba(${rgb(C.cyan)},0.04)` }} />
                    <Bar dataKey="value" name="需求数" radius={[6,6,0,0]} isAnimationActive>
                      {(data?.demandStatusChart ?? []).map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartIdx === 2 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" nameKey="label" data={data?.userRoleChart ?? []}
                      cx="50%" cy="44%" innerRadius="36%" outerRadius="62%" paddingAngle={6} isAnimationActive>
                      {(data?.userRoleChart ?? []).map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTip} formatter={(v:number) => [v.toLocaleString(),"人数"]} />
                    <Legend wrapperStyle={{ fontSize:13 }}
                      formatter={(val, e:{ payload?:{value:number} }) => (
                        <span style={{ color:C.text }}>{val} <span style={{ color:C.dim }}>({e.payload?.value ?? 0}人)</span></span>
                      )} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* ── Bottom info strip: 3 panels side by side ── */}
          <div style={{ flexShrink:0, display:"flex", gap:9, height:148 }}>

            {/* Today's highlights */}
            <Panel style={{ flex:3, padding:"11px 14px", display:"flex", flexDirection:"column" }}>
              <SectionLabel title="今日实时新增" color={C.green} live />
              <div style={{ flex:1, display:"flex", gap:8, alignItems:"stretch" }}>
                <TodayStat label="新用户" value={today.newUsers}   accent={C.cyan}  icon="👤" />
                <TodayStat label="新需求" value={today.newDemands} accent={C.teal}  icon="📋" />
                <TodayStat label="新订单" value={today.newOrders}  accent={C.green} icon="🤝" />
              </div>
            </Panel>

            {/* Demand progress */}
            <Panel style={{ flex:5, padding:"11px 14px", display:"flex", flexDirection:"column" }}>
              <SectionLabel title="需求全周期进度" />
              <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-around" }}>
                {(data?.demandStatusChart ?? []).map((d, i) => (
                  <DemandProgress key={d.status} label={d.label} value={d.value}
                    total={totalDemands} color={D_COLORS[d.status] ?? PIE_COLORS[i%PIE_COLORS.length]} delay={i*60} />
                ))}
              </div>
              {data && (
                <div style={{ paddingTop:6, borderTop:`1px solid ${LINE}`, display:"flex",
                  justifyContent:"space-between", fontSize:10.5, color:C.dim, flexShrink:0 }}>
                  <span>需求总计</span>
                  <span style={{ fontWeight:800, color:C.cyan, textShadow:`0 0 8px rgba(${rgb(C.cyan)},0.5)` }}>
                    {totalDemands} 条
                  </span>
                </div>
              )}
            </Panel>

            {/* Completion rate + settlement */}
            <Panel style={{ flex:3, padding:"11px 14px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ position:"relative", width:60, height:60, flexShrink:0 }}>
                <svg width={60} height={60} style={{ transform:"rotate(-90deg)" }}>
                  <circle cx={30} cy={30} r={24} fill="none" stroke={`rgba(${rgb(C.green)},0.1)`} strokeWidth={5} />
                  <circle cx={30} cy={30} r={24} fill="none" stroke={C.green}
                    strokeWidth={5} strokeDasharray={2*Math.PI*24}
                    strokeDashoffset={2*Math.PI*24*(1-(kpi?.completionRate??0)/100)}
                    strokeLinecap="round"
                    style={{ transition:"stroke-dashoffset 1.2s ease", filter:`drop-shadow(0 0 5px ${C.green})` }} />
                </svg>
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:12, fontWeight:900, color:C.green, textShadow:`0 0 12px rgba(${rgb(C.green)},0.6)` }}>
                    {kpi?.completionRate ?? 0}%
                  </span>
                </div>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:10, fontWeight:800, color:C.dim, letterSpacing:"0.06em", textTransform:"uppercase" }}>订单完成率</div>
                <div style={{ fontSize:10.5, color:C.dim, marginTop:2 }}>
                  完成 <span style={{ color:C.green, fontWeight:700 }}>{kpi?.completedOrders ?? 0}</span> ·
                  进行中 <span style={{ color:C.teal, fontWeight:700 }}>{kpi?.inProgressOrders ?? 0}</span>
                </div>
                <div style={{ borderTop:`1px solid ${LINE}`, marginTop:8, paddingTop:7 }}>
                  <div style={{ fontSize:10, color:C.dim }}>累计结算</div>
                  <div style={{ fontSize:18, fontWeight:900, color:C.amber, lineHeight:1.1,
                    textShadow:`0 0 14px rgba(${rgb(C.amber)},0.5)` }}>
                    {kpi ? (kpi.totalSettled >= 10000 ? `${(kpi.totalSettled/10000).toFixed(1)}万` : kpi.totalSettled.toLocaleString("zh-CN")) : "—"}
                    <span style={{ fontSize:11, fontWeight:400, color:C.dim, marginLeft:3 }}>元</span>
                  </div>
                </div>
              </div>
            </Panel>

          </div>

          {/* close left column */}
          </div>

          {/* ── Right: Activity feed only (full height) ── */}
          <Panel style={{ flex:40, display:"flex", flexDirection:"column", overflow:"hidden", padding:"14px 16px" }}>
            <SectionLabel title="实时动态" color={C.cyan} live />
            {data
              ? <ActivityFeed ticker1={data.ticker1} ticker2={data.ticker2} />
              : <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.dim, fontSize:12 }}>加载中…</div>
            }
          </Panel>

        </div>

        {/* ════ TICKERS ════ */}
        <div style={{ zIndex:1, flexShrink:0 }}>
          {/* Ticker 1 */}
          {(() => { const bg = `rgba(0,180,${220*0.15+7*0.85},1)`; return (
            <div style={{
              display:"flex", alignItems:"center", padding:"7px 0",
              background:`linear-gradient(90deg, rgba(${rgb(C.cyan)},0.08) 0%, rgba(${rgb(C.blue)},0.05) 100%)`,
              borderTop:`1px solid rgba(${rgb(C.cyan)},0.1)`,
            }}>
              <div style={{ flexShrink:0, padding:"0 14px 0 32px", fontSize:10.5, fontWeight:900,
                color:C.cyan, letterSpacing:"0.08em", whiteSpace:"nowrap",
                textShadow:`0 0 10px rgba(${rgb(C.cyan)},0.6)` }}>
                🎉 平台动态
              </div>
              <Ticker items={data?.ticker1 ?? []} color={C.cyan} bgColor={bg} />
            </div>
          ); })()}
          {/* Ticker 2 */}
          {(() => { const bg2 = `rgba(${rgb(BG)},1)`; return (
            <div style={{
              display:"flex", alignItems:"center", padding:"7px 0",
              background:`linear-gradient(90deg, rgba(${rgb(C.amber)},0.07) 0%, rgba(${rgb(C.pink)},0.04) 100%)`,
              borderTop:`1px solid rgba(${rgb(C.amber)},0.08)`,
            }}>
              <div style={{ flexShrink:0, padding:"0 14px 0 32px", fontSize:10.5, fontWeight:900,
                color:C.amber, letterSpacing:"0.08em", whiteSpace:"nowrap",
                textShadow:`0 0 10px rgba(${rgb(C.amber)},0.6)` }}>
                🏆 喜报连连
              </div>
              <Ticker items={data?.ticker2 ?? []} color={C.amber} bgColor={bg2} />
            </div>
          ); })()}
        </div>
      </div>
    </>
  );
}
