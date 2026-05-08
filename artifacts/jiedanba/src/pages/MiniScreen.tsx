import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getValidAccessToken, clearSession } from "@/lib/auth";
import { format } from "date-fns";

type ScreenData = {
  kpi: {
    totalUsers: number; opcCount: number; publisherCount: number;
    publishedDemands: number; inProgressOrders: number; completedOrders: number;
    completionRate: number; totalSettled: number;
  };
  timeSeries: { date: string; label: string; newUsers: number; newDemands: number; newOrders: number }[];
  demandStatusChart: { status: string; label: string; value: number }[];
  ticker1: { text: string }[];
  ticker2: { text: string }[];
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SLIDE_DURATION = 8000;
const SLIDE_COUNT = 5;

const FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','微软雅黑','SimHei','STHeiti','Noto Sans SC',system-ui,sans-serif";
const MONO = "'Courier New',Courier,'Microsoft YaHei UI','Microsoft YaHei',monospace";

const ANIM_CSS = `
@keyframes msLiveDot { 0%,100%{opacity:1} 50%{opacity:0.25} }
@keyframes msPulse { 0%,100%{box-shadow:0 0 6px #10b981} 50%{box-shadow:0 0 12px #10b981,0 0 20px #10b981} }
`;

async function fetchScreen(): Promise<ScreenData> {
  const token = await getValidAccessToken(BASE);
  if (!token) { clearSession(); window.location.href = `${BASE}/login`; throw new Error("未登录"); }
  const r = await fetch(`${BASE}/api/screen`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) { clearSession(); window.location.href = `${BASE}/login`; throw new Error("登录已过期"); }
  if (!r.ok) throw new Error("数据加载失败");
  return r.json();
}

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString("zh-CN");
}

function useCountUp(target: number, ready: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const start = Date.now();
    const dur = 1100;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, ready]);
  return v;
}

/* ── KPI Card ── */
function KpiCard({ label, value, color, ready }: { label: string; value: number; color: string; ready: boolean }) {
  const n = useCountUp(value, ready);
  return (
    <div style={{
      flex: 1, border: `1px solid ${color}44`, borderRadius: 8,
      padding: "10px 12px", background: `${color}0e`,
      boxShadow: `inset 0 0 14px ${color}1a, 0 0 8px ${color}11`,
      display: "flex", flexDirection: "column", gap: 5, alignItems: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.7 }} />
      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT, letterSpacing: "0.05em", textAlign: "center", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 34, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1, textShadow: `0 0 14px ${color}` }}>
        {fmtNum(n)}
      </span>
    </div>
  );
}

