import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getValidAccessToken, clearSession } from "@/lib/auth";
import { format } from "date-fns";
import clsx from "clsx";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Users, FileText } from "lucide-react";

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
  cumulativeSeries: { date: string; label: string; totalOpc: number; totalPublisher: number }[];
  demandStatusChart: { status: string; label: string; value: number }[];
  orderTypeChart: { type: string; label: string; value: number }[];
  demandList: { id: number; publisher: string; title: string; budget: string; status: string; statusLabel: string }[];
  ticker1: { text: string }[];
  ticker2: { text: string }[];
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const REFRESH_SEC = 60;

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
   CSS keyframes for custom animations
════════════════════════════════════════ */
const KF = `
  @keyframes orb1  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(55px,-40px)} }
  @keyframes orb2  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(-40px,45px)} }
  @keyframes feedScroll { from{transform:translateY(0)} to{transform:translateY(-50%)} }
  @keyframes tickerScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes liveDot { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes kpiIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes chartIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
`;

/* ════════════════════════════════════════
   Count-up hook
════════════════════════════════════════ */
function useCountUp(target: number, ready: boolean, ms = 1400, delay = 0) {
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
   Header — Figma Design
════════════════════════════════════════ */
function Header() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex items-center justify-between px-8 py-3 h-24 w-full bg-gradient-to-b from-[#0f1f45]/60 to-transparent shrink-0">
      {/* Top Line Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(6,182,212,1)]" />

      {/* Time - Left */}
      <div className="w-[30%] flex items-center">
        <div className="text-[44px] font-mono font-bold text-slate-100 tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
          {format(time, "HH:mm:ss")}
        </div>
      </div>

      {/* Center Title */}
      <div className="flex-1 flex justify-center items-center relative h-full shrink-0">
        <div className="absolute top-4 w-[110%] h-12 flex items-center justify-center pointer-events-none">
          <div className="absolute bottom-0 w-[80%] h-px bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          <div className="absolute left-[10%] bottom-0 w-8 h-px bg-cyan-400 origin-bottom-right -rotate-45 transform translate-y-px" />
          <div className="absolute left-[5%] bottom-1 flex gap-1 -skew-x-[30deg]">
            <div className="w-4 h-1.5 bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
            <div className="w-4 h-1.5 bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
            <div className="w-4 h-1.5 bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)] opacity-50" />
          </div>
          <div className="absolute right-[10%] bottom-0 w-8 h-px bg-cyan-400 origin-bottom-left rotate-45 transform translate-y-px" />
          <div className="absolute right-[5%] bottom-1 flex gap-1 -skew-x-[30deg]">
            <div className="w-4 h-1.5 bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)] opacity-50" />
            <div className="w-4 h-1.5 bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
            <div className="w-4 h-1.5 bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
          </div>
        </div>
        <h1 className="relative z-10 text-[36px] font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-purple-400 drop-shadow-[0_2px_15px_rgba(168,85,247,0.5)] flex items-center gap-3">
          <span>接单吧 OPC 撮合交易平台</span>
          <span className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">数据大屏</span>
        </h1>
      </div>

      {/* Status - Right */}
      <div className="w-[30%] flex justify-end items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,1)] animate-pulse" />
          <span className="text-[20px] text-emerald-400 font-medium tracking-wider drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
            平台运行正常
          </span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   StatCard — Figma Design
════════════════════════════════════════ */
const colorMap = {
  cyan:    { border: "border-cyan-500",    text: "text-cyan-400",    bg: "bg-cyan-950/20",    shadow: "shadow-[inset_0_0_20px_rgba(6,182,212,0.3)]",    glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",    bar: "bg-cyan-400",    icon: "bg-cyan-950/50 border-cyan-700" },
  blue:    { border: "border-blue-500",    text: "text-blue-400",    bg: "bg-blue-950/20",    shadow: "shadow-[inset_0_0_20px_rgba(59,130,246,0.3)]",    glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",    bar: "bg-blue-400",    icon: "bg-blue-950/50 border-blue-700" },
  purple:  { border: "border-purple-500",  text: "text-purple-400",  bg: "bg-purple-950/20",  shadow: "shadow-[inset_0_0_20px_rgba(168,85,247,0.3)]",    glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]",    bar: "bg-purple-400",  icon: "bg-purple-950/50 border-purple-700" },
  emerald: { border: "border-emerald-500", text: "text-emerald-400", bg: "bg-emerald-950/20", shadow: "shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]",    glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",    bar: "bg-emerald-400", icon: "bg-emerald-950/50 border-emerald-700" },
  amber:   { border: "border-amber-500",   text: "text-amber-400",   bg: "bg-amber-950/20",   shadow: "shadow-[inset_0_0_20px_rgba(245,158,11,0.3)]",    glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",    bar: "bg-amber-400",   icon: "bg-amber-950/50 border-amber-700" },
  rose:    { border: "border-rose-500",    text: "text-rose-400",    bg: "bg-rose-950/20",    shadow: "shadow-[inset_0_0_20px_rgba(244,63,94,0.3)]",     glow: "shadow-[0_0_15px_rgba(244,63,94,0.3)]",     bar: "bg-rose-400",    icon: "bg-rose-950/50 border-rose-700" },
} as const;

type ColorType = keyof typeof colorMap;

function StatCard({ title, value, unit = "", icon, colorType = "cyan", delay = 0, ready = true }: {
  title: string; value: number; unit?: string;
  icon: React.ReactNode; colorType?: ColorType; delay?: number; ready?: boolean;
}) {
  const n = useCountUp(value, ready, 1400, delay);
  const display = n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString("zh-CN");
  const c = colorMap[colorType];

  return (
    <div
      className={clsx(
        "relative flex flex-col justify-between p-3 rounded-xl border overflow-hidden",
        c.border, c.bg, c.shadow, c.glow
      )}
      style={{ animation: `kpiIn 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms both` }}
    >
      {/* Top glow bar */}
      <div className={clsx("absolute top-0 left-0 right-0 h-[2px] opacity-80", c.bar)} />

      <div className="flex items-center justify-between mb-1">
        <span className="text-[17px] font-bold text-slate-400 tracking-[0.08em] uppercase leading-tight">{title}</span>
        <div className={clsx("w-8 h-8 rounded-md border flex items-center justify-center", c.icon)}>
          <span className={clsx("w-5 h-5", c.text)}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 leading-none mt-1">
        <span className={clsx("text-[42px] font-black font-mono tabular-nums", c.text)}>{display}</span>
        {unit && <span className="text-[17px] text-slate-500 font-medium">{unit}</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Panel — Figma Design
════════════════════════════════════════ */
function Panel({ children, title, borderColor = "border-cyan-500/50", className = "", style }: {
  children: React.ReactNode; title?: string;
  borderColor?: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={clsx(
      "relative rounded-xl border bg-[#0a1530]/80 shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]",
      "backdrop-blur-sm overflow-hidden flex flex-col",
      borderColor, className
    )} style={style}>
      {title && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5 shrink-0">
          <div className="w-1.5 h-5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="text-[20px] font-bold text-slate-400 tracking-[0.08em] uppercase">{title}</span>
        </div>
      )}
      <div className={clsx("flex flex-col flex-1 min-h-0", title ? "p-3 pt-2" : "p-3")}>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ScreenVideoPlayer — auto-cycling video
════════════════════════════════════════ */
type ScreenVideoItem = { id: number; title: string; objectPath: string };

function ScreenVideoPlayer() {
  const [videos, setVideos] = useState<ScreenVideoItem[]>([]);
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadVideos = () => {
    fetch(`${BASE}/api/screen/videos`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setVideos(d); })
      .catch(() => {});
  };

  useEffect(() => {
    loadVideos();
    const t = setInterval(loadVideos, 300_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (el && videos.length > 0) {
      el.load();
      el.play().catch(() => {});
    }
  }, [idx, videos.length]);

  const handleEnded = () => setIdx(i => i + 1);

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
        <div className="w-14 h-14 rounded-2xl border border-slate-700/60 flex items-center justify-center">
          <span className="text-2xl">🎬</span>
        </div>
        <span className="text-[11px] tracking-wider uppercase">暂无视频</span>
      </div>
    );
  }

  const current = videos[idx % videos.length];
  return (
    <video
      ref={videoRef}
      key={idx}
      src={`${BASE}/api/storage${current.objectPath}`}
      className="flex-1 min-h-0 w-full object-cover"
      autoPlay
      muted
      playsInline
      loop={videos.length === 1}
      onEnded={handleEnded}
    />
  );
}

/* ════════════════════════════════════════
   DemandList — scrolling demand feed
════════════════════════════════════════ */
const DEMAND_STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  published:          { text: "text-cyan-400",    bg: "bg-cyan-950/40",    border: "border-cyan-500/40" },
  matched:            { text: "text-blue-400",    bg: "bg-blue-950/40",    border: "border-blue-500/40" },
  in_progress:        { text: "text-purple-400",  bg: "bg-purple-950/40",  border: "border-purple-500/40" },
  pending_acceptance: { text: "text-amber-400",   bg: "bg-amber-950/40",   border: "border-amber-500/40" },
  completed:          { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-500/40" },
};

function DemandList({ items }: { items: ScreenData["demandList"] }) {
  const doubled = useMemo(() => (items.length ? [...items, ...items] : []), [items]);
  const half = Math.max(1, items.length);
  const duration = half * 3;
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = `feedScroll ${duration}s linear infinite`;
  }, [items]);

  if (!items.length) return (
    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">暂无需求</div>
  );

  return (
    <div className="flex-1 overflow-hidden relative min-h-0">
      {/* Fade masks */}
      <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-[#0a1530] to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[#0a1530] to-transparent pointer-events-none z-10" />

      <div ref={trackRef} style={{ animation: `feedScroll ${duration}s linear infinite` }}>
        {doubled.map((item, i) => {
          const s = DEMAND_STATUS_STYLE[item.status] ?? { text: "text-slate-400", bg: "bg-slate-900/40", border: "border-slate-500/40" };
          return (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 px-1">
              <span className="text-[13px] font-bold text-slate-400 shrink-0 w-12 truncate">{item.publisher}</span>
              <span className="flex-1 text-[13px] text-slate-300 truncate min-w-0">{item.title}</span>
              <span className="text-[11px] font-bold text-amber-400 shrink-0 whitespace-nowrap">{item.budget}</span>
              <span className={clsx("text-[11px] font-bold px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap", s.text, s.bg, s.border)}>
                {item.statusLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   TrendChart — cumulative OPC/publisher
════════════════════════════════════════ */
function niceAxisDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
  const step = magnitude >= 1 ? magnitude : 1;
  const domainMin = Math.floor(min / step) * step;
  const domainMax = Math.ceil(max / step) * step;
  return [domainMin, domainMax];
}

function TrendChart({ data }: { data: ScreenData["cumulativeSeries"] }) {
  const chartData = data.map(d => ({
    date: d.label || d.date,
    opc: d.totalOpc,
    publisher: d.totalPublisher,
  }));

  const opcDomain = niceAxisDomain(chartData.map(d => d.opc));
  const pubDomain = niceAxisDomain(chartData.map(d => d.publisher));

  return (
    <div className="flex flex-col h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorOpc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPublisher" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={15} tickLine={false} axisLine={{ stroke: "#334155" }} />
          <YAxis
            yAxisId="left"
            orientation="left"
            stroke="#06b6d4"
            fontSize={14}
            tickLine={false}
            axisLine={{ stroke: "#06b6d4", strokeOpacity: 0.4 }}
            allowDecimals={false}
            domain={opcDomain}
            tickCount={5}
            tick={{ fill: "#06b6d4" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#a855f7"
            fontSize={14}
            tickLine={false}
            axisLine={{ stroke: "#a855f7", strokeOpacity: 0.4 }}
            allowDecimals={false}
            domain={pubDomain}
            tickCount={5}
            tick={{ fill: "#a855f7" }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(2,13,36,0.9)", borderColor: "rgba(6,182,212,0.3)", color: "#e2e8f0", borderRadius: 6 }}
            itemStyle={{ fontSize: 17, fontWeight: "bold" }}
            labelStyle={{ fontSize: 15, color: "#94a3b8" }}
          />
          <Legend verticalAlign="top" height={40} iconType="diamond"
            formatter={(value) => <span style={{ color: "#cbd5e1", fontSize: 18 }}>{value}</span>} />
          <Area yAxisId="left" type="monotone" name="OPC 累计" dataKey="opc" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorOpc)"
            dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#06b6d4", stroke: "#fff", strokeWidth: 2 }} />
          <Area yAxisId="right" type="monotone" name="发单方累计" dataKey="publisher" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorPublisher)"
            dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#a855f7", stroke: "#fff", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ════════════════════════════════════════
   TodayStats — Figma Design with real data
════════════════════════════════════════ */
function TodayStats({ newUsers, newDemands, newOrders }: { newUsers: number; newDemands: number; newOrders: number }) {
  const items = [
    { label: "今日新用户", value: newUsers,   colorClass: "text-cyan-400",    borderClass: "border-cyan-500/40",   bgClass: "bg-cyan-950/30",   icon: "👤" },
    { label: "今日新需求", value: newDemands, colorClass: "text-teal-400",    borderClass: "border-teal-500/40",   bgClass: "bg-teal-950/30",   icon: "📋" },
    { label: "今日新订单", value: newOrders,  colorClass: "text-emerald-400", borderClass: "border-emerald-500/40", bgClass: "bg-emerald-950/30", icon: "🤝" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5 h-full">
      {items.map((item, i) => (
        <div key={i} className={clsx(
          "rounded-lg border px-4 flex items-center justify-between",
          item.borderClass, item.bgClass
        )}>
          <div className="flex items-center gap-2">
            <span className="text-lg shrink-0">{item.icon}</span>
            <span className="text-[16px] font-bold text-slate-400 tracking-wider">{item.label}</span>
          </div>
          <span className={clsx("text-[30px] font-black font-mono tabular-nums leading-none", item.colorClass)}>
            {item.value > 0 ? `+${item.value}` : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   ProgressBars — Figma Design with real data
════════════════════════════════════════ */
const STATUS_COLORS: Record<string, { colorClass: string; shadowClass: string }> = {
  published:          { colorClass: "bg-cyan-400",    shadowClass: "shadow-[0_0_10px_rgba(6,182,212,1)]" },
  matched:            { colorClass: "bg-blue-400",    shadowClass: "shadow-[0_0_10px_rgba(59,130,246,1)]" },
  in_progress:        { colorClass: "bg-purple-400",  shadowClass: "shadow-[0_0_10px_rgba(168,85,247,1)]" },
  pending_acceptance: { colorClass: "bg-amber-400",   shadowClass: "shadow-[0_0_10px_rgba(245,158,11,1)]" },
  completed:          { colorClass: "bg-emerald-400", shadowClass: "shadow-[0_0_10px_rgba(16,185,129,1)]" },
};

function ProgressBars({ data, total }: { data: ScreenData["demandStatusChart"]; total: number }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 justify-between w-full px-1">
      {data.map((item, index) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        const c = STATUS_COLORS[item.status] ?? { colorClass: "bg-slate-400", shadowClass: "" };
        return (
          <div key={index} className="flex items-center gap-2">
            <span className="text-[15px] text-slate-300 w-16 text-right font-medium shrink-0">{item.label}</span>
            <div className="flex-1 h-3 bg-[#0a1936] rounded-full overflow-hidden border border-cyan-900/50 shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]">
              <div
                className={clsx("h-full rounded-full transition-all duration-1000 ease-out", c.colorClass, c.shadowClass)}
                style={{ width: `${pct === 0 ? 2 : pct}%` }}
              />
            </div>
            <div className="w-20 flex items-center justify-between text-[14px] text-slate-400 font-mono shrink-0">
              <span className="font-bold">{item.value}</span>
              <span className="text-slate-500">({pct}%)</span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between items-center border-t border-white/5 pt-1 text-[14px]">
        <span className="text-slate-500">需求总计</span>
        <span className="font-bold text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]">{total} 条</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   OrderTypeChart — pie + list by demand type
════════════════════════════════════════ */
const ORDER_TYPE_COLORS = ["#06b6d4", "#3b82f6", "#f59e0b", "#a855f7", "#64748b"];

function OrderTypeChart({ data }: { data: ScreenData["orderTypeChart"] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const pieData = data.filter(d => d.value > 0);

  return (
    <div className="flex-1 min-h-0 flex items-stretch gap-3 px-1">
      {/* Left: pie chart */}
      <div className="flex-[3] min-w-0 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData.length ? pieData : [{ label: "暂无", value: 1 }]}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="72%"
              paddingAngle={3}
              strokeWidth={0}
            >
              {(pieData.length ? pieData : [{ label: "暂无", value: 1 }]).map((_, i) => (
                <Cell key={i} fill={pieData.length ? ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length] : "#1e293b"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(2,13,36,0.9)", borderColor: "rgba(6,182,212,0.3)", color: "#e2e8f0", borderRadius: 6 }}
              itemStyle={{ fontSize: 15, fontWeight: "bold" }}
              formatter={(value: number) => [`${value} 单`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Vertical divider */}
      <div className="self-stretch w-px bg-white/5 my-3 shrink-0" />

      {/* Right: list */}
      <div className="flex-[2] flex flex-col justify-center gap-2 py-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length], boxShadow: `0 0 6px ${ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length]}` }} />
              <span className="text-[14px] text-slate-300 truncate">{item.label}</span>
            </div>
            <span className="text-[16px] font-black font-mono tabular-nums shrink-0" style={{ color: ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length] }}>
              {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Ticker — horizontal scrolling bar
════════════════════════════════════════ */
function Ticker({ items, color, label }: { items: { text: string }[]; color: "cyan" | "amber"; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sep = "　｜　";
  const raw = items.map(i => i.text).join(sep);
  const doubled = raw ? raw + sep + raw : "";

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !doubled) return;
    const speed = 60;
    const totalWidth = el.scrollWidth / 2;
    const dur = totalWidth / speed;
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = `tickerScroll ${dur}s linear infinite`;
    el.style.animationDirection = "normal";
    el.style.animationPlayState = "running";
  }, [doubled]);

  if (!items.length) return null;

  return (
    <div className={clsx(
      "flex items-center h-9 border-t overflow-hidden shrink-0",
      color === "cyan" ? "border-cyan-900/40 bg-[#020d24]/80" : "border-amber-900/40 bg-[#040c18]/80"
    )}>
      <div className={clsx(
        "shrink-0 px-4 text-[14px] font-black tracking-[0.08em] whitespace-nowrap",
        color === "cyan" ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                        : "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
      )} style={{ padding: "7px 14px 7px 24px" }}>
        {label}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className={clsx("absolute left-0 inset-y-0 w-10 z-10 pointer-events-none",
          color === "cyan" ? "bg-gradient-to-r from-[#040c1a] to-transparent" : "bg-gradient-to-r from-[#040c1a] to-transparent")} />
        <div className={clsx("absolute right-0 inset-y-0 w-10 z-10 pointer-events-none",
          color === "cyan" ? "bg-gradient-to-l from-[#040c1a] to-transparent" : "bg-gradient-to-l from-[#040c1a] to-transparent")} />
        <div ref={trackRef} className={clsx(
          "inline-block whitespace-nowrap text-[16px] font-bold tracking-[0.03em]",
          color === "cyan"
            ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]"
            : "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]"
        )} style={{ padding: "7px 0" }}>
          {doubled}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   CountdownRing
════════════════════════════════════════ */
function CountdownRing({ n, total }: { n: number; total: number }) {
  const r = 14, c2 = 2 * Math.PI * r;
  const color = n <= 10 ? "#fbbf24" : "#06b6d4";
  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg width={36} height={36} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={18} cy={18} r={r} fill="none" stroke={`${color}25`} strokeWidth={2} />
        <circle cx={18} cy={18} r={r} fill="none" stroke={color}
          strokeWidth={2} strokeDasharray={c2} strokeDashoffset={c2 * (1 - n / total)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear", filter: `drop-shadow(0 0 3px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black tabular-nums" style={{ color }}>{n}s</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Main Screen Page
════════════════════════════════════════ */
export default function ScreenDisplay() {
  const [countdown, setCountdown] = useState(REFRESH_SEC);

  const { data, dataUpdatedAt } = useQuery<ScreenData>({
    queryKey: ["screen"], queryFn: fetchScreen,
    refetchInterval: REFRESH_SEC * 1000, staleTime: 0,
  });

  const ready = !!data;
  const kpi = data?.kpi;

  useEffect(() => {
    setCountdown(REFRESH_SEC);
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_SEC : c - 1), 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  const today = useMemo(() => {
    if (!data?.timeSeries?.length) return { newUsers: 0, newDemands: 0, newOrders: 0 };
    return data.timeSeries[data.timeSeries.length - 1];
  }, [data]);

  const totalDemands = useMemo(() =>
    (data?.demandStatusChart ?? []).reduce((s, d) => s + d.value, 0), [data]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [demandColWidth, setDemandColWidth] = useState(0);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDemandColWidth(Math.floor(entry.contentRect.height * 9 / 16));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const kpiCards = [
    { title: "平台总用户",   value: kpi?.totalUsers ?? 0,      icon: <Users className="w-full h-full" />,       colorType: "cyan"    as ColorType, delay: 0   },
    { title: "OPC 数量",     value: kpi?.opcCount ?? 0,         icon: <Users className="w-full h-full" />,       colorType: "blue"    as ColorType, delay: 50  },
    { title: "发单企业",     value: kpi?.publisherCount ?? 0,   icon: <FileText className="w-full h-full" />,    colorType: "purple"  as ColorType, delay: 100 },
    { title: "已发布需求",   value: kpi?.publishedDemands ?? 0, icon: <FileText className="w-full h-full" />,    colorType: "emerald" as ColorType, delay: 150 },
  ];

  return (
    <>
      <style>{KF}</style>
      <div
        className="text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 relative"
        style={{ background: "linear-gradient(155deg, #040b17 0%, #060f1e 50%, #040c18 100%)", width: "100vw", height: "100vh", overflow: "hidden", fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','微软雅黑','SimHei','STHeiti','Noto Sans SC',system-ui,sans-serif" }}
      >
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-5%] left-[5%] w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)", animation: "orb1 15s ease-in-out infinite" }} />
          <div className="absolute bottom-[5%] right-[5%] w-[420px] h-[420px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 65%)", animation: "orb2 19s ease-in-out infinite" }} />
          <div className="absolute inset-0"
            style={{ backgroundImage: "linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        {/* Main layout */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-[1920px] mx-auto">

          {/* ═══ HEADER ═══ */}
          <Header />

          {/* Countdown indicator */}
          <div className="absolute top-3 right-8 flex items-center gap-2 z-20">
            <CountdownRing n={countdown} total={REFRESH_SEC} />
          </div>

          {/* ═══ MAIN CONTENT ═══ */}
          <div ref={contentRef} className="flex-1 min-h-0 flex gap-3 px-6 pb-2">

            {/* Left column — takes all space not used by demand list */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">

              {/* ═══ KPI STATS ROW ═══ */}
              <div className="grid grid-cols-4 gap-3 shrink-0" style={{ height: 148 }}>
                {kpiCards.map((s, i) => (
                  <StatCard key={i} {...s} ready={ready} />
                ))}
              </div>

              {/* Trend Chart */}
              <Panel title="近14天增长趋势" borderColor="border-cyan-500/40" className="flex-[5.5] min-h-0">
                {data?.cumulativeSeries?.length
                  ? <TrendChart data={data.cumulativeSeries} />
                  : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
                }
              </Panel>

              {/* Bottom section */}
              <div className="flex-[4.5] min-h-0 flex gap-3">

                {/* Left: demand list */}
                <Panel title="近期需求" borderColor="border-cyan-500/40" className="flex-[5.5] min-h-0 min-w-0 overflow-hidden">
                  {data
                    ? <DemandList items={data.demandList ?? []} />
                    : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
                  }
                </Panel>

                {/* Right: order type chart */}
                <Panel title="订单占比" borderColor="border-emerald-500/40" className="flex-[4] min-w-0">
                  {data?.orderTypeChart
                    ? <OrderTypeChart data={data.orderTypeChart} />
                    : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
                  }
                </Panel>

                {/* QR code + URL — small panel right of 订单占比 */}
                <Panel borderColor="border-cyan-500/30" className="flex-[1.8] min-w-0 min-h-0">
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <span className="text-[11px] font-bold text-slate-500 tracking-[0.1em] uppercase">扫码联系客服</span>
                    <div className="p-1.5 rounded-lg bg-white shadow-[0_0_16px_rgba(6,182,212,0.5)]">
                      <img
                        src={`${BASE}/qrcode.jpg`}
                        alt="客服二维码"
                        className="block rounded"
                        style={{ width: 88, height: 88, objectFit: "cover" }}
                      />
                    </div>
                    <span className="text-[16px] font-extrabold text-cyan-300 tracking-wide drop-shadow-[0_0_8px_rgba(6,182,212,0.9)] text-center leading-tight">
                      www.opcorder.com
                    </span>
                  </div>
                </Panel>

              </div>
            </div>

            {/* Right column — 视频播放器，精确宽度 = 高度 × 9/16 */}
            <div className="shrink-0 flex flex-col min-h-0" style={{ width: demandColWidth > 0 ? demandColWidth : undefined }}>
              <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-purple-500/40 bg-[#0a1530]/80 shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm overflow-hidden">
                <ScreenVideoPlayer />
              </div>
            </div>

          </div>

          {/* ═══ TICKERS ═══ */}
          <div className="shrink-0 z-10">
            <Ticker items={data?.ticker1 ?? []} color="cyan" label="👥 用户动态" />
            <Ticker items={data?.ticker2 ?? []} color="amber" label="📢 平台信息" />
          </div>

        </div>
      </div>
    </>
  );
}
