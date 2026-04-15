import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ─── Types ─────────────────────────────────────── */

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

/* ─── Config ─────────────────────────────────────── */

const BASE   = import.meta.env.BASE_URL.replace(/\/$/, "");
const CYAN   = "#00d4ff";
const GREEN  = "#00ff9d";
const PURPLE = "#a855f7";
const AMBER  = "#f59e0b";
const PIE_COLORS = [CYAN, GREEN, PURPLE, AMBER, "#f43f5e"];
const REFRESH_SEC = 60;

/* ─── Fetch ─────────────────────────────────────── */

async function fetchScreen(): Promise<ScreenData> {
  const r = await fetch(`${BASE}/api/screen`);
  if (!r.ok) throw new Error("数据加载失败");
  return r.json();
}

/* ─── Scrolling ticker ──────────────────────────── */

function Ticker({ items, speed = 80, color = CYAN }: {
  items: { text: string }[]; speed?: number; color?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const text = items.length ? items.map(i => `◆  ${i.text}`).join("      ") : "暂无数据";
  const doubled = `${text}      ${text}`;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const totalWidth = el.scrollWidth / 2;
    let pos = 0;
    let raf: number;
    const step = () => {
      pos += speed / 60;
      if (pos >= totalWidth) pos -= totalWidth;
      el.style.transform = `translateX(-${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items, speed]);

  return (
    <div style={{ overflow: "hidden", width: "100%", whiteSpace: "nowrap" }}>
      <div ref={trackRef} style={{ display: "inline-block", color, fontSize: 13, fontWeight: 700, letterSpacing: "0.03em" }}>
        {doubled}
      </div>
    </div>
  );
}

/* ─── KPI card ───────────────────────────────────── */

function KpiCard({ label, value, unit = "", accent = CYAN, icon }: {
  label: string; value: string | number; unit?: string;
  accent?: string; icon: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: `linear-gradient(135deg, rgba(${hexToRgb(accent)},0.08) 0%, rgba(3,9,24,0.6) 100%)`,
      border: `1px solid rgba(${hexToRgb(accent)},0.35)`,
      borderRadius: 14,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 6,
      boxShadow: `0 0 18px rgba(${hexToRgb(accent)},0.12)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 10, right: 14, fontSize: 22, opacity: 0.18 }}>{icon}</div>
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontSize: 32, fontWeight: 900, color: accent,
          textShadow: `0 0 20px rgba(${hexToRgb(accent)},0.6)`,
          lineHeight: 1, fontVariantNumeric: "tabular-nums",
        }}>
          {typeof value === "number" ? value.toLocaleString("zh-CN") : value}
        </span>
        {unit && <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/* ─── Chart tooltip ─────────────────────────────── */

const chartTooltipStyle = {
  backgroundColor: "#0d1b2e",
  border: "1px solid rgba(0,212,255,0.3)",
  borderRadius: 8,
  color: "#e0f2fe",
  fontSize: 12,
};

/* ─── Live clock ──────────────────────────────────── */

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", color: "#cbd5e1", fontSize: 14, fontWeight: 600 }}>
      {now.toLocaleString("zh-CN", { hour12: false })}
    </span>
  );
}

/* ─── Main page ─────────────────────────────────── */

