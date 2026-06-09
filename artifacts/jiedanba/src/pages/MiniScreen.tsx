import { useState, useEffect, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { getValidAccessToken, clearSession } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: number; title: string; opcNickname: string;
  amount: number; status: string; statusLabel: string; timeAgo: string;
};

type ScreenData = {
  kpi: {
    totalUsers: number; opcCount: number; publisherCount: number;
    publishedDemands: number; inProgressOrders: number; completedOrders: number;
    completionRate: number; totalSettled: number;
  };
  timeSeries: { date: string; label: string; newUsers: number; newDemands: number; newOrders: number }[];
  ticker1: { text: string }[];
  ticker2: { text: string }[];
  recentOrderList: OrderItem[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  cyan:   '#00d4ff',
  purple: '#a78bfa',
  green:  '#22d3a5',
  amber:  '#fbbf24',
  red:    '#f87171',
  blue:   '#60a5fa',
  bg:     '#040d1c',
  card:   '#071525',
  card2:  '#0a1e35',
  border: '#1a3a58',
};

const FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','微软雅黑','SimHei','STHeiti','Noto Sans SC',system-ui,sans-serif";
const MONO = "'Courier New',Courier,'Microsoft YaHei UI','Microsoft YaHei',monospace";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SLIDE_DURATION = 8000;
const SLIDE_COUNT = 4;

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchScreen(): Promise<ScreenData> {
  const token = await getValidAccessToken(BASE);
  if (!token) { clearSession(); window.location.href = `${BASE}/login`; throw new Error("未登录"); }
  const r = await fetch(`${BASE}/api/screen`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) { clearSession(); window.location.href = `${BASE}/login`; throw new Error("登录已过期"); }
  if (!r.ok) throw new Error("数据加载失败");
  return r.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString("zh-CN");
}

function useCounter(target: number, active: boolean, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => {
      const start = Date.now(), dur = 1300;
      const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1);
        setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, active, delay]);
  return val;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <div style={{
        width: 3, height: 14, borderRadius: 2, flexShrink: 0,
        background: `linear-gradient(180deg, ${C.cyan}, #0055aa)`,
        boxShadow: `0 0 8px ${C.cyan}80`,
      }} />
      <span style={{ fontSize: 12, color: '#7bc4dc', letterSpacing: '0.08em', fontWeight: 600, fontFamily: FONT }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.cyan}30, transparent)` }} />
      {sub && <span style={{ fontSize: 9, color: '#2a4a60', fontFamily: FONT }}>{sub}</span>}
    </div>
  );
}

function BigCard({ label, value, unit, color, bg }: {
  label: string; value: string | number; unit?: string; color: string; bg: string;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${color}28`, borderRadius: 10,
      padding: '10px 12px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 18, height: 18,
        borderTop: `2px solid ${color}55`, borderRight: `2px solid ${color}55`, borderRadius: '0 8px 0 0' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 12, height: 12,
        borderBottom: `1px solid ${color}30`, borderLeft: `1px solid ${color}30`, borderRadius: '0 0 0 6px' }} />
      <div style={{ fontSize: 10, color: '#4a7090', marginBottom: 5, letterSpacing: '0.04em', fontFamily: FONT }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 28, color, fontWeight: 700, lineHeight: 1, fontFamily: MONO,
          textShadow: `0 0 18px ${color}70` }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: `${color}90`, fontWeight: 500, fontFamily: FONT }}>{unit}</span>}
      </div>
    </div>
  );
}

