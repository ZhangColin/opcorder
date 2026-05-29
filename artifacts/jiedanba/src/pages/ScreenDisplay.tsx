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
   CSS keyframes
════════════════════════════════════════ */
const KF = `
  @keyframes orb1  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(55px,-40px)} }
  @keyframes orb2  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(-40px,45px)} }
  @keyframes orb3  { 0%,100%{transform:translate(0,0)}  50%{transform:translate(30px,35px)} }
  @keyframes feedScroll { from{transform:translateY(0)} to{transform:translateY(-50%)} }
  @keyframes tickerScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes kpiIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
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
   Header
════════════════════════════════════════ */
function Header() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex items-center justify-between px-8 py-3 h-20 w-full shrink-0">
      {/* Top shimmer line — brand poster style */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(192,132,252,0.7) 30%, rgba(244,114,182,0.7) 70%, transparent)" }} />

      {/* Left — clock */}
      <div className="w-[28%] flex items-center">
        <div className="text-[44px] font-mono font-bold tracking-widest"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(192,132,252,0.7))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {format(time, "HH:mm:ss")}
        </div>
      </div>

      {/* Center — brand-style title */}
      <div className="flex-1 flex flex-col items-center shrink-0">
        <div className="flex items-center gap-3 mb-0.5">
          <div className="h-px w-24"
            style={{ background: "linear-gradient(to right, transparent, rgba(192,132,252,0.5))" }} />
          <span className="text-[11px] tracking-[0.25em] font-light"
            style={{ color: "rgba(255,255,255,0.45)" }}>OPC撮合交易平台</span>
          <div className="h-px w-24"
            style={{ background: "linear-gradient(to left, transparent, rgba(192,132,252,0.5))" }} />
        </div>
        <h1 className="text-[36px] font-black tracking-[0.06em] text-white"
          style={{ textShadow: "0 0 40px rgba(168,85,247,0.3)" }}>
          接单吧 OPC 撮合交易平台 · 数据大屏
        </h1>
      </div>

      {/* Right — status */}
      <div className="w-[28%] flex justify-end items-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"
            style={{ animation: "livePulse 2s ease-in-out infinite", boxShadow: "0 0 10px #34d399" }} />
          <span className="text-[18px] text-emerald-300 font-medium tracking-wide">平台运行正常</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Glass Panel
════════════════════════════════════════ */
function Panel({ children, title, className = "", style }: {
  children: React.ReactNode; title?: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={clsx("relative rounded-2xl overflow-hidden flex flex-col", className)}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.13)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
        ...style,
      }}>
      {title && (
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-1 h-5 rounded-full"
            style={{ background: "linear-gradient(180deg, #c084fc, #f472b6)" }} />
          <span className="text-[20px] font-semibold tracking-wide"
            style={{ color: "rgba(255,255,255,0.85)" }}>{title}</span>
        </div>
      )}
      <div className={clsx("flex flex-col flex-1 min-h-0", title ? "p-3 pt-2" : "p-3")}>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   StatCard — gradient glass
════════════════════════════════════════ */
type GradDef = { from: string; to: string };
const CARD_GRADS: GradDef[] = [
  { from: "#a78bfa", to: "#c084fc" },
  { from: "#e879f9", to: "#f0abfc" },
  { from: "#f472b6", to: "#fb7185" },
  { from: "#34d399", to: "#6ee7b7" },
];

function StatCard({ title, value, unit = "", icon, gradIdx = 0, delay = 0, ready = true }: {
  title: string; value: number; unit?: string;
  icon: React.ReactNode; gradIdx?: number; delay?: number; ready?: boolean;
}) {
  const n = useCountUp(value, ready, 1400, delay);
  const display = n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString("zh-CN");
  const g = CARD_GRADS[gradIdx % CARD_GRADS.length];

  return (
    <div className="relative rounded-2xl p-4 flex flex-col justify-between overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.13)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
        animation: `kpiIn 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      }}>
      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${g.from}, ${g.to})` }} />
      {/* Ambient glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${g.from}, transparent)` }} />

      <div className="flex items-center justify-between">
        <span className="text-[16px] font-medium tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>{title}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${g.from}30, ${g.to}20)`, border: `1px solid ${g.from}40` }}>
          <span style={{ color: g.from, width: 18, height: 18, display: "flex" }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-[42px] font-black font-mono tabular-nums leading-none"
          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {display}
        </span>
        {unit && <span className="text-[16px] ml-1" style={{ color: "rgba(255,255,255,0.4)" }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ScreenVideoPlayer
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

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))", border: "1px solid rgba(255,255,255,0.15)" }}>
          <span className="text-3xl">🎬</span>
        </div>
        <div className="text-center">
          <div className="text-[14px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>宣传视频播放区</div>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>暂无视频</div>
        </div>
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
      autoPlay muted playsInline
      loop={videos.length === 1}
      onEnded={() => setIdx(i => i + 1)}
    />
  );
}

