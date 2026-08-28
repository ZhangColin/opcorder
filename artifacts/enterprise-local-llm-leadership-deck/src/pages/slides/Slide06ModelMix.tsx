export default function Slide06ModelMix() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">模型分工</span></div><span className="text-[1.5vw] font-bold text-muted">按需组合</span></div>
      <h1 className="mt-[3.5vh] text-[4vw] font-extrabold leading-[1.12] tracking-[-0.03em]">
        <span className="block">高模型、低模型和多模态模型</span>
        <span className="block">如何分工</span>
      </h1>
      <div className="mt-[4vh] grid grid-cols-4 gap-[1.5vw]">
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="h-[1vh] w-[5vw] rounded-full bg-[#9BD2CC]" /><h2 className="mt-[2vh] text-[2.1vw] font-extrabold">轻量模型</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.5] text-muted">分类、抽取、摘要、固定格式生成；速度快、成本低</p></div>
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="h-[1vh] w-[5vw] rounded-full bg-accent" /><h2 className="mt-[2vh] text-[2.1vw] font-extrabold">高能力模型</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.5] text-muted">复杂推理、方案分析、长文理解；效果强、资源投入高</p></div>
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="h-[1vh] w-[5vw] rounded-full bg-[#5CB7AD]" /><h2 className="mt-[2vh] text-[2.1vw] font-extrabold">视觉模型</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.5] text-muted">图片识别、票据、图表和扫描文档理解</p></div>
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="h-[1vh] w-[5vw] rounded-full bg-[#1E3A5F]" /><h2 className="mt-[2vh] text-[2.1vw] font-extrabold">语音模型</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.5] text-muted">语音识别、会议纪要、语音质检与播报</p></div>
      </div>
      <div className="mt-[4vh] grid grid-cols-[1fr_1fr] gap-[2vw]">
        <div className="rounded-[1vw] bg-[#EAF6F4] px-[2.4vw] py-[2.5vh]"><div className="text-[1.5vw] font-bold text-accent">组合方式</div><p className="mt-[1vh] text-[2vw] font-bold">轻量模型处理大部分任务，复杂任务再转高能力模型</p></div>
        <div className="rounded-[1vw] bg-primary px-[2.4vw] py-[2.5vh] text-white"><div className="text-[1.5vw] font-bold text-[#9BD2CC]">管理收益</div><p className="mt-[1vh] text-[2vw] font-bold">在保证效果的前提下，控制算力投入和运营成本</p></div>
      </div>
    </div>
  );
}