function SmallCard({ label, value, unit, color, sub }: {
  label: string; value: string | number; unit?: string; color: string; sub?: string;
}) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${color}22`, borderRadius: 9,
      padding: '9px 10px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
      <div style={{ fontSize: 9, color: '#4a6880', marginBottom: 4, fontFamily: FONT }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: 22, color, fontWeight: 700, lineHeight: 1, fontFamily: MONO,
          textShadow: `0 0 14px ${color}60` }}>{value}</span>
        {unit && <span style={{ fontSize: 9, color: `${color}80`, fontFamily: FONT }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 8, color: '#2a4a60', marginTop: 3, fontFamily: FONT }}>{sub}</div>}
    </div>
  );
}

function AutoScroll({ items, itemHeight, gap = 0, speed = 1, renderItem }: {
  items: unknown[]; itemHeight: number; gap?: number; speed?: number;
  renderItem: (item: unknown, idx: number) => ReactNode;
}) {
  const doubled = [...items, ...items];
  const unitH = itemHeight + gap;
  const totalH = items.length * unitH;
  return (
    <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <motion.div
        animate={{ y: [0, -totalH] }}
        transition={{ duration: items.length * (3.2 / speed), ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
      >
        {doubled.map((item, i) => {
          const isLast = (i + 1) % items.length === 0;
          return (
            <div key={i} style={{ height: isLast ? itemHeight : itemHeight + gap }}>
              {renderItem(item, i % items.length)}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ─── Screen 1: 核心指标 ───────────────────────────────────────────────────────

function Screen1({ kpi, active }: { kpi: ScreenData['kpi'] | undefined; active: boolean }) {
  const users = useCounter(kpi?.totalUsers ?? 0, active, 80);
  const opcs  = useCounter(kpi?.opcCount ?? 0, active, 180);
  const settled = kpi?.totalSettled ?? 0;
  const rate    = kpi?.completionRate ?? 0;

  return (
    <motion.div key="s1"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ height: '100%', padding: '10px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <SectionTitle title="核心指标" sub="数据总览" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <BigCard label="平台用户数" value={users.toLocaleString()} color={C.cyan}
          bg={`linear-gradient(135deg, #0a2040 0%, ${C.card} 100%)`} />
        <BigCard label="OPC 数量" value={opcs.toLocaleString()} color={C.purple}
          bg={`linear-gradient(135deg, #150a30 0%, ${C.card} 100%)`} />
      </div>

      {/* 累计结算 + 完成率 */}
      <div style={{
        background: `linear-gradient(135deg, #0f2a1e 0%, #071516 100%)`,
        border: `1px solid ${C.green}28`, borderRadius: 10,
        padding: '10px 14px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 80, height: 80,
          borderRadius: '50%', background: `${C.green}08`, pointerEvents: 'none' }} />
        <div>
          <div style={{ fontSize: 10, color: '#4a8070', marginBottom: 4, letterSpacing: '0.05em', fontFamily: FONT }}>
            累计结算总额
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: C.green, lineHeight: 1, fontFamily: MONO,
              textShadow: `0 0 20px ${C.green}80` }}>
              {fmtMoney(settled)}
            </span>
            <span style={{ fontSize: 12, color: `${C.green}90`, fontFamily: FONT }}>元</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', paddingRight: 4 }}>
          <div style={{ fontSize: 9, color: '#2a6050', fontFamily: FONT }}>完成率</div>
          <div style={{ fontSize: 22, color: C.green, fontWeight: 700, lineHeight: 1.2, fontFamily: MONO,
            textShadow: `0 0 12px ${C.green}80` }}>
            {rate}%
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, flex: 1 }}>
        <SmallCard label="已发布需求" value={kpi?.publishedDemands ?? 0} unit="项" color={C.amber} sub="累计" />
        <SmallCard label="已完成订单" value={kpi?.completedOrders ?? 0} unit="单" color={C.green} sub="已完结" />
        <SmallCard label="进行中订单" value={kpi?.inProgressOrders ?? 0} unit="单" color={C.red} sub="处理中" />
        <SmallCard label="发单企业数" value={kpi?.publisherCount ?? 0} unit="家" color={C.blue} sub="活跃" />
      </div>
    </motion.div>
  );
}

// ─── Screen 2: 用户注册 ───────────────────────────────────────────────────────

