import { useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, Box, UploadCloud, CheckCircle, FileX } from "lucide-react";
import { useGetOrderById, useSubmitDeliverable, useAcceptOrder } from "@workspace/api-client-react";
import { ORDER_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  
  const { data: order, isLoading, refetch } = useGetOrderById(id);
  const { mutate: submitDeliverable, isPending: isSubmitting } = useSubmitDeliverable();
  const { mutate: acceptOrder, isPending: isAccepting } = useAcceptOrder();

  const [deliveryForm, setDeliveryForm] = useState({ title: "", description: "", fileUrl: "" });

  if (isLoading || !order) return <div className="animate-pulse h-96 bg-card rounded-3xl border border-border"></div>;

  const status = ORDER_STATUSES[order.status] || ORDER_STATUSES.in_progress;

  const handleSubmitDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    submitDeliverable({ orderId: id, data: deliveryForm }, {
      onSuccess: () => {
        toast({ title: "交付物已提交", description: "等待发单方验收。" });
        setDeliveryForm({ title: "", description: "", fileUrl: "" });
        refetch();
      }
    });
  };

  const handleAccept = () => {
    if(!confirm("确认验收通过吗？资金将结算给接单方。")) return;
    acceptOrder({ orderId: id, data: { rating: 5, comment: "优秀完成" } }, {
      onSuccess: () => {
        toast({ title: "验收成功", description: "订单已完成结算。" });
        refetch();
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button onClick={() => window.history.back()} className="flex items-center text-muted-foreground hover:text-foreground font-bold text-sm transition-colors w-max">
        <ArrowLeft size={16} className="mr-2" /> 返回订单列表
      </button>

      {/* Header */}
      <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col md:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">No. {order.orderNo}</span>
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${status.color}`}>{status.label}</span>
          </div>
          <h1 className="text-2xl font-black font-display text-foreground mb-4">{order.demandTitle}</h1>
          <div className="flex flex-wrap gap-8 text-sm text-muted-foreground font-medium">
            <div>发单方: <span className="text-foreground">{order.publisherName}</span></div>
            <div>接单方: <span className="text-foreground">{order.opcNickname}</span></div>
            <div>截止时间: <span className="text-foreground">{order.deadline}</span></div>
          </div>
        </div>
        <div className="text-left md:text-right bg-muted/50 p-6 rounded-2xl border border-border min-w-[200px]">
          <span className="block text-xs text-muted-foreground font-bold uppercase tracking-widest mb-2">订单总额</span>
          <span className="text-3xl font-black text-secondary">¥{order.amount.toLocaleString()}</span>
          {order.status === 'pending_acceptance' && (
             <button onClick={handleAccept} disabled={isAccepting} className="w-full mt-4 bg-secondary text-white font-bold py-2 rounded-lg shadow-lg shadow-secondary/20 hover:bg-secondary/90 transition-all">
               确认验收付款
             </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Deliverables Form */}
        {order.status === 'in_progress' && (
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <UploadCloud className="text-primary" /> 提交交付物
            </h3>
            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">交付物名称 *</label>
                <input required className="w-full bg-background border-2 border-border rounded-xl p-3 text-sm focus:border-primary outline-none" 
                  value={deliveryForm.title} onChange={e=>setDeliveryForm(p=>({...p, title:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">交付说明</label>
                <textarea className="w-full bg-background border-2 border-border rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" rows={3}
                  value={deliveryForm.description} onChange={e=>setDeliveryForm(p=>({...p, description:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">文件链接 (网盘等)</label>
                <input className="w-full bg-background border-2 border-border rounded-xl p-3 text-sm focus:border-primary outline-none" 
                  value={deliveryForm.fileUrl} onChange={e=>setDeliveryForm(p=>({...p, fileUrl:e.target.value}))}/>
              </div>
              <button disabled={isSubmitting} className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 mt-4 disabled:opacity-50">
                {isSubmitting ? "提交中..." : "确认提交"}
              </button>
            </form>
          </div>
        )}

        {/* Deliverables List */}
        <div className={`bg-card rounded-3xl p-8 border border-border shadow-sm ${order.status !== 'in_progress' ? 'lg:col-span-2' : ''}`}>
          <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
            <Box className="text-secondary" /> 交付记录
          </h3>
          <div className="space-y-4">
            {order.deliverables?.length ? order.deliverables.map(d => (
              <div key={d.id} className="p-4 rounded-xl border border-border bg-background">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-foreground">{d.title}</h4>
                  <span className="text-xs font-bold px-2 py-1 rounded bg-muted text-muted-foreground">{d.status === 'approved' ? '已通过' : d.status === 'rejected' ? '已打回' : '待审核'}</span>
                </div>
                {d.description && <p className="text-sm text-muted-foreground mb-3">{d.description}</p>}
                {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-primary text-sm font-bold hover:underline">🔗 查看附件</a>}
                <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">提交于 {new Date(d.submittedAt).toLocaleString('zh-CN')}</div>
              </div>
            )) : (
              <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                <FileX size={32} className="mb-2 opacity-50" />
                暂无交付记录
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
