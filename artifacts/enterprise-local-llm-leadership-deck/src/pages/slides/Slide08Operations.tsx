export default function Slide08Operations() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">阶段四</span></div><span className="text-[1.5vw] font-bold text-muted">持续运营</span></div>
      <h1 className="mt-[3.5vh] text-[4vw] font-extrabold tracking-[-0.03em]">阶段四：监控与运维</h1>
      <div className="mt-[4vh] grid grid-cols-[1.3fr_0.7fr] gap-[2vw]">
        <div className="grid grid-cols-2 gap-[1.5vw]">
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><h2 className="text-[2vw] font-extrabold text-accent">运行监控</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">服务是否可用、响应是否变慢、资源是否不足</p></div>
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><h2 className="text-[2vw] font-extrabold text-accent">质量监控</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">回答质量、引用准确性和用户反馈是否下降</p></div>
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><h2 className="text-[2vw] font-extrabold text-accent">安全监控</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">越权访问、敏感信息、异常调用和供应链风险</p></div>
          <div className="rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><h2 className="text-[2vw] font-extrabold text-accent">日常运维</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">巡检、备份、恢复、补丁、版本升级和容量扩展</p></div>
          <div className="col-span-2 rounded-[1vw] border border-[#DDE6EA] bg-white p-[2vw]"><h2 className="text-[2vw] font-extrabold text-accent">故障处置</h2><p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-muted">分级告警、快速止损、恢复服务和事后复盘</p></div>
        </div>
        <div className="flex flex-col justify-center rounded-[1.2vw] bg-primary p-[3vw] text-white"><div className="text-[1.6vw] font-bold tracking-[0.08em] text-[#9BD2CC]">阶段成果</div><p className="mt-[2vh] text-[3vw] font-extrabold leading-[1.25]">让系统长期稳定运行，并能持续优化</p><div className="mt-[4vh] flex h-[18vh] items-end gap-[1vw] border-b border-[#52708B] pb-[1vh]"><div className="h-[6vh] flex-1 rounded-t-[0.3vw] bg-[#9BD2CC]" /><div className="h-[10vh] flex-1 rounded-t-[0.3vw] bg-[#6EBEB5]" /><div className="h-[13vh] flex-1 rounded-t-[0.3vw] bg-[#3CA79D]" /><div className="h-[16vh] flex-1 rounded-t-[0.3vw] bg-accent" /></div></div>
      </div>
    </div>
  );
}