/* ════════════════════════════════════════
   DemandList
════════════════════════════════════════ */
const DEMAND_STATUS_GRAD: Record<string, string> = {
  published:          "linear-gradient(90deg,#a78bfa,#c084fc)",
  matched:            "linear-gradient(90deg,#e879f9,#f0abfc)",
  in_progress:        "linear-gradient(90deg,#f472b6,#fb7185)",
  pending_acceptance: "linear-gradient(90deg,#fbbf24,#fde68a)",
  completed:          "linear-gradient(90deg,#34d399,#6ee7b7)",
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
    <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>暂无需求</div>
  );

  return (
    <div className="flex-1 overflow-hidden relative min-h-0">
      <div className="absolute top-0 inset-x-0 h-6 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(40,10,80,0.7), transparent)" }} />
      <div className="absolute bottom-0 inset-x-0 h-6 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(40,10,80,0.7), transparent)" }} />

      <div ref={trackRef} style={{ animation: `feedScroll ${duration}s linear infinite` }}>
        {doubled.map((item, i) => {
          const grad = DEMAND_STATUS_GRAD[item.status] ?? "linear-gradient(90deg,#94a3b8,#cbd5e1)";
          return (
            <div key={i} className="flex items-center gap-2 py-1.5 px-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-[13px] font-bold shrink-0 w-12 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{item.publisher}</span>
              <span className="flex-1 text-[13px] truncate min-w-0" style={{ color: "rgba(255,255,255,0.8)" }}>{item.title}</span>
              <span className="text-[11px] font-bold shrink-0 whitespace-nowrap" style={{ color: "#fbbf24" }}>{item.budget}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap text-white"
                style={{ background: grad }}>{item.statusLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   TrendChart
════════════════════════════════════════ */
function niceAxisDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
  const step = magnitude >= 1 ? magnitude : 1;
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

function TrendChart({ data }: { data: ScreenData["cumulativeSeries"] }) {
  const chartData = data.map(d => ({ date: d.label || d.date, opc: d.totalOpc, publisher: d.totalPublisher }));
  const opcDomain = niceAxisDomain(chartData.map(d => d.opc));
  const pubDomain = niceAxisDomain(chartData.map(d => d.publisher));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gOpc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gPub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f472b6" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.25)" fontSize={14} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <YAxis yAxisId="left" orientation="left" stroke="#a78bfa" fontSize={13} tickLine={false}
          axisLine={{ stroke: "#a78bfa", strokeOpacity: 0.3 }} allowDecimals={false} domain={opcDomain} tickCount={5} tick={{ fill: "#a78bfa" }} />
        <YAxis yAxisId="right" orientation="right" stroke="#f472b6" fontSize={13} tickLine={false}
          axisLine={{ stroke: "#f472b6", strokeOpacity: 0.3 }} allowDecimals={false} domain={pubDomain} tickCount={5} tick={{ fill: "#f472b6" }} />
        <Tooltip
          contentStyle={{ backgroundColor: "rgba(30,8,70,0.95)", borderColor: "rgba(192,132,252,0.4)", color: "#f1f5f9", borderRadius: 10 }}
          itemStyle={{ fontSize: 16, fontWeight: "bold" }}
          labelStyle={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}
        />
        <Legend verticalAlign="top" height={36} iconType="diamond"
          formatter={(v) => <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 17 }}>{v}</span>} />
        <Area yAxisId="left" type="monotone" name="OPC 累计" dataKey="opc" stroke="#a78bfa" strokeWidth={2.5} fillOpacity={1} fill="url(#gOpc)"
          dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#a78bfa", stroke: "#fff", strokeWidth: 2 }} />
        <Area yAxisId="right" type="monotone" name="发单方累计" dataKey="publisher" stroke="#f472b6" strokeWidth={2.5} fillOpacity={1} fill="url(#gPub)"
          dot={{ r: 3, fill: "#f472b6", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#f472b6", stroke: "#fff", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════
   TodayStats
════════════════════════════════════════ */
function TodayStats({ newUsers, newDemands, newOrders }: { newUsers: number; newDemands: number; newOrders: number }) {
  const items = [
    { label: "今日新用户", value: newUsers,   icon: "👤", grad: "linear-gradient(90deg,#a78bfa,#c084fc)" },
    { label: "今日新需求", value: newDemands, icon: "📋", grad: "linear-gradient(90deg,#e879f9,#f0abfc)" },
    { label: "今日新订单", value: newOrders,  icon: "🤝", grad: "linear-gradient(90deg,#f472b6,#fb7185)" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5 h-full">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl flex items-center justify-between px-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{item.icon}</span>
            <span className="text-[15px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{item.label}</span>
          </div>
          <span className="text-[28px] font-black font-mono tabular-nums leading-none"
            style={{ background: item.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {item.value > 0 ? `+${item.value}` : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   ProgressBars
════════════════════════════════════════ */
const STATUS_GRAD: Record<string, string> = {
  published:          "linear-gradient(90deg,#a78bfa,#c084fc)",
  matched:            "linear-gradient(90deg,#e879f9,#f0abfc)",
  in_progress:        "linear-gradient(90deg,#f472b6,#fb7185)",
  pending_acceptance: "linear-gradient(90deg,#fbbf24,#fde68a)",
  completed:          "linear-gradient(90deg,#34d399,#6ee7b7)",
};

function ProgressBars({ data, total }: { data: ScreenData["demandStatusChart"]; total: number }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 justify-between w-full px-1">
      {data.map((item, i) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        const grad = STATUS_GRAD[item.status] ?? "linear-gradient(90deg,#94a3b8,#cbd5e1)";
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[14px] w-16 text-right font-medium shrink-0" style={{ color: "rgba(255,255,255,0.6)" }}>{item.label}</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${pct === 0 ? 2 : pct}%`, background: grad }} />
            </div>
            <div className="w-20 flex items-center justify-between text-[13px] font-mono shrink-0"
              style={{ color: "rgba(255,255,255,0.5)" }}>
              <span className="font-bold">{item.value}</span>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>({pct}%)</span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between items-center pt-1 text-[13px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ color: "rgba(255,255,255,0.35)" }}>需求总计</span>
        <span className="font-bold" style={{ background: "linear-gradient(90deg,#c084fc,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{total} 条</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   OrderTypeChart
════════════════════════════════════════ */
const ORDER_TYPE_COLORS = ["#a78bfa", "#f472b6", "#fbbf24", "#34d399", "rgba(255,255,255,0.3)"];

function OrderTypeChart({ data }: { data: ScreenData["orderTypeChart"] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const pieData = data.filter(d => d.value > 0);

  return (
    <div className="flex-1 min-h-0 flex items-stretch gap-3 px-1">
      <div className="flex-[3] min-w-0 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData.length ? pieData : [{ label: "暂无", value: 1 }]}
              dataKey="value" nameKey="label"
              cx="50%" cy="50%" innerRadius="40%" outerRadius="72%"
              paddingAngle={3} strokeWidth={0}
            >
              {(pieData.length ? pieData : [{ label: "暂无", value: 1 }]).map((_, i) => (
                <Cell key={i} fill={pieData.length ? ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length] : "rgba(255,255,255,0.08)"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(30,8,70,0.95)", borderColor: "rgba(192,132,252,0.4)", color: "#f1f5f9", borderRadius: 10 }}
              itemStyle={{ fontSize: 14, fontWeight: "bold" }}
              formatter={(value: number) => [`${value} 单`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="self-stretch w-px my-3 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className="flex-[2] flex flex-col justify-center gap-2 py-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length], boxShadow: `0 0 6px ${ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length]}` }} />
              <span className="text-[13px] truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{item.label}</span>
            </div>
            <span className="text-[15px] font-black font-mono tabular-nums shrink-0"
              style={{ color: ORDER_TYPE_COLORS[i % ORDER_TYPE_COLORS.length] }}>
              {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Ticker
════════════════════════════════════════ */
function Ticker({ items, grad, label }: { items: { text: string }[]; grad: string; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sep = "　｜　";
  const raw = items.map(i => i.text).join(sep);
  const doubled = raw ? raw + sep + raw : "";

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !doubled) return;
    const dur = el.scrollWidth / 2 / 60;
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = `tickerScroll ${dur}s linear infinite`;
  }, [doubled]);

  if (!items.length) return null;

  return (
    <div className="flex items-center h-9 overflow-hidden shrink-0"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
      <div className="shrink-0 text-[13px] font-bold px-5 whitespace-nowrap"
        style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {label}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute left-0 inset-y-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(30,8,70,0.8), transparent)" }} />
        <div className="absolute right-0 inset-y-0 w-8 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(30,8,70,0.8), transparent)" }} />
        <div ref={trackRef} className="inline-block whitespace-nowrap text-[15px] font-semibold py-2"
          style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
  const color = n <= 10 ? "#fbbf24" : "#a78bfa";
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
    { title: "平台总用户",   value: kpi?.totalUsers ?? 0,      icon: <Users className="w-full h-full" />,    gradIdx: 0, delay: 0   },
    { title: "OPC 数量",     value: kpi?.opcCount ?? 0,         icon: <Users className="w-full h-full" />,    gradIdx: 1, delay: 50  },
    { title: "发单企业",     value: kpi?.publisherCount ?? 0,   icon: <FileText className="w-full h-full" />, gradIdx: 2, delay: 100 },
    { title: "已发布需求",   value: kpi?.publishedDemands ?? 0, icon: <FileText className="w-full h-full" />, gradIdx: 3, delay: 150 },
  ];

  return (
    <>
      <style>{KF}</style>
      <div
        className="flex flex-col font-sans relative"
        style={{
          background: "linear-gradient(135deg, #1e0845 0%, #3b1080 25%, #5b1888 45%, #7d1060 70%, #4a0828 90%, #200510 100%)",
          width: "100vw", height: "100vh", overflow: "hidden", color: "white",
          fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','微软雅黑','SimHei','STHeiti','Noto Sans SC',system-ui,sans-serif"
        }}
      >
        {/* ── Ambient orbs ─────────────────────────── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute rounded-full"
            style={{ width: 600, height: 600, top: "-10%", left: "-5%", background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)", animation: "orb1 18s ease-in-out infinite" }} />
          <div className="absolute rounded-full"
            style={{ width: 500, height: 500, bottom: "-10%", right: "-5%", background: "radial-gradient(circle, rgba(236,72,153,0.16) 0%, transparent 65%)", animation: "orb2 22s ease-in-out infinite" }} />
          <div className="absolute rounded-full"
            style={{ width: 350, height: 350, top: "35%", right: "30%", background: "radial-gradient(circle, rgba(192,38,211,0.12) 0%, transparent 65%)", animation: "orb3 16s ease-in-out infinite" }} />
          {/* Top-center highlight, brand poster style */}
          <div className="absolute"
            style={{ top: 0, left: "15%", right: "15%", height: 280, background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.2), transparent 70%)" }} />
        </div>

        {/* ── Main layout ──────────────────────────── */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-[1920px] mx-auto">

          <Header />

          {/* Countdown */}
          <div className="absolute top-3 right-8 flex items-center gap-2 z-20">
            <CountdownRing n={countdown} total={REFRESH_SEC} />
          </div>

          {/* ── Main content ─────────────────────── */}
          <div ref={contentRef} className="flex-1 min-h-0 flex gap-3 px-6 pb-2">

            {/* Left column */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">

              {/* KPI row */}
              <div className="grid grid-cols-4 gap-3 shrink-0" style={{ height: 140 }}>
                {kpiCards.map((s, i) => (
                  <StatCard key={i} {...s} ready={ready} />
                ))}
              </div>

              {/* Trend chart */}
              <Panel title="近14天增长趋势" className="flex-[5.5] min-h-0">
                {data?.cumulativeSeries?.length
                  ? <TrendChart data={data.cumulativeSeries} />
                  : <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>加载中…</div>
                }
              </Panel>

              {/* Bottom section */}
              <div className="flex-[4.5] min-h-0 flex gap-3">

                {/* Demand list */}
                <Panel title="近期需求" className="flex-[5.5] min-h-0 min-w-0 overflow-hidden">
                  {data
                    ? <DemandList items={data.demandList ?? []} />
                    : <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>加载中…</div>
                  }
                </Panel>

                {/* Order type pie */}
                <Panel title="订单占比" className="flex-[4] min-w-0">
                  {data?.orderTypeChart
                    ? <OrderTypeChart data={data.orderTypeChart} />
                    : <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>加载中…</div>
                  }
                </Panel>

                {/* QR code */}
                <Panel className="flex-[1.8] min-w-0 min-h-0">
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <span className="text-[11px] tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>扫码联系客服</span>
                    <div className="p-1.5 rounded-xl bg-white"
                      style={{ boxShadow: "0 0 20px rgba(168,85,247,0.6)" }}>
                      <img
                        src={`${BASE}/qrcode.jpg`}
                        alt="客服二维码"
                        className="block rounded-lg"
                        style={{ width: 88, height: 88, objectFit: "cover" }}
                      />
                    </div>
                    <span className="text-[15px] font-bold text-center leading-tight"
                      style={{ background: "linear-gradient(135deg,#c084fc,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      www.opcorder.com
                    </span>
                  </div>
                </Panel>

              </div>
            </div>

            {/* Right video column */}
            <div className="shrink-0 flex flex-col min-h-0" style={{ width: demandColWidth > 0 ? demandColWidth : undefined }}>
              <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
                }}>
                <ScreenVideoPlayer />
              </div>
            </div>

          </div>

          {/* ── Tickers ──────────────────────────── */}
          <div className="shrink-0 z-10">
            <Ticker items={data?.ticker1 ?? []} grad="linear-gradient(90deg,#c084fc,#e879f9,#f472b6)" label="👥 用户动态" />
            <Ticker items={data?.ticker2 ?? []} grad="linear-gradient(90deg,#fbbf24,#fb923c)" label="📢 平台信息" />
          </div>

        </div>
      </div>
    </>
  );
}
