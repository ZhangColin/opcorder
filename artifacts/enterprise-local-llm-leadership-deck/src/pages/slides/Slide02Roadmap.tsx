export default function Slide02Roadmap() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]">
        <div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">总体路线</span></div>
        <span className="text-[1.5vw] font-bold text-muted">01 / 04 阶段总览</span>
      </div>
      <h1 className="mt-[4vh] max-w-[84vw] text-[3.7vw] font-extrabold leading-[1.12] tracking-[-0.03em]">
        <span className="block">总体路线：先建底座，再上模型，</span>
        <span className="block">再做应用，最后持续运营</span>
      </h1>
      <div className="mt-[5vh] grid grid-cols-4 gap-[1.5vw]">
        <div className="relative h-[35vh] rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[3.8vw] font-extrabold text-[#CFE7E4]">01</div><h2 className="mt-[1vh] text-[2vw] font-bold">硬件及系统安装</h2><p className="mt-[2vh] text-[1.7vw] leading-[1.45] text-muted">把基础环境建好</p></div>
        <div className="relative h-[35vh] rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[3.8vw] font-extrabold text-[#9BD2CC]">02</div><h2 className="mt-[1vh] text-[2vw] font-bold">大模型部署与调试</h2><p className="mt-[2vh] text-[1.7vw] leading-[1.45] text-muted">让模型稳定运行</p></div>
        <div className="relative h-[35vh] rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[3.8vw] font-extrabold text-[#5CB7AD]">03</div><h2 className="mt-[1vh] text-[2vw] font-bold">大模型应用</h2><p className="mt-[2vh] text-[1.7vw] leading-[1.45] text-muted">按场景选对模型和应用方式</p></div>
        <div className="relative h-[35vh] rounded-[1vw] border border-accent bg-[#EAF6F4] p-[2vw] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]"><div className="text-[3.8vw] font-extrabold text-accent">04</div><h2 className="mt-[1vh] text-[2vw] font-bold">监控与运维</h2><p className="mt-[2vh] text-[1.7vw] leading-[1.45] text-muted">保障长期稳定、安全和可控</p></div>
      </div>
      <div className="mt-[4vh] rounded-[0.8vw] bg-primary px-[2.2vw] py-[2.2vh] text-[1.9vw] font-bold text-white">每个阶段都要经过验收，未达标不进入下一阶段</div>
    </div>
  );
}