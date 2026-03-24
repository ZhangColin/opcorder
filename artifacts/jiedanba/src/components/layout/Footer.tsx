import { ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full pt-20 pb-10 px-8 bg-white border-t border-border mt-20">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="text-primary" size={28} />
            <span className="font-display font-bold text-2xl text-foreground">接单吧</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            引领企业数字生态转型的超级个体撮合交易平台。精准匹配，担保交易，赋能数字建设。
          </p>
        </div>
        
        <div>
          <h5 className="font-bold text-sm tracking-wider text-primary mb-6">平台资源</h5>
          <ul className="space-y-4">
            <li><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">API 开发文档</a></li>
            <li><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">OPC 认证体系</a></li>
            <li><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">交易保障协议</a></li>
          </ul>
        </div>
        
        <div>
          <h5 className="font-bold text-sm tracking-wider text-primary mb-6">关于我们</h5>
          <ul className="space-y-4">
            <li><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">海创元生态</a></li>
            <li><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">联系客服</a></li>
            <li><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">隐私政策</a></li>
          </ul>
        </div>
        
        <div>
          <h5 className="font-bold text-sm tracking-wider text-primary mb-6">订阅行业动态</h5>
          <div className="flex gap-2">
            <input 
              className="bg-muted border-none rounded-lg px-4 py-3 text-sm w-full focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
              placeholder="您的邮箱地址" 
              type="email"
            />
            <button className="bg-primary text-white px-4 rounded-lg font-bold active:scale-95 transition-all shadow-md shadow-primary/20">
              订阅
            </button>
          </div>
          <p className="text-muted-foreground text-[11px] mt-6 tracking-wide">
            © 2026 海创元数字交易中心. 保留所有权利. 国资监管机构.
          </p>
        </div>
      </div>
    </footer>
  );
}
