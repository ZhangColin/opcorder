import { useState } from "react";
import { X, HelpCircle, Phone, Mail, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

const FAQS = [
  {
    q: "如何发布需求？",
    a: "登录发布方账号后，点击左侧「发布新需求」按钮，填写需求标题、类型、预算、截止日期等信息后提交。需求经平台审核通过后将公开显示供OPC接单。",
  },
  {
    q: "OPC如何接单？",
    a: "登录OPC账号后，进入「抢单大厅」浏览已发布的需求，点击「投标」提交报价和方案描述。发布方选择您的投标后，系统将自动创建订单。",
  },
  {
    q: "资金如何结算？",
    a: "平台采用里程碑托管制度。发布方在创建订单时预付资金，OPC完成每个里程碑后由发布方确认验收，验收通过后平台自动结算对应金额。OPC分成90%，平台服务费10%。",
  },
  {
    q: "如何成为高级OPC？",
    a: "通过「培训学院」学习课程并通过认证考核，可逐步从C级升至B级、A级。高级OPC可接受定向邀请和高价值项目，并享受额外收益奖励。",
  },
  {
    q: "订单出现争议怎么办？",
    a: "如对订单执行有异议，可在订单详情页发起争议。平台客服将在48小时内介入调解，根据双方提供的证明材料做出仲裁决定。",
  },
  {
    q: "忘记密码如何处理？",
    a: "请联系平台客服（微信：jiedanba_support 或邮件：support@jiedanba.com），提供注册邮箱后客服将协助重置密码。",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-3.5 text-left text-sm font-bold text-foreground hover:text-primary transition-colors"
      >
        {q}
        {open ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <HelpCircle size={22} className="text-primary" />
            <h2 className="text-lg font-black text-foreground">帮助中心</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-foreground transition-colors rounded-full p-1 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">常见问题</h3>
          {FAQS.map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
        </div>

        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">联系客服</h3>
          <div className="grid grid-cols-3 gap-3">
            <a href="mailto:support@jiedanba.com" className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all text-center group">
              <Mail size={18} className="text-primary" />
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-primary">邮件支持</span>
            </a>
            <button className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all text-center group">
              <MessageCircle size={18} className="text-secondary" />
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-secondary">在线客服</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all text-center group">
              <Phone size={18} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-600">电话支持</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
