export default function Slide03Infrastructure() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">阶段一</span></div><span className="text-[1.5vw] font-bold text-muted">基础环境</span></div>
      <div className="mt-[4vh] grid grid-cols-[0.78fr_1.22fr] gap-[4vw]">
        <div><div className="text-[1.6vw] font-bold tracking-[0.08em] text-accent">FOUNDATION</div><h1 className="mt-[1vh] text-[4.4vw] font-extrabold leading-[1.08] tracking-[-0.03em]">阶段一：硬件及系统安装</h1><div className="mt-[5vh] rounded-[1vw] bg-primary p-[2.4vw] text-white"><p className="text-[1.5vw] font-bold text-[#9BD2CC]">阶段成果</p><p className="mt-[1.5vh] text-[2.1vw] font-bold leading-[1.45]">形成一套可安装、可重复、可恢复的基础环境</p></div></div>
        <div className="grid grid-cols-2 gap-[1.5vw]">
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[2.5vw] font-extrabold text-accent">01</div><h2 className="mt-[1vh] text-[2vw] font-bold">硬件到货验收</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">服务器、加速卡、存储、网络与备件</p></div>
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[2.5vw] font-extrabold text-accent">02</div><h2 className="mt-[1vh] text-[2vw] font-bold">机房条件确认</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">机柜、供电、散热、网络和安全区域</p></div>
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[2.5vw] font-extrabold text-accent">03</div><h2 className="mt-[1vh] text-[2vw] font-bold">基础系统安装</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">操作系统、驱动、容器平台和管理工具</p></div>
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[2.5vw] font-extrabold text-accent">04</div><h2 className="mt-[1vh] text-[2vw] font-bold">兼容性测试</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">确认硬件、驱动、系统和软件能够稳定配合</p></div>
        </div>
      </div>
    </div>
  );
}