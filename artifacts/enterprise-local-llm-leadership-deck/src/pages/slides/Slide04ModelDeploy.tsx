export default function Slide04ModelDeploy() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">阶段二</span></div><span className="text-[1.5vw] font-bold text-muted">模型上线</span></div>
      <h1 className="mt-[3.5vh] text-[4vw] font-extrabold tracking-[-0.03em]">阶段二：大模型部署与调试</h1>
      <div className="mt-[4vh] flex items-stretch gap-[1vw]">
        <div className="flex-1 rounded-[1vw] border border-[#DDE6EA] bg-white p-[1.6vw]"><div className="text-[2.6vw] font-extrabold text-accent">01</div><h2 className="mt-[1vh] text-[1.8vw] font-bold">模型准入</h2><p className="mt-[1vh] text-[1.5vw] leading-[1.4] text-muted">确认模型来源、许可、安全和版本</p></div>
        <div className="mt-[8vh] text-[2.2vw] font-bold text-[#9BD2CC]">→</div>
        <div className="flex-1 rounded-[1vw] border border-[#DDE6EA] bg-white p-[1.6vw]"><div className="text-[2.6vw] font-extrabold text-accent">02</div><h2 className="mt-[1vh] text-[1.8vw] font-bold">模型安装</h2><p className="mt-[1vh] text-[1.5vw] leading-[1.4] text-muted">完成模型加载、接口接入和访问控制</p></div>
        <div className="mt-[8vh] text-[2.2vw] font-bold text-[#9BD2CC]">→</div>
        <div className="flex-1 rounded-[1vw] border border-[#DDE6EA] bg-white p-[1.6vw]"><div className="text-[2.6vw] font-extrabold text-accent">03</div><h2 className="mt-[1vh] text-[1.8vw] font-bold">性能调试</h2><p className="mt-[1vh] text-[1.5vw] leading-[1.4] text-muted">优化响应速度、并发能力和资源使用</p></div>
        <div className="mt-[8vh] text-[2.2vw] font-bold text-[#9BD2CC]">→</div>
        <div className="flex-1 rounded-[1vw] border border-[#DDE6EA] bg-white p-[1.6vw]"><div className="text-[2.6vw] font-extrabold text-accent">04</div><h2 className="mt-[1vh] text-[1.8vw] font-bold">质量验证</h2><p className="mt-[1vh] text-[1.5vw] leading-[1.4] text-muted">用真实业务问题检查回答质量和稳定性</p></div>
        <div className="mt-[8vh] text-[2.2vw] font-bold text-[#9BD2CC]">→</div>
        <div className="flex-1 rounded-[1vw] border border-accent bg-[#EAF6F4] p-[1.6vw]"><div className="text-[2.6vw] font-extrabold text-accent">05</div><h2 className="mt-[1vh] text-[1.8vw] font-bold">灰度上线</h2><p className="mt-[1vh] text-[1.5vw] leading-[1.4] text-muted">先小范围试用，观察稳定后再逐步扩大</p></div>
      </div>
      <div className="mt-[5vh] flex items-center justify-between rounded-[1vw] bg-primary px-[2.5vw] py-[2.5vh] text-white"><span className="text-[1.6vw] font-bold text-[#9BD2CC]">阶段成果</span><span className="text-[2.2vw] font-extrabold">模型达到“能用、稳定、安全、可回退”</span></div>
    </div>
  );
}