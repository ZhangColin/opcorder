import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle, FileText, Download, FileImage, FileSpreadsheet, FileArchive, File, Building2, MapPin, Globe, Mail, Users, CalendarDays, ChevronRight, X } from "lucide-react";
import { useGetDemandById, useCreateBid } from "@workspace/api-client-react";
import { DEMAND_TYPES, DEMAND_STATUSES, OPC_LEVELS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

function AttachmentIcon({ type }: { type: string }) {
  if (type === "image") return <FileImage size={18} className="text-blue-500" />;
  if (type === "spreadsheet") return <FileSpreadsheet size={18} className="text-green-600" />;
  if (type === "archive") return <FileArchive size={18} className="text-yellow-600" />;
  return <File size={18} className="text-muted-foreground" />;
}

function PublisherModal({
  name,
  profile,
  onClose,
}: {
  name: string;
  profile: {
    companyLogo?: string | null;
    companyDesc?: string | null;
    industry?: string | null;
    location?: string | null;
    teamSize?: string | null;
    foundedYear?: string | null;
    website?: string | null;
    contactEmail?: string | null;
  } | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-blue-50 to-slate-100 px-6 py-6 flex items-center gap-4">
          {profile?.companyLogo ? (
            <img src={profile.companyLogo} alt="logo" className="w-16 h-16 rounded-2xl object-cover border border-white shadow-sm shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Building2 size={28} className="text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-blue-900 leading-tight">{name}</h2>
            {profile?.industry && <p className="text-sm text-slate-500 mt-0.5">{profile.industry}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/10 transition-colors shrink-0">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {profile?.companyDesc && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">公司简介</p>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.companyDesc}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {profile?.location && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={14} className="text-slate-400 shrink-0" /><span>{profile.location}</span>
              </div>
            )}
            {profile?.teamSize && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={14} className="text-slate-400 shrink-0" /><span>{profile.teamSize} 人</span>
              </div>
            )}
            {profile?.foundedYear && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays size={14} className="text-slate-400 shrink-0" /><span>成立于 {profile.foundedYear}</span>
              </div>
            )}
            {profile?.website && (
              <div className="flex items-center gap-2 text-sm col-span-2">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <a href={profile.website} target="_blank" rel="noreferrer"
                  className="text-primary underline truncate hover:text-primary/80 transition-colors">
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {profile?.contactEmail && (
              <div className="flex items-center gap-2 text-sm text-slate-600 col-span-2">
                <Mail size={14} className="text-slate-400 shrink-0" /><span>{profile.contactEmail}</span>
              </div>
            )}
          </div>
          {!profile && <p className="text-sm text-slate-400 text-center py-4">该发单方暂未完善公司资料</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemandDetail() {
  const [, params] = useRoute("/demands/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const id = parseInt(params?.id || "0", 10);
  const { data: demand, isLoading } = useGetDemandById(id);
  const { mutate: submitBid, isPending: isSubmitting } = useCreateBid();

  const [showBidForm, setShowBidForm] = useState(false);
  const [bidForm, setBidForm] = useState({ proposal: "", estimatedDays: 7, portfolioLinks: "" });
  const [showPublisherModal, setShowPublisherModal] = useState(false);

  if (isLoading || !demand) {
    return <div className="animate-pulse h-96 bg-card rounded-3xl border border-border mt-8"></div>;
  }

  const typeLabel = DEMAND_TYPES[demand.type] || demand.type;
  const statusInfo = DEMAND_STATUSES[demand.status] || DEMAND_STATUSES.published;
  const levelInfo = OPC_LEVELS[demand.opcLevel] || OPC_LEVELS.any;

  const attachments: Array<{ name: string; size: string; type: string; url: string }> =
    (demand as any).attachments?.length
      ? (demand as any).attachments
      : [];

  const handleBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitBid({
      demandId: id,
      data: {
        proposal: bidForm.proposal,
        estimatedDays: bidForm.estimatedDays,
        portfolioLinks: bidForm.portfolioLinks ? bidForm.portfolioLinks.split(",").map(s => s.trim()) : []
      }
    }, {
      onSuccess: () => {
        toast({ title: "接单申请已提交", description: "发单方将尽快审核您的申请。" });
        setShowBidForm(false);
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? err?.message ?? "请稍后重试";
        toast({ title: "无法提交抢单申请", description: msg, variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button onClick={() => window.history.back()} className="flex items-center text-muted-foreground hover:text-foreground font-bold text-sm transition-colors w-max">
        <ArrowLeft size={16} className="mr-2" /> 返回列表
      </button>

      {/* Header Info */}
      <div className="bg-card rounded-3xl p-8 lg:p-10 border border-border shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-md uppercase tracking-wider">{typeLabel}</span>
              <span className={`px-3 py-1 font-bold text-xs rounded-md ${statusInfo.color}`}>{statusInfo.label}</span>
              <span className="text-muted-foreground text-sm font-medium">编号: {demand.demandNo}</span>
            </div>
            
            <h1 className="text-3xl font-black font-display text-foreground mb-6 leading-tight">{demand.title}</h1>
            
            <div className="flex flex-wrap gap-6 mb-8">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">预算金额</span>
                <span className="text-2xl font-black text-secondary">¥{demand.budget.toLocaleString()}</span>
              </div>
              <div className="w-px bg-border"></div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">要求等级</span>
                <span className={`w-max px-2 py-1 rounded text-xs font-bold ${levelInfo.color}`}>{levelInfo.label}</span>
              </div>
              <div className="w-px bg-border"></div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">交付截止</span>
                <span className="text-base font-bold flex items-center"><Clock size={16} className="mr-1.5 text-muted-foreground"/> {format(new Date(demand.deadline), 'yyyy-MM-dd')}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {demand.skillTags.map(tag => (
                <span key={tag} className="bg-muted px-4 py-1.5 rounded-full text-sm font-semibold text-foreground border border-border/50">{tag}</span>
              ))}
            </div>
          </div>

          {showPublisherModal && (
            <PublisherModal
              name={demand.publisherName || "发单方"}
              profile={(demand as any).publisherProfile ?? null}
              onClose={() => setShowPublisherModal(false)}
            />
          )}

          <div className="md:w-72 shrink-0 bg-background rounded-2xl p-6 border border-border shadow-inner">
            <button
              className="flex items-center gap-3 mb-6 pb-4 border-b border-border w-full text-left group hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
              onClick={() => setShowPublisherModal(true)}
            >
              {(demand as any).publisherLogo ? (
                <img
                  src={(demand as any).publisherLogo}
                  alt={demand.publisherName || "发单方"}
                  className="w-12 h-12 rounded-xl object-cover shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all"
                />
              ) : (demand as any).publisherAvatar ? (
                <img
                  src={(demand as any).publisherAvatar}
                  alt={demand.publisherName || "发单方"}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl shrink-0">
                  {demand.publisherName?.[0] || '发'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-bold mb-1">发单方</p>
                <p className="font-bold text-foreground truncate">{demand.publisherName || '系统运营方'}</p>
                {(demand as any).publisherTitle && (
                  <p className="text-xs text-secondary font-medium mt-0.5 truncate">{(demand as any).publisherTitle}</p>
                )}
              </div>
              <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
            
            {demand.status === 'published' && (
              <button 
                onClick={() => setShowBidForm(true)}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 active:scale-95 transition-all text-lg"
              >
                立即接单
              </button>
            )}
            {demand.status !== 'published' && (
              <button disabled className="w-full bg-muted text-muted-foreground font-bold py-4 rounded-xl cursor-not-allowed text-lg">
                不可接单
              </button>
            )}
            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center">
              <ShieldAlert size={14} className="mr-1" /> 平台担保交易，资金安全无忧
            </p>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* Demand Description */}
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <FileText className="text-primary" /> 需求详情
            </h3>
            <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground leading-loose">
              {demand.description.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <Download className="text-primary" /> 参考资料下载
            </h3>
            {attachments.length === 0 ? (
              <p className="text-muted-foreground text-sm">发单方暂未上传参考资料。</p>
            ) : (
              <ul className="space-y-3">
                {attachments.map((file, idx) => {
                  const hasUrl = file.url && file.url !== "#";
                  const downloadHref = hasUrl
                    ? `${file.url}?name=${encodeURIComponent(file.name)}`
                    : undefined;
                  return (
                    <li key={idx}>
                      {hasUrl ? (
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={file.name}
                          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer"
                        >
                          <AttachmentIcon type={file.type} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{file.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{file.size}</p>
                          </div>
                          <Download size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 opacity-50 cursor-not-allowed">
                          <AttachmentIcon type={file.type} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{file.size} · 文件暂不可下载</p>
                          </div>
                          <Download size={15} className="text-muted-foreground/40 shrink-0" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <CheckCircle className="text-secondary" /> 交付里程碑
            </h3>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-3 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {demand.milestones?.map((ms, idx) => (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-card border-4 border-primary flex items-center justify-center shrink-0 mt-1 relative z-10"></div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{ms.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">期限: {format(new Date(ms.deadline), 'yyyy-MM-dd')}</p>
                    {ms.deliverableDesc && <p className="text-sm text-foreground/80 mt-2 bg-muted p-3 rounded-lg border border-border/50">{ms.deliverableDesc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-border relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowBidForm(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground">
              ✕
            </button>
            <h2 className="text-2xl font-black font-display mb-2">提交接单申请</h2>
            <p className="text-muted-foreground mb-8 text-sm">请详细填写您的解决方案和优势，提高中标率。</p>
            
            <form onSubmit={handleBidSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">解决方案与执行计划 *</label>
                <textarea 
                  required
                  rows={5}
                  className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none"
                  placeholder="请描述您对该需求的理解、具体执行步骤及技术路线..."
                  value={bidForm.proposal}
                  onChange={e => setBidForm(p => ({...p, proposal: e.target.value}))}
                ></textarea>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">预计交付天数 *</label>
                <div className="relative">
                  <input 
                    type="number" required min="1"
                    className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    value={bidForm.estimatedDays}
                    onChange={e => setBidForm(p => ({...p, estimatedDays: parseInt(e.target.value)}))}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">天</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">相关作品/案例链接 (选填)</label>
                <input 
                  type="text"
                  className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  placeholder="多个链接请用逗号分隔"
                  value={bidForm.portfolioLinks}
                  onChange={e => setBidForm(p => ({...p, portfolioLinks: e.target.value}))}
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowBidForm(false)} className="flex-1 px-6 py-3.5 rounded-xl font-bold border-2 border-border text-foreground hover:bg-muted transition-colors">
                  取消
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-3.5 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50">
                  {isSubmitting ? "提交中..." : "确认提交"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
