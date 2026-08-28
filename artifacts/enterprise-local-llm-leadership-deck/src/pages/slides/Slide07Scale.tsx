export default function Slide07Scale() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[linear-gradient(135deg,#FAFBFC_0%,#F3F7F9_100%)] p-[4vw] font-body text-primary">
      <div className="flex items-center justify-between border-b border-[#DDE6EA] pb-[2vh]"><div className="flex items-center gap-[1vw]"><div className="h-[2vw] w-[2vw] rounded-[0.4vw] bg-accent" /><span className="text-[1.5vw] font-bold">应用落地</span></div><span className="text-[1.5vw] font-bold text-muted">试点 → 推广</span></div>
      <h1 className="mt-[3.5vh] text-[4vw] font-extrabold leading-[1.12] tracking-[-0.03em]">
        <span className="block">应用落地：</span>
        <span className="block">从单点试用到规模化推广</span>
      </h1>
      <div className="relative mt-[5vh]">
        <div className="absolute left-[5vw] right-[5vw] top-[4.8vh] h-[0.5vh] bg-[#DDE6EA]" />
        <div className="relative grid grid-cols-5 gap-[1vw]">
          <div className="text-center"><div className="mx-auto flex h-[7vw] w-[7vw] items-center justify-center rounded-full bg-accent text-[2.8vw] font-extrabold text-white">1</div><p className="mt-[2vh] text-[1.6vw] font-bold leading-[1.4]">第一步：选择价值明确、风险可控的业务场景做试点</p></div>
          <div className="text-center"><div className="mx-auto flex h-[7vw] w-[7vw] items-center justify-center rounded-full bg-[#6EBEB5] text-[2.8vw] font-extrabold text-white">2</div><p className="mt-[2vh] text-[1.6vw] font-bold leading-[1.4]">第二步：建立业务问题集和验收标准，先证明效果</p></div>
          <div className="text-center"><div className="mx-auto flex h-[7vw] w-[7vw] items-center justify-center rounded-full bg-[#479F97] text-[2.8vw] font-extrabold text-white">3</div><p className="mt-[2vh] text-[1.6vw] font-bold leading-[1.4]">第三步：接入企业数据、权限和现有业务系统</p></div>
          <div className="text-center"><div className="mx-auto flex h-[7vw] w-[7vw] items-center justify-center rounded-full bg-[#2D736F] text-[2.8vw] font-extrabold text-white">4</div><p className="mt-[2vh] text-[1.6vw] font-bold leading-[1.4]">第四步：小范围灰度，收集用户反馈和失败案例</p></div>
          <div className="text-center"><div className="mx-auto flex h-[7vw] w-[7vw] items-center justify-center rounded-full bg-primary text-[2.8vw] font-extrabold text-white">5</div><p className="mt-[2vh] text-[1.6vw] font-bold leading-[1.4]">第五步：达到效果、性能和安全标准后再扩大使用范围</p></div>
        </div>
      </div>
      <div className="mt-[6vh] rounded-[1vw] bg-primary px-[2.5vw] py-[2.5vh] text-center text-[2.2vw] font-extrabold text-white">阶段成果：形成可复制的应用模板，而不是一次性演示</div>
    </div>
  );
}