function Screen2({ timeSeries, kpi, active }: {
  timeSeries: ScreenData['timeSeries']; kpi: ScreenData['kpi'] | undefined; active: boolean;
}) {
  const last7 = timeSeries.slice(-7).map(d => ({ ...d, shortLabel: d.label.slice(3) }));
  const maxVal = Math.max(...last7.map(d => d.newUsers), 1);
  const todayUsers  = last7[last7.length - 1]?.newUsers ?? 0;
  const week7Users  = last7.reduce((s, d) => s + d.newUsers, 0);
  const totalUsers  = useCounter(kpi?.totalUsers ?? 0, active, 80);
  const opcPct      = kpi && kpi.totalUsers > 0
    ? Math.round((kpi.opcCount / kpi.totalUsers) * 100) : 0;

  return (
    <motion.div key="s2"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ height: '100%', padding: '10px 12px 8px', display: 'flex', flexDirection: 'column' }}
    >
      <SectionTitle title="用户注册" sub="近7天" />

      {/* 3 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 10 }}>
        {[
          { label: '今日新增', val: todayUsers,       color: C.cyan  },
          { label: '近7天合计', val: week7Users,      color: C.purple },
          { label: '累计用户', val: totalUsers,        color: C.green },
        ].map(s => (
          <div key={s.label} style={{
            background: C.card, border: `1px solid ${s.color}22`, borderRadius: 9,
            padding: '8px 6px', textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
            <div style={{ fontSize: 9, color: '#4a7090', marginBottom: 4, fontFamily: FONT }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: MONO,
              textShadow: `0 0 14px ${s.color}60` }}>{s.val.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{
        flex: 1, background: `linear-gradient(180deg, #071828 0%, #040e1c 100%)`,
        border: `1px solid ${C.border}`, borderRadius: 10,
        padding: '10px 6px 6px 2px', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: 9, color: '#2a4a60', marginBottom: 6, paddingLeft: 8,
          letterSpacing: '0.05em', fontFamily: FONT }}>
          近7天每日注册人数
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7} barSize={18} margin={{ top: 4, right: 6, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="uBarActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.purple} stopOpacity={1} />
                  <stop offset="100%" stopColor="#4400aa" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="uBarNormal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.purple} stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3300aa" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <XAxis dataKey="shortLabel" tick={{ fill: '#3a5870', fontSize: 8, fontFamily: FONT }}
                tickLine={false} axisLine={{ stroke: `${C.border}60` }} interval={0} />
              <YAxis tick={{ fill: '#3a5870', fontSize: 8 }} tickLine={false} axisLine={false} tickCount={4} />
              <Bar dataKey="newUsers" radius={[4, 4, 0, 0]}>
                {last7.map((entry, i) => (
                  <Cell key={i} fill={entry.newUsers === maxVal ? 'url(#uBarActive)' : 'url(#uBarNormal)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* OPC / 发单方 breakdown */}
        <div style={{ display: 'flex', gap: 6, padding: '6px 8px 2px', borderTop: `1px solid ${C.border}30`, marginTop: 4 }}>
          {[
            { label: 'OPC',   val: kpi?.opcCount ?? 0,       color: C.cyan,   pct: opcPct },
            { label: '发单方', val: kpi?.publisherCount ?? 0, color: C.amber,  pct: kpi && kpi.totalUsers > 0 ? Math.round((kpi.publisherCount / kpi.totalUsers) * 100) : 0 },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 8, color: '#3a6080', fontFamily: FONT }}>{s.label}</span>
              <span style={{ fontSize: 10, color: s.color, fontWeight: 700, fontFamily: MONO, marginLeft: 'auto' }}>
                {s.val.toLocaleString()}
              </span>
              <span style={{ fontSize: 8, color: `${s.color}70`, fontFamily: FONT }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Screen 3: 实时订单动态 ───────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  in_progress:        C.cyan,
  pending_acceptance: C.amber,
  completed:          C.green,
  closed:             '#64748b',
  disputed:           C.red,
};

const ORDER_H = 64;
const ORDER_GAP = 7;