/* ── Completion Ring ── */
function CompletionRing({ rate }: { rate: number }) {
  const r = 44, c2 = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
      <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={55} cy={55} r={r} fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth={9} />
        <circle cx={55} cy={55} r={r} fill="none" stroke="#10b981"
          strokeWidth={9} strokeDasharray={c2} strokeDashoffset={c2 * (1 - rate / 100)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.3s ease", filter: "drop-shadow(0 0 5px #10b981)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: "#34d399", fontFamily: MONO, textShadow: "0 0 12px #10b981" }}>{rate}%</span>
      </div>
    </div>
  );
}

/* ── Vertical Live Feed ── */
function LiveFeedMini({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const all = useMemo(() => items.length ? [...items, ...items] : ["暂无动态", "暂无动态"], [items]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pos = 0, raf: number;
    const step = () => {
      const half = el.scrollHeight / 2;
      pos += 0.55;
      if (pos >= half) pos -= half;
      el.style.transform = `translateY(-${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  return (
    <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
      <div style={{ position: "absolute", top: 0, inset: "0 0 auto", height: 24, background: "linear-gradient(to bottom,#040b17,transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, inset: "auto 0 0", height: 24, background: "linear-gradient(to top,#040b17,transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 7, padding: "6px 2px" }}>
        {all.map((text, i) => (
          <div key={i} style={{
            fontSize: 11, color: "#67e8f9", fontFamily: FONT, lineHeight: 1.45,
            padding: "7px 9px", background: "rgba(6,182,212,0.06)", borderRadius: 6,
            border: "1px solid rgba(6,182,212,0.2)", flexShrink: 0,
          }}>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Horizontal Ticker ── */
function TickerMini({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const text = items.length ? items.map(t => `◆  ${t}`).join("    ") : "接单吧 · OPC 撮合交易平台";
  const doubled = `${text}      ${text}`;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pos = 0, raf: number;
    const step = () => {
      const half = el.scrollWidth / 2;
      pos += 0.45;
      if (pos >= half) pos -= half;
      el.style.transform = `translateX(-${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  return (
    <div style={{ flexShrink: 0, overflow: "hidden", background: "rgba(6,182,212,0.06)", borderTop: "1px solid rgba(6,182,212,0.15)", padding: "5px 0" }}>
      <div ref={ref} style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 10, color: "#67e8f9", fontFamily: FONT, letterSpacing: "0.02em" }}>
        {doubled}
      </div>
    </div>
  );
}

/* ── Section Title ── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginBottom: 8 }}>
      <div style={{ width: 3, height: 16, background: "#06b6d4", borderRadius: 2, boxShadow: "0 0 8px rgba(6,182,212,0.8)" }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#67e8f9", fontFamily: FONT, letterSpacing: "0.08em" }}>{children}</span>
    </div>
  );
}

/* ════════════════════════════════════════
   Main MiniScreen Page
   Optimised for 246 × 466 portrait display
════════════════════════════════════════ */
export default function MiniScreen() {
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setSlide(s => (s + 1) % SLIDE_COUNT); setVisible(true); }, 380);
    }, SLIDE_DURATION);
    return () => clearInterval(t);
  }, []);

  const { data } = useQuery<ScreenData>({
    queryKey: ["screen-mini"], queryFn: fetchScreen,
    refetchInterval: 60_000, staleTime: 0,
  });

  const ready = !!data;
  const kpi = data?.kpi;

  const today = useMemo(() => {
    if (!data?.timeSeries?.length) return { newUsers: 0, newDemands: 0, newOrders: 0 };
    return data.timeSeries[data.timeSeries.length - 1];
  }, [data]);

  const allFeed = useMemo(() => [
    ...(data?.ticker1 ?? []).map(t => t.text),
    ...(data?.ticker2 ?? []).map(t => t.text),
  ].sort(() => Math.random() - 0.5), [data]);

  const totalDemands = useMemo(() =>
    (data?.demandStatusChart ?? []).reduce((s, d) => s + d.value, 0), [data]);

  const slides: React.ReactNode[] = [
    /* ─── Slide 0: 平台概览 ─── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8 }}>
      <SectionTitle>平台概览</SectionTitle>
      <KpiCard label="平台总用户" value={kpi?.totalUsers ?? 0} color="#06b6d4" ready={ready} />
      <KpiCard label="OPC 数量" value={kpi?.opcCount ?? 0} color="#3b82f6" ready={ready} />
      <KpiCard label="发单企业" value={kpi?.publisherCount ?? 0} color="#a855f7" ready={ready} />
    </div>,

    /* ─── Slide 1: 需求与订单 ─── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8 }}>
      <SectionTitle>需求与订单</SectionTitle>
      <KpiCard label="已发布需求" value={kpi?.publishedDemands ?? 0} color="#06b6d4" ready={ready} />
      <KpiCard label="进行中订单" value={kpi?.inProgressOrders ?? 0} color="#f59e0b" ready={ready} />
      <KpiCard label="已完成订单" value={kpi?.completedOrders ?? 0} color="#10b981" ready={ready} />
    </div>,

    /* ─── Slide 2: 完成率 & 结算 ─── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <SectionTitle>完成率与结算</SectionTitle>
      <CompletionRing rate={kpi?.completionRate ?? 0} />
      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>订单完成率</span>
      <div style={{
        width: "100%", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10,
        padding: "14px 0", background: "rgba(245,158,11,0.07)", textAlign: "center",
        boxShadow: "inset 0 0 20px rgba(245,158,11,0.08)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#f59e0b", opacity: 0.8 }} />
        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT, display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>累计结算</span>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
          <span style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", fontFamily: MONO, textShadow: "0 0 18px rgba(245,158,11,0.9)" }}>
            {fmtNum(kpi?.totalSettled ?? 0)}
          </span>
          <span style={{ fontSize: 16, color: "#e2e8f0", fontFamily: FONT }}>元</span>
        </div>
      </div>
    </div>,

    /* ─── Slide 3: 今日数据 ─── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 10 }}>
      <SectionTitle>今日数据</SectionTitle>
      <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, marginBottom: 4 }}>
        {format(time, "yyyy年 MM月dd日")}
      </div>
      {[
        { label: "新用户", value: today.newUsers, color: "#06b6d4", icon: "👤" },
        { label: "新需求", value: today.newDemands, color: "#2dd4bf", icon: "📋" },
        { label: "新订单", value: today.newOrders, color: "#10b981", icon: "🤝" },
      ].map((item, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: 8,
          border: `1px solid ${item.color}33`, background: `${item.color}0e`,
          flex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", fontFamily: FONT }}>{item.label}</span>
          </div>
          <span style={{ fontSize: 30, fontWeight: 900, color: item.color, fontFamily: MONO, textShadow: `0 0 10px ${item.color}` }}>
            {item.value > 0 ? `+${item.value}` : item.value}
          </span>
        </div>
      ))}
    </div>,

    /* ─── Slide 4: 实时动态 ─── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginBottom: 4 }}>
        <div style={{ width: 3, height: 16, background: "#06b6d4", borderRadius: 2, boxShadow: "0 0 8px rgba(6,182,212,0.8)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#67e8f9", fontFamily: FONT, letterSpacing: "0.08em" }}>实时动态</span>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #10b981", animation: "msLiveDot 2s ease-in-out infinite", marginLeft: 2 }} />
        <span style={{ fontSize: 9, color: "#34d399", fontFamily: FONT }}>LIVE</span>
      </div>
      <LiveFeedMini items={allFeed} />
    </div>,
  ];

  const slideLabels = ["平台概览", "需求订单", "完成结算", "今日数据", "实时动态"];
  const allTickerItems = [...(data?.ticker1 ?? []), ...(data?.ticker2 ?? [])].map(t => t.text);

  return (
    <>
      <style>{ANIM_CSS}</style>
      <div style={{
        width: "100vw", height: "100vh", overflow: "hidden",
        background: "linear-gradient(160deg, #040b17 0%, #060f1e 55%, #040c18 100%)",
        fontFamily: FONT,
        display: "flex", flexDirection: "column",
        color: "#e2e8f0",
        position: "relative",
      }}>
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* ─── HEADER ─── */}
        <div style={{
          padding: "8px 10px 7px", borderBottom: "1px solid rgba(6,182,212,0.2)",
          flexShrink: 0, background: "rgba(4,11,23,0.85)",
          backdropFilter: "blur(4px)", position: "relative", zIndex: 10,
        }}>
          <div style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: 1.5, background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.95),transparent)", boxShadow: "0 0 10px rgba(6,182,212,0.8)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontSize: 18, fontWeight: 900, letterSpacing: "0.04em",
              background: "linear-gradient(135deg,#67e8f9,#818cf8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>接单吧</span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: MONO, letterSpacing: "0.04em" }}>
              {format(time, "HH:mm:ss")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 10, color: "#67e8f9", letterSpacing: "0.06em", fontFamily: FONT }}>数据大屏</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "msLiveDot 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 9, color: "#34d399", fontFamily: FONT }}>运行正常</span>
            </div>
          </div>
        </div>

        {/* ─── SLIDE CONTENT ─── */}
        <div style={{
          flex: 1, minHeight: 0, padding: "10px 10px 8px",
          display: "flex", flexDirection: "column",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.38s ease",
          position: "relative", zIndex: 5,
        }}>
          {slides[slide]}
        </div>

        {/* ─── SLIDE INDICATOR BAR ─── */}
        <div style={{
          flexShrink: 0, background: "rgba(4,11,23,0.7)",
          borderTop: "1px solid rgba(6,182,212,0.1)",
          padding: "7px 10px 6px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", zIndex: 10,
        }}>
          {/* Dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setVisible(false); setTimeout(() => { setSlide(i); setVisible(true); }, 320); }}
                style={{
                  width: i === slide ? 18 : 6, height: 6, borderRadius: 3,
                  border: "none", cursor: "pointer", padding: 0,
                  transition: "all 0.3s ease",
                  background: i === slide ? "#06b6d4" : "rgba(100,116,139,0.45)",
                  boxShadow: i === slide ? "0 0 8px rgba(6,182,212,0.9)" : undefined,
                }}
              />
            ))}
          </div>
          {/* Current slide label */}
          <span style={{ fontSize: 9, color: "#64748b", fontFamily: FONT, letterSpacing: "0.05em" }}>
            {slideLabels[slide]} {slide + 1}/{SLIDE_COUNT}
          </span>
        </div>

        {/* ─── BOTTOM TICKER ─── */}
        <TickerMini items={allTickerItems} />
      </div>
    </>
  );
}