export default function ScreenDisplay() {
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data, dataUpdatedAt } = useQuery<ScreenData>({
    queryKey: ["screen"],
    queryFn: fetchScreen,
    refetchInterval: REFRESH_SEC * 1000,
    staleTime: 0,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  useEffect(() => {
    setCountdown(REFRESH_SEC);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return REFRESH_SEC;
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  const kpi = data?.kpi;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at 20% 50%, #041126 0%, #030918 60%, #010610 100%)",
      color: "#e0f2fe",
      display: "flex", flexDirection: "column",
      overflow: "hidden", fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      position: "relative",
    }}>
      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        zIndex: 0,
      }} />

      {/* Header */}
      <header style={{
        zIndex: 1, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 28px",
        background: "linear-gradient(180deg, rgba(0,212,255,0.08) 0%, transparent 100%)",
        borderBottom: "1px solid rgba(0,212,255,0.15)",
      }}>
        {/* Left: logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, ${CYAN}, ${GREEN})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#030918",
            boxShadow: `0 0 18px rgba(0,212,255,0.5)`,
          }}>接</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.06em", color: "#fff" }}>
              接单吧  <span style={{ color: CYAN }}>OPC平台</span>  数据大屏
            </div>
            <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginTop: 1 }}>
              JieDanBa · OPC Matching Platform · Real-time Dashboard
            </div>
          </div>
        </div>

        {/* Right: time + refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <LiveClock />
            {lastUpdated && (
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                数据更新: {lastUpdated.toLocaleTimeString("zh-CN", { hour12: false })}
                <span style={{ marginLeft: 8, color: countdown <= 10 ? "#f59e0b" : "#334155" }}>
                  {countdown}s后刷新
                </span>
              </div>
            )}
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: `2px solid rgba(0,212,255,0.3)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: CYAN,
            boxShadow: `0 0 12px rgba(0,212,255,0.2)`,
          }}>
            {countdown}s
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <div style={{
        zIndex: 1, flexShrink: 0,
        display: "flex", gap: 10, padding: "10px 28px",
      }}>
        <KpiCard label="平台总用户"   value={kpi?.totalUsers ?? "—"}       icon="👥" accent={CYAN} />
        <KpiCard label="OPC 数量"     value={kpi?.opcCount ?? "—"}          icon="🎯" accent={GREEN} />
        <KpiCard label="发单方"       value={kpi?.publisherCount ?? "—"}    icon="🏢" accent={PURPLE} />
        <KpiCard label="已发布需求"   value={kpi?.publishedDemands ?? "—"}  icon="📋" accent={AMBER} />
        <KpiCard label="进行中订单"   value={kpi?.inProgressOrders ?? "—"}  icon="⚡" accent={CYAN} />
        <KpiCard label="已完成订单"   value={kpi?.completedOrders ?? "—"}   icon="✅" accent={GREEN} />
        <KpiCard label="订单完成率"   value={kpi ? `${kpi.completionRate}` : "—"} unit="%" icon="📈" accent={PURPLE} />
        <KpiCard
          label="平台累计结算"
          value={kpi ? (kpi.totalSettled >= 10000 ? `${(kpi.totalSettled / 10000).toFixed(1)}万` : kpi.totalSettled) : "—"}
          unit="元"
          icon="💰"
          accent={AMBER}
        />
      </div>

      {/* Charts Row */}
      <div style={{
        zIndex: 1, flex: 1, minHeight: 0,
        display: "flex", gap: 10, padding: "0 28px",
      }}>
        {/* Line chart: 14-day trend */}
        <div style={{ flex: 5, ...chartCard() }}>
          <ChartTitle>近 14 天平台增长趋势</ChartTitle>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.timeSeries ?? []} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: CYAN }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 4 }} />
              <Line type="monotone" dataKey="newUsers"   name="新增用户"   stroke={CYAN}   strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="newDemands" name="新增需求"   stroke={GREEN}  strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="newOrders"  name="新增订单"   stroke={PURPLE} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart: demand status */}
        <div style={{ flex: 4, ...chartCard() }}>
          <ChartTitle>需求状态分布</ChartTitle>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.demandStatusChart ?? []} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(0,212,255,0.05)" }} />
              <Bar dataKey="value" name="需求数" radius={[4, 4, 0, 0]}>
                {(data?.demandStatusChart ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: user role distribution */}
        <div style={{ flex: 3, ...chartCard() }}>
          <ChartTitle>用户角色分布</ChartTitle>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data?.userRoleChart ?? []}
                dataKey="value" nameKey="label"
                cx="50%" cy="45%"
                innerRadius="38%" outerRadius="62%"
                paddingAngle={4}
              >
                {(data?.userRoleChart ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [v.toLocaleString(), "人数"]} />
              <Legend
                wrapperStyle={{ fontSize: 13, color: "#94a3b8", paddingTop: 4 }}
                formatter={(value, entry: { payload?: { value: number } }) => (
                  <span style={{ color: "#cbd5e1" }}>
                    {value} <span style={{ color: "#64748b" }}>({entry.payload?.value ?? 0}人)</span>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tickers */}
      <div style={{
        zIndex: 1, flexShrink: 0,
        borderTop: "1px solid rgba(0,212,255,0.1)",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          padding: "7px 0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,212,255,0.04)",
        }}>
          <div style={{
            flexShrink: 0, padding: "0 14px 0 28px",
            fontSize: 11, fontWeight: 800, color: CYAN,
            letterSpacing: "0.08em", whiteSpace: "nowrap",
          }}>
            🎉 动态
          </div>
          <Ticker items={data?.ticker1 ?? []} color={CYAN} speed={60} />
        </div>
        <div style={{
          display: "flex", alignItems: "center",
          padding: "7px 0",
          background: "rgba(0,255,157,0.03)",
        }}>
          <div style={{
            flexShrink: 0, padding: "0 14px 0 28px",
            fontSize: 11, fontWeight: 800, color: GREEN,
            letterSpacing: "0.08em", whiteSpace: "nowrap",
          }}>
            🏆 喜报
          </div>
          <Ticker items={data?.ticker2 ?? []} color={GREEN} speed={50} />
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────── */

function chartCard(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(0,212,255,0.12)",
    borderRadius: 14,
    padding: "12px 14px 8px",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
  };
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flexShrink: 0, marginBottom: 6,
      fontSize: 12, fontWeight: 700, color: "#94a3b8",
      letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      {children}
    </div>
  );
}
