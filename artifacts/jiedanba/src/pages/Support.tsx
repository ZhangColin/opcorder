import { useState } from "react";
import { Link } from "wouter";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import {
  Mail, Phone, MessageSquare, ChevronDown, ChevronUp,
  Building2, Clock, Shield, CheckCircle2, Send, Loader2,
} from "lucide-react";

/* ─── FAQ Data ───────────────────────────────── */

const FAQ_ITEMS = [
  {
    question: "如何注册成为 OPC 超级个体？",
    answer:
      "访问接单吧首页，点击「OPC 登录」进入注册页面，填写姓名、手机号、邮箱和密码完成注册。注册后可进行实名认证和 OPC 资质认证，提升接单竞争力。",
  },
  {
    question: "发单方如何发布需求？",
    answer:
      "以发单方身份登录后，进入「需求管理」页面，点击「发布新需求」，填写需求标题、描述、预算及截止日期即可。需求发布后 OPC 可查看并提交投标方案。",
  },
  {
    question: "平台如何保障交易安全？",
    answer:
      "平台采用资金托管机制：发单方在确认服务商后将款项托管至平台，OPC 完成服务并经发单方确认后方可结算。全程由平台监管，避免跑单和欺诈风险。",
  },
  {
    question: "OPC 认证等级有哪些？",
    answer:
      "OPC 认证分为 L1～L4 四个等级。L1 为基础认证，L4 为最高级别。等级越高，可承接的需求规模越大，平台分配流量权重也越高。认证考核通过学院课程完成。",
  },
  {
    question: "如何处理订单纠纷？",
    answer:
      "如订单出现争议，双方可在「订单详情」页提交纠纷申请，并上传相关证据材料。平台客服将在 1 个工作日内介入调解，根据证据作出裁定。",
  },
  {
    question: "发票和结算如何处理？",
    answer:
      "OPC 在完成订单结算后可在「收益中心」申请提现。平台支持银行卡转账，结算周期为 T+3 工作日。发单方可在「财务中心」申请增值税电子普通发票。",
  },
  {
    question: "忘记密码怎么办？",
    answer:
      "在登录页面点击「忘记密码？」，输入注册邮箱后系统将发送重置链接，按邮件指引重置密码即可。若邮箱无法访问，请联系客服处理。",
  },
];

/* ─── Contact channels ───────────────────────── */

const CHANNELS = [
  {
    icon: <Mail size={22} className="text-primary" />,
    title: "邮件支持",
    desc: "适合非紧急问题及书面记录",
    value: "support@jiedanba.com",
    link: "mailto:support@jiedanba.com",
    badge: "工作日 24h 内回复",
  },
  {
    icon: <Phone size={22} className="text-primary" />,
    title: "电话热线",
    desc: "紧急问题优先拨打",
    value: "400-888-XXXX",
    link: "tel:400888xxxx",
    badge: "工作日 9:00 – 18:00",
  },
  {
    icon: <MessageSquare size={22} className="text-primary" />,
    title: "在线客服",
    desc: "实时聊天，快速响应",
    value: "提交在线留言",
    link: "#contact-form",
    badge: "工作日 9:00 – 21:00",
  },
];

/* ─── Institution support info ───────────────── */

const INSTITUTION_FEATURES = [
  { icon: <Building2 size={18} />, text: "专属客户经理一对一服务" },
  { icon: <Shield size={18} />,    text: "企业级 SLA 服务协议保障" },
  { icon: <Clock size={18} />,     text: "4 小时内紧急响应" },
  { icon: <CheckCircle2 size={18} />, text: "优先通道快速开通与认证" },
];

/* ─── FAQ Accordion ──────────────────────────── */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-white hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-semibold text-slate-800 text-sm leading-snug pr-4">{question}</span>
        {open ? (
          <ChevronUp size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-5 pt-1 bg-white text-sm text-slate-600 leading-relaxed border-t border-slate-100">
          {answer}
        </div>
      )}
    </div>
  );
}

/* ─── Contact Form ───────────────────────────── */

function ContactForm() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("请填写姓名、邮箱和留言内容");
      return;
    }
    if (!email.includes("@")) {
      setError("请填写有效的邮箱地址");
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 font-display">留言已发送！</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          我们已收到您的留言，将在 1 个工作日内通过邮件与您联系，感谢您的耐心等待。
        </p>
        <button
          onClick={() => { setSent(false); setName(""); setEmail(""); setSubject(""); setMessage(""); }}
          className="mt-2 text-sm font-bold text-primary hover:underline"
        >
          再次提交
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
            姓名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="您的姓名"
            className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none text-sm placeholder:text-slate-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
            邮箱 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none text-sm placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
          问题类型
        </label>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none text-sm text-slate-700 appearance-none"
        >
          <option value="">请选择问题类型</option>
          <option value="account">账号与登录</option>
          <option value="order">订单与交易</option>
          <option value="payment">支付与结算</option>
          <option value="certification">OPC 认证</option>
          <option value="dispute">纠纷处理</option>
          <option value="institution">机构合作</option>
          <option value="other">其他问题</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
          留言内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          placeholder="请详细描述您的问题或需求，我们将尽快为您处理…"
          className="w-full px-4 py-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none text-sm placeholder:text-slate-400 resize-none"
        />
        <div className="text-right text-xs text-slate-400">{message.length}/1000</div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> 提交中…</>
        ) : (
          <><Send size={16} /> 提交留言</>
        )}
      </button>
    </form>
  );
}

