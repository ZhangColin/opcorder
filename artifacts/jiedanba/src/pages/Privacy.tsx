import { Link } from "wouter";

export default function Privacy() {
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
        <h1 className="text-3xl font-black font-display text-slate-900 mb-2">隐私政策</h1>
        <p className="text-sm text-slate-400 mb-10">最后更新：2026 年 1 月 1 日</p>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">1. 引言</h2>
            <p>
              接单吧 OPC 撮合交易平台（以下简称"本平台"）非常重视您的个人信息与隐私保护。本隐私政策说明本平台如何收集、使用、存储、共享及保护您的个人信息，以及您依法享有的相关权利。请您在使用本平台服务前仔细阅读本政策。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">2. 我们收集的信息</h2>
            <p className="mb-2">在您使用本平台的过程中，我们可能收集以下类型的信息：</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>账号信息：</strong>注册时提供的手机号、电子邮件、姓名、所属机构等；</li>
              <li><strong>实名认证信息：</strong>依监管要求收集的身份证号、从业资格证书编号等；</li>
              <li><strong>交易信息：</strong>您在平台内发布的需求、报价记录、订单详情及结算信息；</li>
              <li><strong>设备与日志信息：</strong>IP 地址、浏览器类型、操作系统、访问时间及页面浏览记录；</li>
              <li><strong>支付信息：</strong>银行账户或结算账户相关信息（仅用于资金划转，不存储完整卡号）。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">3. 信息使用目的</h2>
            <p className="mb-2">我们将收集的信息用于以下目的：</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>提供、维护和改善本平台的撮合交易、订单管理及资金结算服务；</li>
              <li>完成实名认证及监管合规要求；</li>
              <li>向您发送交易通知、系统公告及安全提醒；</li>
              <li>分析平台使用数据以优化产品体验；</li>
              <li>依法配合监管机构的调查或信息披露要求。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">4. 信息共享与披露</h2>
            <p className="mb-2">
              4.1 本平台不会向任何第三方出售您的个人信息。
            </p>
            <p className="mb-2">
              4.2 在以下情况下，本平台可能向相关方共享您的信息：
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>经您明确授权同意；</li>
              <li>为完成交易向交易对手方披露必要的撮合信息；</li>
              <li>依法配合司法机关、监管机构的合法要求；</li>
              <li>向为本平台提供技术支持的合作服务商（如云计算、支付清算）共享必要数据，该类合作方须承担与本平台同等的保密义务。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">5. 信息存储与安全</h2>
            <p className="mb-2">
              5.1 您的个人信息将存储于中华人民共和国境内的服务器，存储期限不超过实现收集目的所必要的时间，或法律法规规定的最短保存期限。
            </p>
            <p className="mb-2">
              5.2 本平台采用行业通行的加密传输（TLS）、访问控制及审计日志等安全措施保护您的信息，防止未经授权的访问、泄露、篡改或销毁。
            </p>
            <p>
              5.3 若发生数据安全事件，本平台将在法定时限内通知您，并采取必要的补救措施。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">6. Cookie 及类似技术</h2>
            <p>
              本平台使用 Cookie 及类似技术（如 LocalStorage）维持您的登录状态、记录偏好设置及统计访问数据。您可通过浏览器设置拒绝或删除 Cookie，但这可能影响部分功能的正常使用。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">7. 您的权利</h2>
            <p className="mb-2">依据《个人信息保护法》等相关法律法规，您享有以下权利：</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>查阅、复制您的个人信息；</li>
              <li>更正不准确或不完整的个人信息；</li>
              <li>在法律允许的情形下删除您的个人信息；</li>
              <li>撤回已给予的授权同意（不影响撤回前的处理行为）；</li>
              <li>注销账号（账号注销后相关数据将按法规要求处理）。</li>
            </ul>
            <p className="mt-2">如需行使上述权利，请通过第 9 条联系方式与我们联系。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">8. 未成年人保护</h2>
            <p>
              本平台的服务仅面向具有完全民事行为能力的成年用户。我们不会故意收集未成年人的个人信息。如发现未成年人在未获监护人同意的情况下注册使用，请及时通知我们，我们将删除相关信息。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">9. 联系方式</h2>
            <p>
              如您对本隐私政策有任何疑问、意见或投诉，请通过以下方式联系我们：
            </p>
            <ul className="mt-2 space-y-1 pl-2">
              <li>平台名称：接单吧 OPC 撮合交易平台</li>
              <li>电子邮件：privacy@jiedanba.com</li>
              <li>工作时间：周一至周五 09:00–18:00（北京时间）</li>
            </ul>
            <p className="mt-2">我们将在收到请求后 15 个工作日内予以回复。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">10. 政策更新</h2>
            <p>
              本平台可能根据业务发展或法律法规变化更新本政策，并通过平台公告提前通知您。继续使用本平台服务即视为接受更新后的政策。
            </p>
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
