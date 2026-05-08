import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getValidAccessToken, clearSession } from "@/lib/auth";
import { format } from "date-fns";
import clsx from "clsx";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Users, FileText, CheckCircle, Clock, TrendingUp, DollarSign, Hexagon } from "lucide-react";

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
   TrendChart — Figma Design with real data
════════════════════════════════════════ */
function TrendChart({ data }: { data: ScreenData["timeSeries"] }) {
  const chartData = data.map(d => ({
    date: d.label || d.date,
    users: d.newUsers,
    demands: d.newDemands,
    orders: d.newOrders,
  }));

  return (
    <div className="flex flex-col h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorDemands" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={15} tickLine={false} axisLine={{ stroke: "#334155" }} />
          <YAxis stroke="#64748b" fontSize={15} tickLine={false} axisLine={{ stroke: "#334155" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(2,13,36,0.9)", borderColor: "rgba(6,182,212,0.3)", color: "#e2e8f0", borderRadius: 6 }}
            itemStyle={{ fontSize: 17, fontWeight: "bold" }}
            labelStyle={{ fontSize: 15, color: "#94a3b8" }}
          />
          <Legend verticalAlign="top" height={40} iconType="diamond"
            formatter={(value) => <span style={{ color: "#cbd5e1", fontSize: 18 }}>{value}</span>} />
          <Area type="monotone" name="新用户" dataKey="users" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)"
            dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#06b6d4", stroke: "#fff", strokeWidth: 2 }} />
          <Area type="monotone" name="新需求" dataKey="demands" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDemands)"
            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
          <Area type="monotone" name="新订单" dataKey="orders" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorOrders)"
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
    { label: "新用户", value: newUsers,   colorClass: "text-cyan-400",    borderClass: "border-cyan-500/40",   bgClass: "bg-cyan-950/30",   icon: "👤" },
    { label: "新需求", value: newDemands, colorClass: "text-teal-400",    borderClass: "border-teal-500/40",   bgClass: "bg-teal-950/30",   icon: "📋" },
    { label: "新订单", value: newOrders,  colorClass: "text-emerald-400", borderClass: "border-emerald-500/40", bgClass: "bg-emerald-950/30", icon: "🤝" },
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
   OrderOverview — Figma Design with real data
════════════════════════════════════════ */
function OrderOverview({ completionRate, completedOrders, inProgressOrders, totalSettled }: {
  completionRate: number; completedOrders: number; inProgressOrders: number; totalSettled: number;
}) {
  const settled = totalSettled >= 10000 ? `${(totalSettled / 10000).toFixed(1)}万` : totalSettled.toLocaleString("zh-CN");

  /* Ring fills container height — use a viewBox so SVG scales freely */
  return (
    <div className="flex-1 min-h-0 flex items-center gap-4 px-2">

      {/* Left block — ring + legend, 3/5 width */}
      <div className="flex-[3] flex items-center justify-center gap-6 min-w-0">
        {/* Ring — fixed 150px */}
        <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - completionRate / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1.2s ease", filter: "drop-shadow(0 0 4px #10b981)" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[26px] font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
              {completionRate}%
            </span>
          </div>
        </div>

        {/* Legend — right of ring */}
        <div className="flex flex-col gap-3 min-w-0 shrink-0">
          <span className="text-[16px] font-bold text-slate-400 whitespace-nowrap">订单完成率</span>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_#10b981]" />
            <span className="text-[15px] text-slate-400 whitespace-nowrap">完成</span>
            <span className="text-[22px] font-black text-emerald-400 font-mono leading-none">{completedOrders}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-400 shrink-0 shadow-[0_0_6px_#2dd4bf]" />
            <span className="text-[15px] text-slate-400 whitespace-nowrap">进行中</span>
            <span className="text-[22px] font-black text-teal-400 font-mono leading-none">{inProgressOrders}</span>
          </div>
        </div>
      </div>

      {/* Vertical divider */}
      <div className="self-stretch w-px bg-white/5 my-4 shrink-0" />

      {/* Right block — 累计结算, 2/5 width */}
      <div className="flex-[2] flex flex-col justify-center items-center gap-3">
        <span className="text-[16px] font-bold text-slate-400 tracking-widest">累计结算</span>
        <div className="flex items-baseline gap-1">
          <span className="text-[46px] font-black font-mono text-amber-400 leading-none drop-shadow-[0_0_18px_rgba(245,158,11,0.9)]">
            {settled}
          </span>
          <span className="text-[20px] font-bold text-slate-300">元</span>
        </div>
      </div>

    </div>
  );
}

/* ════════════════════════════════════════
   LiveFeed — Figma Design with real data
════════════════════════════════════════ */
type FeedItem = { text: string; type: "activity" | "achieve" };

function LiveFeed({ ticker1, ticker2 }: { ticker1: { text: string }[]; ticker2: { text: string }[] }) {
  const items = useMemo(() => {
    const all: FeedItem[] = [
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
  const duration = half * 2.8;

  if (!items.length) return (
    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">暂无动态</div>
  );

  return (
    <div className="flex-1 overflow-hidden relative min-h-0 pl-4">
      {/* Timeline track */}
      <div className="absolute left-[29px] top-4 bottom-4 w-px bg-cyan-900/60 shadow-[0_0_5px_rgba(6,182,212,0.3)]" />

      {/* Fade masks */}
      <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-[#0a1530] to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#0a1530] to-transparent pointer-events-none z-10" />

      <div style={{ animation: `feedScroll ${duration}s linear infinite` }} className="flex flex-col gap-3 py-2">
        {items.map((item, i) => (
          <div key={i} className="relative pl-10 flex items-center">
            {/* Timeline Dot */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.8)] z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-200" />
            </div>
            {/* Content */}
            <div className={clsx(
              "flex-1 flex items-center justify-between p-2.5 rounded-lg border transition-all",
              item.type === "activity"
                ? "bg-gradient-to-r from-cyan-900/30 to-[#020b1e]/50 border-cyan-500/30 shadow-[inset_0_0_15px_rgba(6,182,212,0.08)]"
                : "bg-gradient-to-r from-amber-900/20 to-[#020b1e]/50 border-amber-500/25 shadow-[inset_0_0_15px_rgba(245,158,11,0.05)]"
            )}>
              <p className={clsx("text-[17px] leading-snug font-medium tracking-wide",
                item.type === "activity" ? "text-cyan-50" : "text-amber-100")}>
                {item.text}
              </p>
              <div className={clsx(
                "ml-2 w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md border",
                item.type === "activity"
                  ? "bg-cyan-900/40 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.3)_inset]"
                  : "bg-amber-900/30 border-amber-500/25"
              )}>
                <Hexagon className={clsx("w-3.5 h-3.5 drop-shadow-[0_0_5px_rgba(6,182,212,1)]",
                  item.type === "activity" ? "text-cyan-300" : "text-amber-300")} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Ticker — horizontal scroll
════════════════════════════════════════ */
function Ticker({ items, color, label }: { items: { text: string }[]; color: string; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const text = items.length ? items.map(i => `◆  ${i.text}`).join("      ") : "暂无数据";
  const doubled = `${text}      ${text}`;
  const speed = 55;

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
    <div className={clsx(
      "flex items-center border-t",
      color === "cyan" ? "bg-cyan-900/10 border-cyan-500/10" : "bg-amber-900/8 border-amber-500/8"
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

  const statsData = [
    { title: "平台总用户",   value: kpi?.totalUsers ?? 0,        unit: "",    icon: <Users className="w-full h-full" />,        colorType: "cyan"    as ColorType, delay: 0   },
    { title: "OPC 数量",     value: kpi?.opcCount ?? 0,           unit: "",    icon: <Users className="w-full h-full" />,        colorType: "blue"    as ColorType, delay: 50  },
    { title: "发单企业",     value: kpi?.publisherCount ?? 0,     unit: "",    icon: <FileText className="w-full h-full" />,     colorType: "purple"  as ColorType, delay: 100 },
    { title: "已发布需求",   value: kpi?.publishedDemands ?? 0,   unit: "",    icon: <FileText className="w-full h-full" />,     colorType: "emerald" as ColorType, delay: 150 },
    { title: "进行中订单",   value: kpi?.inProgressOrders ?? 0,   unit: "",    icon: <Clock className="w-full h-full" />,        colorType: "amber"   as ColorType, delay: 200 },
    { title: "已完成订单",   value: kpi?.completedOrders ?? 0,    unit: "",    icon: <CheckCircle className="w-full h-full" />,  colorType: "emerald" as ColorType, delay: 250 },
    { title: "订单完成率",   value: kpi?.completionRate ?? 0,     unit: "%",   icon: <TrendingUp className="w-full h-full" />,   colorType: "rose"    as ColorType, delay: 300 },
    { title: "平台累计结算", value: kpi?.totalSettled ?? 0,       unit: "元",  icon: <DollarSign className="w-full h-full" />,   colorType: "amber"   as ColorType, delay: 350 },
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

          {/* ═══ KPI STATS ROW ═══ */}
          <div className="grid grid-cols-8 gap-3 px-6 mb-3 shrink-0" style={{ height: 148 }}>
            {statsData.map((s, i) => (
              <StatCard key={i} {...s} ready={ready} />
            ))}
          </div>

          {/* ═══ MAIN CONTENT ═══ */}
          <div className="flex-1 min-h-0 flex gap-3 px-6 pb-2">

            {/* Left column — 72% */}
            <div className="flex-[7.5] flex flex-col gap-3 min-w-0">

              {/* Trend Chart */}
              <Panel title="近14天增长趋势" borderColor="border-cyan-500/40" className="flex-[5.5] min-h-0">
                {data?.timeSeries?.length
                  ? <TrendChart data={data.timeSeries} />
                  : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
                }
              </Panel>

              {/* Bottom section — left/right split */}
              <div className="flex-[4.5] min-h-0 flex gap-3">

                {/* Left: today stats (compact) stacked above progress bars */}
                <div className="flex-[5.5] flex flex-col gap-3 min-h-0 min-w-0">
                  <Panel borderColor="border-blue-500/40" className="shrink-0" style={{ height: 78 }}>
                    <TodayStats newUsers={today.newUsers} newDemands={today.newDemands} newOrders={today.newOrders} />
                  </Panel>
                  <Panel title="需求全周期进度" borderColor="border-cyan-500/40" className="flex-1 min-h-0 min-w-0">
                    {data
                      ? <ProgressBars data={data.demandStatusChart} total={totalDemands} />
                      : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
                    }
                  </Panel>
                </div>

                {/* Right: order overview — full height */}
                <Panel title="订单概览" borderColor="border-emerald-500/40" className="flex-[4.5] min-w-0">
                  {kpi
                    ? <OrderOverview
                        completionRate={kpi.completionRate}
                        completedOrders={kpi.completedOrders}
                        inProgressOrders={kpi.inProgressOrders}
                        totalSettled={kpi.totalSettled}
                      />
                    : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
                  }
                </Panel>

              </div>
            </div>

            {/* Right column — 28% (Live Feed) */}
            <Panel title="实时动态" borderColor="border-purple-500/40" className="flex-[2.5] min-h-0">
              <div className="flex items-center gap-1.5 mb-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]"
                  style={{ animation: "liveDot 2s ease-in-out infinite" }} />
                <span className="text-[14px] font-bold text-slate-400 tracking-wider uppercase">LIVE</span>
              </div>
              {data
                ? <LiveFeed ticker1={data.ticker1} ticker2={data.ticker2} />
                : <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">加载中…</div>
              }
            </Panel>

          </div>

          {/* ═══ TICKERS ═══ */}
          <div className="shrink-0 z-10">
            <Ticker items={data?.ticker1 ?? []} color="cyan" label="🎉 平台动态" />
            <Ticker items={data?.ticker2 ?? []} color="amber" label="🏆 喜报连连" />
          </div>

        </div>
      </div>
    </>
  );
}
