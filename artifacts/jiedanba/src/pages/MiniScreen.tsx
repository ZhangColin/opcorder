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
const SLIDE_DURATIONS = [8000, 8000, 8000, 8000, 20000];
const SLIDE_COUNT = 5;

const FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','微软雅黑','SimHei','STHeiti','Noto Sans SC',system-ui,sans-serif";
const MONO = "'Courier New',Courier,'Microsoft YaHei UI','Microsoft YaHei',monospace";

const ANIM_CSS = `
@keyframes msBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }
@keyframes msGlow  { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes msFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
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
    const start = Date.now(), dur = 1100;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, ready]);
  return v;
}

/* ── Big KPI Card ── */
function KpiCard({ label, value, color, ready, delay = 0 }: {
  label: string; value: number; color: string; ready: boolean; delay?: number;
}) {
  const n = useCountUp(value, ready);
  return (
    <div style={{
      flex: 1, borderRadius: 10, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, ${color}14 0%, rgba(4,11,23,0.9) 100%)`,
      border: `1px solid ${color}40`,
      boxShadow: `0 0 20px ${color}18, inset 0 1px 0 rgba(255,255,255,0.04)`,
      display: "flex", alignItems: "stretch",
      animation: `msFadeUp 0.5s ease ${delay}ms both`,
    }}>
      {/* Left accent bar */}
      <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(180deg,${color},${color}60)`, boxShadow: `2px 0 12px ${color}60` }} />
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#64748b", fontFamily: FONT, letterSpacing: "0.06em", lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: 42, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1,
          textShadow: `0 0 20px ${color}`, letterSpacing: "-0.02em" }}>
          {fmtNum(n)}
        </span>
      </div>
      {/* Corner glow */}
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 60, height: 60,
        background: `radial-gradient(circle at bottom right, ${color}20, transparent 70%)`, pointerEvents: "none" }} />
    </div>
  );
}

/* ── Slide Section Title ── */
function SlideTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginBottom: 10,
      paddingBottom: 8, borderBottom: "1px solid rgba(6,182,212,0.15)" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: FONT, letterSpacing: "0.06em" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(6,182,212,0.3),transparent)", marginLeft: 4 }} />
    </div>
  );
}

/* ── Completion Ring ── */
function CompletionRing({ rate }: { rate: number }) {
  const r = 52, c2 = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
      <svg width={130} height={130} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth={10} />
        <circle cx={65} cy={65} r={r} fill="none" stroke="#10b981"
          strokeWidth={10} strokeDasharray={c2} strokeDashoffset={c2 * (1 - rate / 100)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)", filter: "drop-shadow(0 0 6px #10b981)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "#34d399", fontFamily: MONO, textShadow: "0 0 14px #10b981", lineHeight: 1 }}>{rate}%</span>
        <span style={{ fontSize: 9, color: "#64748b", fontFamily: FONT }}>完成率</span>
      </div>
    </div>
  );
}

/* ── Live Feed (Slide 5 — large text) ── */
function LiveFeedMini({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const all = useMemo(() => {
    const src = items.length ? items : ["暂无动态"];
    return [...src, ...src];
  }, [items]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pos = 0, raf: number;
    const step = () => {
      const half = el.scrollHeight / 2;
      pos += 0.38;
      if (pos >= half) pos -= half;
      el.style.transform = `translateY(-${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  const typeColors = ["#06b6d4", "#a78bfa", "#34d399", "#f59e0b", "#f472b6"];

  return (
    <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
      <div style={{ position: "absolute", top: 0, inset: "0 0 auto", height: 28,
        background: "linear-gradient(to bottom,#040b17,transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, inset: "auto 0 0", height: 28,
        background: "linear-gradient(to top,#040b17,transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 2px" }}>
        {all.map((text, i) => {
          const c = typeColors[i % typeColors.length];
          return (
            <div key={i} style={{
              flexShrink: 0, borderRadius: 8, overflow: "hidden",
              background: `linear-gradient(135deg, ${c}10, rgba(4,11,23,0.85))`,
              border: `1px solid ${c}30`,
              display: "flex", alignItems: "stretch",
            }}>
              <div style={{ width: 3, flexShrink: 0, background: c, opacity: 0.85 }} />
              <div style={{ padding: "10px 11px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: c, flexShrink: 0, lineHeight: 1 }}>◆</span>
                <span style={{ fontSize: 13, color: "#cbd5e1", fontFamily: FONT, lineHeight: 1.5 }}>{text}</span>
              </div>
            </div>
          );
        })}
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
      pos += 0.42;
      if (pos >= half) pos -= half;
      el.style.transform = `translateX(-${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  return (
    <div style={{ flexShrink: 0, overflow: "hidden", background: "rgba(6,182,212,0.05)",
      borderTop: "1px solid rgba(6,182,212,0.18)", padding: "5px 0" }}>
      <div ref={ref} style={{ display: "inline-block", whiteSpace: "nowrap",
        fontSize: 11, color: "#67e8f9", fontFamily: FONT, letterSpacing: "0.02em" }}>
        {doubled}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Main MiniScreen — 246 × 466 portrait
════════════════════════════════════════ */
export default function MiniScreen() {
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(new Date());
  const progressRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Per-slide timer + progress bar */
  useEffect(() => {
    setProgress(0);
    const dur = SLIDE_DURATIONS[slide];
    const start = Date.now();

    progressRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / dur, 1));
    }, 80);

    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => { setSlide(s => (s + 1) % SLIDE_COUNT); setVisible(true); }, 380);
    }, dur);

    return () => {
      clearTimeout(t);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [slide]);

  const goTo = (i: number) => {
    if (i === slide) return;
    setVisible(false);
    setTimeout(() => { setSlide(i); setVisible(true); }, 320);
  };

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

  const allTickerItems = [...(data?.ticker1 ?? []), ...(data?.ticker2 ?? [])].map(t => t.text);

  const slideLabels = ["概览", "订单", "完成率", "今日", "动态"];

  const slides: React.ReactNode[] = [

    /* ── Slide 0: 平台概览 ── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8 }}>
      <SlideTitle icon="📊">平台概览</SlideTitle>
      <KpiCard label="平台总用户" value={kpi?.totalUsers ?? 0} color="#06b6d4" ready={ready} delay={0} />
      <KpiCard label="OPC 数量" value={kpi?.opcCount ?? 0} color="#818cf8" ready={ready} delay={80} />
      <KpiCard label="发单企业" value={kpi?.publisherCount ?? 0} color="#a855f7" ready={ready} delay={160} />
    </div>,

    /* ── Slide 1: 需求与订单 ── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8 }}>
      <SlideTitle icon="📋">需求与订单</SlideTitle>
      <KpiCard label="已发布需求" value={kpi?.publishedDemands ?? 0} color="#06b6d4" ready={ready} delay={0} />
      <KpiCard label="进行中订单" value={kpi?.inProgressOrders ?? 0} color="#f59e0b" ready={ready} delay={80} />
      <KpiCard label="已完成订单" value={kpi?.completedOrders ?? 0} color="#10b981" ready={ready} delay={160} />
    </div>,

    /* ── Slide 2: 完成率 & 结算 ── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 14 }}>
      <SlideTitle icon="🎯">完成率与结算</SlideTitle>
      {/* Ring + label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", paddingTop: 8 }}>
        <CompletionRing rate={kpi?.completionRate ?? 0} />
      </div>
      {/* Two stats side by side */}
      <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, borderRadius: 10, border: "1px solid rgba(16,185,129,0.35)",
          background: "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(4,11,23,0.9))",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 4,
          boxShadow: "inset 0 0 16px rgba(16,185,129,0.08)" }}>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>已完成</span>
          <span style={{ fontSize: 30, fontWeight: 900, color: "#34d399", fontFamily: MONO, textShadow: "0 0 12px #10b981" }}>
            {fmtNum(kpi?.completedOrders ?? 0)}
          </span>
        </div>
        <div style={{ flex: 1, borderRadius: 10, border: "1px solid rgba(245,158,11,0.35)",
          background: "linear-gradient(135deg,rgba(245,158,11,0.1),rgba(4,11,23,0.9))",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 4,
          boxShadow: "inset 0 0 16px rgba(245,158,11,0.08)" }}>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>进行中</span>
          <span style={{ fontSize: 30, fontWeight: 900, color: "#fbbf24", fontFamily: MONO, textShadow: "0 0 12px #f59e0b" }}>
            {fmtNum(kpi?.inProgressOrders ?? 0)}
          </span>
        </div>
      </div>
      {/* Settlement */}
      <div style={{ flexShrink: 0, borderRadius: 10, border: "1px solid rgba(251,191,36,0.4)",
        background: "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(4,11,23,0.9))",
        padding: "12px 16px", textAlign: "center", position: "relative", overflow: "hidden",
        boxShadow: "inset 0 0 20px rgba(245,158,11,0.08)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg,transparent,#f59e0b,transparent)" }} />
        <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, marginBottom: 4, letterSpacing: "0.08em" }}>累计结算</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: "#fbbf24", fontFamily: MONO,
            textShadow: "0 0 20px rgba(245,158,11,0.9)", letterSpacing: "-0.02em" }}>
            {fmtNum(kpi?.totalSettled ?? 0)}
          </span>
          <span style={{ fontSize: 18, color: "#94a3b8", fontFamily: FONT }}>元</span>
        </div>
      </div>
    </div>,

    /* ── Slide 3: 今日数据 ── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 10 }}>
      <SlideTitle icon="📅">今日数据</SlideTitle>
      <div style={{ fontSize: 12, color: "#475569", fontFamily: FONT, letterSpacing: "0.04em", flexShrink: 0 }}>
        {format(time, "yyyy年 MM月 dd日")}
      </div>
      {[
        { label: "新增用户", value: today.newUsers, color: "#06b6d4", icon: "👤" },
        { label: "新增需求", value: today.newDemands, color: "#2dd4bf", icon: "📋" },
        { label: "新增订单", value: today.newOrders, color: "#10b981", icon: "🤝" },
      ].map((item, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 10, overflow: "hidden",
          border: `1px solid ${item.color}38`,
          background: `linear-gradient(135deg,${item.color}12,rgba(4,11,23,0.88))`,
          display: "flex", alignItems: "stretch",
        }}>
          <div style={{ width: 4, flexShrink: 0, background: item.color, opacity: 0.8,
            boxShadow: `2px 0 10px ${item.color}70` }} />
          <div style={{ flex: 1, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", fontFamily: FONT }}>{item.label}</span>
            </div>
            <span style={{ fontSize: 36, fontWeight: 900, color: item.color, fontFamily: MONO,
              textShadow: `0 0 14px ${item.color}` }}>
              {item.value > 0 ? `+${item.value}` : item.value}
            </span>
          </div>
        </div>
      ))}
    </div>,

    /* ── Slide 4: 实时动态 ── */
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        paddingBottom: 8, borderBottom: "1px solid rgba(6,182,212,0.15)", marginBottom: 2 }}>
        <span style={{ fontSize: 16 }}>🔴</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: FONT, letterSpacing: "0.06em" }}>实时动态</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399",
          boxShadow: "0 0 10px #10b981", animation: "msBlink 1.8s ease-in-out infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#34d399", fontFamily: FONT, letterSpacing: "0.1em", fontWeight: 700 }}>LIVE</span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(6,182,212,0.3),transparent)", marginLeft: 4 }} />
      </div>
      <LiveFeedMini items={allFeed} />
    </div>,
  ];

  return (
    <>
      <style>{ANIM_CSS}</style>
      <div style={{
        width: "100vw", height: "100vh", overflow: "hidden",
        background: "linear-gradient(160deg,#030910 0%,#050d1b 55%,#030a12 100%)",
        fontFamily: FONT, display: "flex", flexDirection: "column",
        color: "#e2e8f0", position: "relative",
      }}>
        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(6,182,212,0.03)1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.03)1px,transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        {/* Corner orb */}
        <div style={{ position: "absolute", bottom: "10%", right: "-15%", width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(168,85,247,0.06),transparent 70%)", pointerEvents: "none" }} />

        {/* ─── HEADER ─── */}
        <div style={{
          padding: "10px 12px 9px", flexShrink: 0,
          background: "linear-gradient(180deg,rgba(6,182,212,0.06),transparent)",
          borderBottom: "1px solid rgba(6,182,212,0.22)",
          position: "relative", zIndex: 10,
        }}>
          {/* Top glow line */}
          <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1.5,
            background: "linear-gradient(90deg,transparent,#06b6d4,transparent)",
            boxShadow: "0 0 12px rgba(6,182,212,0.9)" }} />
          {/* Row 1 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontSize: 20, fontWeight: 900, letterSpacing: "0.03em",
              background: "linear-gradient(135deg,#67e8f9 30%,#a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>接单吧</span>
            <span style={{ fontSize: 13, color: "#cbd5e1", fontFamily: MONO, letterSpacing: "0.06em",
              textShadow: "0 0 8px rgba(6,182,212,0.5)" }}>
              {format(time, "HH:mm:ss")}
            </span>
          </div>
          {/* Row 2 */}
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#67e8f9", letterSpacing: "0.1em", fontFamily: FONT, opacity: 0.85 }}>
              OPC 撮合交易平台
            </span>
          </div>
        </div>

        {/* ─── SLIDE CONTENT ─── */}
        <div style={{
          flex: 1, minHeight: 0, padding: "12px 12px 8px",
          display: "flex", flexDirection: "column",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.38s ease",
          position: "relative", zIndex: 5,
        }}>
          {slides[slide]}
        </div>

        {/* ─── SLIDE NAV ─── */}
        <div style={{
          flexShrink: 0, background: "rgba(3,9,16,0.8)",
          borderTop: "1px solid rgba(6,182,212,0.12)",
          padding: "6px 12px 7px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                padding: 0, border: "none", cursor: "pointer", borderRadius: 4,
                transition: "all 0.3s ease",
                width: i === slide ? 22 : 7, height: 7,
                background: i === slide ? "#06b6d4" : "rgba(100,116,139,0.35)",
                boxShadow: i === slide ? "0 0 10px rgba(6,182,212,0.9)" : undefined,
              }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Progress bar */}
            <div style={{ width: 42, height: 3, borderRadius: 2, background: "rgba(100,116,139,0.2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress * 100}%`, borderRadius: 2,
                background: "linear-gradient(90deg,#06b6d4,#818cf8)",
                transition: "width 0.08s linear" }} />
            </div>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: FONT }}>
              {slideLabels[slide]} {slide + 1}/{SLIDE_COUNT}
            </span>
          </div>
        </div>

        {/* ─── TICKER ─── */}
        <TickerMini items={allTickerItems} />
      </div>
    </>
  );
}