/* ─── Page ────────────────────────────────────── */

export default function Support() {
  const siteName = useSiteName();

  return (
    <div className="min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SiteLogo size={24} />
          <Link href="/login" className="text-lg font-extrabold font-display text-primary tracking-tight">
            {siteName}
          </Link>
        </div>
        <Link href="/login" className="text-xs font-medium text-slate-500 hover:text-primary transition-colors">
          ← 返回首页
        </Link>
      </header>

      {/* Hero */}
      <section className="bg-primary text-white py-20 px-8 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">帮助中心</span>
          <h1 className="text-4xl font-extrabold mt-4 mb-4 font-display leading-tight">
            我们随时为您提供支持
          </h1>
          <p className="text-blue-200 text-base leading-relaxed">
            无论是账号问题、交易纠纷还是机构合作咨询，我们的团队都将竭诚为您服务。
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-extrabold text-slate-900 font-display mb-10">
          联系我们
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CHANNELS.map(ch => (
            <a
              key={ch.title}
              href={ch.link}
              className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-4"
            >
              <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center group-hover:bg-primary/14 transition-colors">
                {ch.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">{ch.title}</h3>
                <p className="text-xs text-slate-500 mb-3">{ch.desc}</p>
                <p className="text-sm font-bold text-primary">{ch.value}</p>
              </div>
              <span className="mt-auto inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                <Clock size={11} className="mr-1.5" />
                {ch.badge}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Contact form + Institution support */}
      <section id="contact-form" className="max-w-5xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-5 gap-10">

        {/* Contact form */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-8">
          <h2 className="text-xl font-extrabold text-slate-900 font-display mb-1">在线留言</h2>
          <p className="text-sm text-slate-500 mb-7">
            填写表单后我们将在 1 个工作日内通过邮件回复您。
          </p>
          <ContactForm />
        </div>

        {/* Institution support */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-primary text-white rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="font-bold font-display">机构专属支持</h3>
                <p className="text-blue-200 text-xs mt-0.5">Enterprise Support</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm leading-relaxed mb-6">
              针对企业发单方及大型机构用户，我们提供专属客户经理及增强级服务协议，确保业务高效运转。
            </p>
            <ul className="space-y-3 mb-7">
              {INSTITUTION_FEATURES.map(f => (
                <li key={f.text} className="flex items-center gap-3 text-sm text-blue-100">
                  <span className="shrink-0 text-emerald-300">{f.icon}</span>
                  {f.text}
                </li>
              ))}
            </ul>
            <a
              href="mailto:enterprise@jiedanba.com"
              className="block w-full py-3 rounded-xl font-bold text-center bg-white text-primary hover:bg-blue-50 transition-colors text-sm"
            >
              发送机构合作邮件
            </a>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
              <Clock size={16} /> 工作时间
            </h4>
            <ul className="text-sm text-amber-800 space-y-1.5">
              <li className="flex justify-between"><span>周一 至 周五</span><span className="font-semibold">9:00 – 18:00</span></li>
              <li className="flex justify-between"><span>在线客服</span><span className="font-semibold">9:00 – 21:00</span></li>
              <li className="flex justify-between"><span>法定节假日</span><span className="font-semibold">邮件响应</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-slate-200 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-slate-900 font-display text-center mb-2">
            常见问题
          </h2>
          <p className="text-center text-sm text-slate-500 mb-10">
            找不到答案？欢迎通过上方渠道联系我们。
          </p>
          <div className="space-y-3">
            {FAQ_ITEMS.map(item => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[11px] text-slate-400 font-medium">
            © 2026 {siteName} · 机构级 OPC 交易平台
          </span>
          <nav className="flex gap-6 flex-wrap justify-center">
            <Link href="/terms" className="text-[11px] text-slate-400 font-medium hover:text-primary transition-colors">服务条款</Link>
            <Link href="/privacy" className="text-[11px] text-slate-400 font-medium hover:text-primary transition-colors">隐私政策</Link>
            <Link href="/community" className="text-[11px] text-slate-400 font-medium hover:text-primary transition-colors">社区</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