function Screen3({ orders, kpi }: { orders: OrderItem[]; kpi: ScreenData['kpi'] | undefined }) {
  const statusCounts = [
    { label: '进行中',  value: kpi?.inProgressOrders ?? 0, color: C.cyan  },
    { label: '待验收',  value: 0,                          color: C.amber },
    { label: '已完成',  value: kpi?.completedOrders ?? 0,  color: C.green },
  ];
  const displayOrders = orders.length ? orders : Array.from({ length: 4 }, (_, i) => ({
    id: i, title: '暂无订单数据', opcNickname: '-', amount: 0,
    status: 'in_progress', statusLabel: '进行中', timeAgo: '-',
  }));

  return (
    <motion.div key="s3"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ height: '100%', padding: '10px 12px 8px', display: 'flex', flexDirection: 'column' }}
    >
      <SectionTitle title="实时订单" sub="滚动播报" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {statusCounts.map(s => (
          <div key={s.label} style={{
            flex: 1, background: C.card, borderRadius: 7, padding: '5px 6px', textAlign: 'center',
            border: `1px solid ${s.color}22`,
          }}>
            <div style={{ fontSize: 8, color: '#3a6080', marginBottom: 3, fontFamily: FONT }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: MONO }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AutoScroll items={displayOrders} itemHeight={ORDER_H} gap={ORDER_GAP} speed={0.85}
          renderItem={(item) => {
            const o = item as OrderItem;
            const color = STATUS_COLOR[o.status] ?? C.cyan;
            return (
              <div style={{
                height: ORDER_H, background: C.card,
                border: `1px solid ${C.border}`, borderRadius: 9,
                padding: '9px 10px', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  background: `linear-gradient(180deg, ${color}, ${color}60)` }} />
                <div style={{ paddingLeft: 8, fontSize: 11, color: '#bcd4e8', lineHeight: 1.35,
                  overflow: 'hidden', fontFamily: FONT,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {o.title}
                </div>
                <div style={{ paddingLeft: 8, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: '#2a4a60', fontFamily: FONT }}>{o.timeAgo}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 8, color: color, border: `1px solid ${color}40`,
                      borderRadius: 3, padding: '1px 5px', fontFamily: FONT,
                    }}>{o.statusLabel}</span>
                    <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, fontFamily: MONO }}>
                      {o.amount > 0 ? `¥${fmtMoney(o.amount)}` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </motion.div>
  );
}

// ─── Screen 4: 平台动态 ───────────────────────────────────────────────────────

type NewsItem = { text: string; icon: string; color: string };

function classifyNews(text: string): { icon: string; color: string } {
  if (text.includes('注册') || text.includes('欢迎'))   return { icon: '👤', color: C.cyan   };
  if (text.includes('中标') || text.includes('签约'))   return { icon: '🤝', color: C.green  };
  if (text.includes('晋升') || text.includes('升为'))   return { icon: '🏆', color: C.amber  };
  if (text.includes('发布') || text.includes('新需求')) return { icon: '📋', color: C.blue   };
  return { icon: '📌', color: C.purple };
}

const NEWS_H = 68;
const NEWS_GAP = 7;

function Screen4({ ticker1, ticker2 }: { ticker1: { text: string }[]; ticker2: { text: string }[] }) {
  const newsItems: NewsItem[] = useMemo(() => {
    const all = [...ticker1, ...ticker2].map(t => ({ text: t.text, ...classifyNews(t.text) }));
    return all.length ? all : [{ text: '暂无平台动态', icon: '📌', color: C.purple }];
  }, [ticker1, ticker2]);

  return (
    <motion.div key="s4"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      style={{ height: '100%', padding: '10px 12px 8px', display: 'flex', flexDirection: 'column' }}
    >
      <SectionTitle title="平台动态" sub="最新资讯" />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
        padding: '6px 10px', background: C.card,
        border: `1px solid ${C.border}`, borderRadius: 8,
      }}>
        <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
          style={{ width: 7, height: 7, borderRadius: '50%', background: C.red,
            boxShadow: `0 0 6px ${C.red}`, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: '#4a7090', fontFamily: FONT }}>LIVE</span>
        <div style={{ width: 1, height: 10, background: C.border, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: '#7ab8d0', fontFamily: FONT }}>
          共 {newsItems.length} 条动态
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AutoScroll items={newsItems} itemHeight={NEWS_H} gap={NEWS_GAP} speed={0.7}
          renderItem={(item) => {
            const n = item as NewsItem;
            return (
              <div style={{
                height: NEWS_H, background: C.card,
                border: `1px solid ${C.border}`, borderRadius: 9,
                padding: '9px 10px', display: 'flex', alignItems: 'flex-start',
                gap: 8, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                  background: `linear-gradient(90deg, transparent, ${n.color}40, transparent)` }} />
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: `${n.color}15`, border: `1px solid ${n.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 11, color: '#bcd4e8', lineHeight: 1.4, margin: 0, fontFamily: FONT,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {n.text}
                  </p>
                </div>
              </div>
            );
          }}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MiniScreen() {
  const [screen, setScreen] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setScreen(s => (s + 1) % SLIDE_COUNT), SLIDE_DURATION);
    return () => clearInterval(t);
  }, []);

  const { data } = useQuery<ScreenData>({
    queryKey: ["screen-mini"], queryFn: fetchScreen,
    refetchInterval: 60_000, staleTime: 0,
  });

  const kpi          = data?.kpi;
  const timeSeries   = data?.timeSeries ?? [];
  const recentOrders = data?.recentOrderList ?? [];
  const ticker1      = data?.ticker1 ?? [];
  const ticker2      = data?.ticker2 ?? [];

  const timeStr = time.toLocaleTimeString('zh-CN', { hour12: false });
  const dateStr = time.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '/');
  const screenNames = ['核心指标', '用户注册', '实时订单', '平台动态'];

  return (
    <div style={{
      width: '100vw', height: '100vh', background: C.bg, overflow: 'hidden',
      position: 'relative', fontFamily: FONT, color: '#ffffff',
    }}>
      {/* Scanline texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30, opacity: 0.025,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)',
        backgroundSize: '100% 3px',
      }} />
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.4,
        backgroundImage: `linear-gradient(${C.cyan}08 1px, transparent 1px), linear-gradient(90deg, ${C.cyan}08 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }} />
      {/* Corner glows */}
      <div style={{ position: 'absolute', top: -40, left: -40, width: 180, height: 180,
        borderRadius: '50%', background: `radial-gradient(circle, ${C.cyan}07, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: -40, right: -40, width: 140, height: 140,
        borderRadius: '50%', background: `radial-gradient(circle, ${C.purple}08, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Header (36px) ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 36, zIndex: 20,
        background: `linear-gradient(90deg, #0a1e3a 0%, #071525 100%)`,
        borderBottom: `1px solid ${C.cyan}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
              background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />
            <motion.div animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: -3, borderRadius: '50%',
                border: `1px solid ${C.cyan}40` }} />
          </div>
          <span style={{ fontSize: 10, color: C.cyan, fontWeight: 600, letterSpacing: '0.04em',
            textShadow: `0 0 12px ${C.cyan}60`, fontFamily: FONT }}>
            接单吧 OPC 接单平台
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#5a88a8', fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2, fontFamily: MONO }}>{timeStr}</div>
          <div style={{ fontSize: 8, color: '#2a4a60', lineHeight: 1, fontFamily: FONT }}>{dateStr}</div>
        </div>
      </div>

      {/* ── Screen Content ── */}
      <div style={{ position: 'absolute', top: 36, left: 0, right: 0, bottom: 20, zIndex: 10 }}>
        <AnimatePresence mode="wait">
          {screen === 0 && <Screen1 kpi={kpi} active={screen === 0} />}
          {screen === 1 && <Screen2 timeSeries={timeSeries} kpi={kpi} active={screen === 1} />}
          {screen === 2 && <Screen3 orders={recentOrders} kpi={kpi} />}
          {screen === 3 && <Screen4 ticker1={ticker1} ticker2={ticker2} />}
        </AnimatePresence>
      </div>

      {/* ── Footer (20px) ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, zIndex: 20,
        background: '#030b18', borderTop: `1px solid ${C.border}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 8, color: '#2a4a60', fontFamily: FONT }}>{screenNames[screen]}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <motion.div key={i}
              animate={{ width: i === screen ? 18 : 5, opacity: i === screen ? 1 : 0.25 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              style={{ height: 4, borderRadius: 3,
                background: i === screen ? C.cyan : '#3a5870',
                boxShadow: i === screen ? `0 0 6px ${C.cyan}80` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ping { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.8);opacity:0} }
      `}</style>
    </div>
  );
}
