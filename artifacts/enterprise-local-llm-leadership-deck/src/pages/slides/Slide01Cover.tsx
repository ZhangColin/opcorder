const base = import.meta.env.BASE_URL;

export default function Slide01Cover() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body text-primary">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)]" />
      <div className="absolute left-[4vw] right-[4vw] top-[3.5vh] flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" />
          <div className="text-[1.5vw] font-bold">企业人工智能建设</div>
        </div>
        <div className="text-[1.5vw] font-bold tracking-[0.08em] text-muted">建设路线</div>
      </div>
      <div className="absolute left-[4vw] top-[20vh] w-[50vw]">
        <div className="mb-[1.5vh] text-[1.6vw] font-bold tracking-[0.08em] text-accent">建设与运营路线</div>
        <h1 className="m-0 text-[5.5vw] font-extrabold leading-[1.08] tracking-[-0.04em]">企业本地大模型建设路线</h1>
        <div className="mt-[3vh] space-y-[0.6vh] text-[2vw] leading-[1.45] text-[#475569]">
          <p>从基础环境到业务应用，再到持续运营</p>
          <p>四个阶段，把大模型真正变成稳定、可控、可持续的企业能力</p>
        </div>
        <div className="mt-[5vh] flex gap-[1.2vw]">
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-[#FFFFFF] px-[1.5vw] py-[1.5vh] text-[1.5vw] font-bold shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.06)]">4 个建设阶段</div>
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-[#FFFFFF] px-[1.5vw] py-[1.5vh] text-[1.5vw] font-bold shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.06)]">阶段验收再推进</div>
        </div>
      </div>
      <div className="absolute right-[4vw] top-[14vh] h-[72vh] w-[38vw] overflow-hidden rounded-[1.2vw] border border-[#DDE6EA] bg-white shadow-[0_0.8vw_2vw_rgba(30,58,95,0.08)]">
        <img src={`${base}ai-infrastructure-hero.jpg`} crossOrigin="anonymous" alt="企业人工智能基础设施" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(30,58,95,0.02),rgba(30,58,95,0.28))]" />
      </div>
      <div className="absolute bottom-[3vh] left-[4vw] right-[4vw] flex justify-between border-t border-[#DDE6EA] pt-[2vh] text-[1.5vw] text-muted">
        <span>企业本地化大模型建设</span><span>部署 · 应用 · 运维</span>
      </div>
    </div>
  );
}