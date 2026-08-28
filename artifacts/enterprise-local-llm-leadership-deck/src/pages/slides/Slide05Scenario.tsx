export default function Slide05Scenario() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">阶段三</span></div><span className="text-[1.5vw] font-bold text-muted">应用选型</span></div>
      <h1 className="mt-[3.5vh] text-[4vw] font-extrabold tracking-[-0.03em]">阶段三：先看场景，再决定用什么模型</h1>
      <div className="mt-[4vh] grid grid-cols-[1fr_1fr] gap-[2vw]">
        <div className="space-y-[1.5vh]">
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-white px-[2vw] py-[2vh] text-[1.7vw] font-bold">简单、重复、规则明确的任务：优先选择轻量模型</div>
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-white px-[2vw] py-[2vh] text-[1.7vw] font-bold">复杂分析、长文本和高质量要求：选择高能力模型</div>
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-white px-[2vw] py-[2vh] text-[1.7vw] font-bold">企业知识问答：模型结合企业知识库，不让模型凭空回答</div>
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-white px-[2vw] py-[2vh] text-[1.7vw] font-bold">图片、表格、语音等任务：选择对应的多模态模型</div>
          <div className="rounded-[0.8vw] border border-[#DDE6EA] bg-white px-[2vw] py-[2vh] text-[1.7vw] font-bold">高风险业务：必须保留权限控制、人工复核和结果追溯</div>
        </div>
        <div className="flex flex-col justify-center rounded-[1.2vw] bg-primary p-[3.5vw] text-white">
          <div className="text-[1.6vw] font-bold tracking-[0.08em] text-[#9BD2CC]">核心原则</div>
          <div className="mt-[2vh] text-[3.5vw] font-extrabold leading-[1.2]">不是模型越大越好</div>
          <div className="mt-[3vh] h-[0.5vh] w-[8vw] bg-accent" />
          <div className="mt-[3vh] text-[2.4vw] font-bold leading-[1.4]">而是效果、成本和风险最匹配</div>
        </div>
      </div>
    </div>
  );
}