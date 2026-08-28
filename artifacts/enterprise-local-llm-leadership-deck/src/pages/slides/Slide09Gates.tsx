export default function Slide09Gates() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">管理决策</span></div><span className="text-[1.5vw] font-bold text-muted">分阶段投入</span></div>
      <h1 className="mt-[3.5vh] text-[4vw] font-extrabold tracking-[-0.03em]">建设需要关注的四个管理门槛</h1>
      <div className="mt-[4vh] grid grid-cols-4 gap-[1.5vw]">
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="text-[3.8vw] font-extrabold text-[#CFE7E4]">01</div><h2 className="mt-[1vh] text-[2.1vw] font-extrabold">能不能建</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.45] text-muted">机房、硬件、预算和供应链是否就绪</p></div>
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="text-[3.8vw] font-extrabold text-[#9BD2CC]">02</div><h2 className="mt-[1vh] text-[2.1vw] font-extrabold">能不能用</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.45] text-muted">模型效果、性能和安全是否通过验收</p></div>
        <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><div className="text-[3.8vw] font-extrabold text-[#5CB7AD]">03</div><h2 className="mt-[1vh] text-[2.1vw] font-extrabold">值不值得用</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.45] text-muted">业务价值是否覆盖建设和运营成本</p></div>
        <div className="rounded-[1vw] border border-accent bg-[#EAF6F4] p-[2vw]"><div className="text-[3.8vw] font-extrabold text-accent">04</div><h2 className="mt-[1vh] text-[2.1vw] font-extrabold">能不能长期用</h2><p className="mt-[2vh] text-[1.6vw] leading-[1.45] text-muted">责任人、监控、运维、备份和升级机制是否落实</p></div>
      </div>
      <div className="mt-[5vh] rounded-[1vw] bg-primary px-[3vw] py-[3vh] text-white"><div className="text-[1.6vw] font-bold text-[#9BD2CC]">建议决策</div><p className="mt-[1vh] text-[2.8vw] font-extrabold">分阶段投资、分阶段验收、达标后再扩大规模</p></div>
    </div>
  );
}