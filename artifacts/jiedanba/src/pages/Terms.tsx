import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <Link href="/login" className="text-xl font-black font-display text-primary tracking-tight">
          接单吧
        </Link>
        <Link href="/login" className="text-xs text-slate-500 hover:text-primary transition-colors">
          ← 返回
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black font-display text-slate-900 mb-2">服务条款</h1>
        <p className="text-sm text-slate-400 mb-10">最后更新：2026 年 1 月 1 日</p>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">1. 总则</h2>
            <p>
              本服务条款（以下简称"本条款"）由您（以下简称"用户"）与接单吧平台运营主体（以下简称"本平台"）共同订立，适用于您通过接单吧网站及相关移动端、API
              等所有产品与服务。请您在注册、登录或使用本平台任何功能前仔细阅读本条款。一旦您完成注册或以任何方式使用本平台，即视为您已阅读、理解并同意接受本条款的全部内容。若您不同意本条款的任何内容，请立即停止使用本平台的全部服务。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">2. 平台简介与服务描述</h2>
            <p>
              接单吧是面向机构级市场的 OPC（场外期权经纪商）撮合交易平台，为发单方（机构）与接单方（OPC
              从业者）提供需求发布、竞价、撮合、订单管理及资金结算等一站式服务。本平台本身不参与任何交易的任何一方，仅作为信息撮合与技术服务提供商。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">3. 用户资格与账号管理</h2>
            <p className="mb-2">
              3.1 您须为具有完全民事行为能力的自然人、法人或其他组织，且须满足相关监管机构对从业资质的要求，方可注册使用本平台。
            </p>
            <p className="mb-2">
              3.2 您须对账号安全负责，不得将账号、密码或相关凭证转让或出借给他人使用。如发现账号被盗用，须立即通知本平台。
            </p>
            <p>
              3.3 本平台有权在合理怀疑账号存在违规行为时，暂停或注销相关账号，并保留追究法律责任的权利。
            </p>
          </section>

          <section id="community">
            <h2 className="text-base font-bold text-slate-900 mb-3">4. 用户行为规范与社区准则</h2>
            <p className="mb-2">您在使用本平台过程中，不得从事以下行为：</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>发布虚假、欺诈性或误导性信息；</li>
              <li>利用平台从事任何违反法律法规或监管规定的活动；</li>
              <li>干扰、破坏平台正常运营或侵害其他用户合法权益；</li>
              <li>未经授权抓取、复制或滥用平台数据；</li>
              <li>在社区内发表侮辱、诽谤、歧视或骚扰性内容；</li>
              <li>传播未经证实的市场信息或操纵市场舆论。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">5. 交易规则与资金结算</h2>
            <p className="mb-2">
              5.1 用户在平台内发布的需求、报价及最终达成的订单均须遵守本平台发布的交易规则。
            </p>
            <p className="mb-2">
              5.2 本平台将依据订单状态及双方确认结果执行资金划转。因用户提供错误收款信息导致的资金损失，由用户自行承担。
            </p>
            <p>
              5.3 本平台收取的服务费率以平台公示页面为准，并可能随市场情况调整，调整前将提前通知用户。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">6. 知识产权</h2>
            <p>
              本平台所有软件、界面、数据库、算法及相关文档的知识产权均归本平台所有。用户不得以任何形式复制、修改、反编译或利用上述内容创作衍生作品，否则本平台有权依法追究侵权责任。
            </p>
          </section>

          <section id="regulatory">
            <h2 className="text-base font-bold text-slate-900 mb-3">7. 监管披露</h2>
            <p className="mb-2">
              接单吧平台的撮合交易服务涉及场外期权相关业务，受中国证监会及相关监管机构的监督管理。本平台仅为信息撮合服务提供商，不持有任何证券、期货或衍生品交易资质，亦不作为交易对手方参与任何金融合约。
            </p>
            <p className="mb-2">
              从事场外期权业务的机构及个人须持有监管机构颁发的相应从业资质，并严格遵守《证券公司场外期权业务管理办法》等相关法规。本平台有权核验用户资质，并拒绝不符合要求的用户访问核心交易功能。
            </p>
            <p>
              如有监管合规问题，请联系：compliance@jiedanba.com
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">8. 免责声明</h2>
            <p className="mb-2">
              8.1 本平台仅提供撮合技术服务，不对交易双方的资质、履约能力或交易结果作出任何形式的保证或承诺。
            </p>
            <p className="mb-2">
              8.2 因不可抗力、第三方服务故障、网络中断等原因导致的服务中断或数据丢失，本平台在法律允许的最大范围内免除赔偿责任。
            </p>
            <p>
              8.3 本平台对任何间接损失、利润损失或商誉损失不承担责任。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">9. 条款修改</h2>
            <p>
              本平台有权对本条款进行修改，并通过平台公告或电子邮件方式提前通知用户。修改后的条款自公示之日起生效，继续使用本平台服务即视为接受修改后的条款。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">10. 适用法律与争议解决</h2>
            <p>
              本条款的订立、效力、解释及履行均适用中华人民共和国法律。因本条款引起的或与之相关的任何争议，双方应首先协商解决；协商不成的，任何一方均可向本平台注册地有管辖权的人民法院提起诉讼。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">11. 联系方式</h2>
            <p>
              如您对本条款有任何疑问，请通过以下方式联系我们：
            </p>
            <ul className="mt-2 space-y-1 pl-2">
              <li>平台名称：接单吧 OPC 撮合交易平台</li>
              <li>电子邮件：legal@jiedanba.com</li>
              <li>工作时间：周一至周五 09:00–18:00（北京时间）</li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-400">
        <span>© 2026 接单吧 · 机构级 OPC 交易平台</span>
        <nav className="flex gap-6">
          <Link href="/terms" className="hover:text-primary transition-colors">服务条款</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">隐私政策</Link>
        </nav>
      </footer>
    </div>
  );
}
