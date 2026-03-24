import { useLocation } from "wouter";
import { ShieldCheck, Building2, ArrowRight, Users } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();

  const selectRole = (role: "opc" | "publisher") => {
    localStorage.setItem("jdb_role", role);
    if (role === "opc") navigate("/");
    else navigate("/publisher");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-[#0047ab] to-[#001946] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative dots */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
      />
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#4dffb2]/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-xl">
            <ShieldCheck size={32} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-4xl font-black text-white tracking-tight font-display">接单吧</span>
        </div>
        <p className="text-center text-white/60 font-medium mb-12 text-base">
          OPC 撮合交易平台 · 请选择您的身份
        </p>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* OPC Card */}
          <button
            onClick={() => selectRole("opc")}
            className="group relative bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/40 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.99]"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#4dffb2]/20 border border-[#4dffb2]/30 flex items-center justify-center mb-6">
              <Users size={32} className="text-[#4dffb2]" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 font-display">OPC 超级个体</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              接受高价值政企项目，管理订单交付，提升个人信用等级，获得更多收益。
            </p>
            <ul className="space-y-2 mb-8">
              {["抢单 / 接受定向派单", "管理交付进度与里程碑", "查看收益结算明细"].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4dffb2]" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#4dffb2]">进入工作台</span>
              <div className="w-9 h-9 rounded-xl bg-[#4dffb2]/20 border border-[#4dffb2]/30 flex items-center justify-center group-hover:bg-[#4dffb2] group-hover:border-[#4dffb2] transition-all">
                <ArrowRight size={18} className="text-[#4dffb2] group-hover:text-[#002112]" />
              </div>
            </div>
          </button>

          {/* Publisher Card */}
          <button
            onClick={() => selectRole("publisher")}
            className="group relative bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/40 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.99]"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mb-6">
              <Building2 size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 font-display">需求发布方</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              发布政企数字化需求，匹配高质量 OPC 人才，实时监控项目进度与结算状态。
            </p>
            <ul className="space-y-2 mb-8">
              {["发布需求 / 智能匹配 OPC", "实时追踪项目交付进度", "管理资金托管与结算"].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">进入管理台</span>
              <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all">
                <ArrowRight size={18} className="text-white group-hover:text-primary" />
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-10">
          © 2026 接单吧 · 海创元数字生态 · V1.0 演示版
        </p>
      </div>
    </div>
  );
}
