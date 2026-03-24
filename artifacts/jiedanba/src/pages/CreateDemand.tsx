import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useCreateDemand } from "@workspace/api-client-react";
import { DEMAND_TYPES, OPC_LEVELS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { CreateDemandInputType, CreateDemandInputOpcLevel, CreateDemandInputMode } from "@workspace/api-client-react";

export default function CreateDemand() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutate, isPending } = useCreateDemand();

  const [form, setForm] = useState({
    title: "",
    type: "ai_tool_dev" as CreateDemandInputType,
    description: "",
    skillTags: "",
    opcLevel: "any" as CreateDemandInputOpcLevel,
    budgetMin: 5000,
    budgetMax: 10000,
    deadline: "",
    mode: "open" as CreateDemandInputMode,
    isUrgent: false,
    milestones: [
      { name: "初稿交付", deadline: "", deliverableDesc: "" },
      { name: "最终验收", deadline: "", deliverableDesc: "" }
    ]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      data: {
        ...form,
        skillTags: form.skillTags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
      }
    }, {
      onSuccess: () => {
        toast({ title: "发布成功", description: "需求已成功发布至大厅" });
        setLocation("/demands");
      },
      onError: (err) => {
        toast({ title: "发布失败", description: String(err), variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-black font-display text-foreground mb-2">发布新需求</h1>
        <p className="text-muted-foreground">详细描述您的需求，匹配最优质的超级个体</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Basic Info */}
        <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-6 font-display border-b border-border pb-4">基础信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-foreground mb-2">需求标题 *</label>
              <input 
                required maxLength={50}
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="例如：政务数据大屏前端开发与联调"
                value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">需求分类 *</label>
              <select 
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}
              >
                {Object.entries(DEMAND_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">要求 OPC 等级 *</label>
              <select 
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={form.opcLevel} onChange={e => setForm({...form, opcLevel: e.target.value as any})}
              >
                {Object.entries(OPC_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-foreground mb-2">详细描述 *</label>
              <textarea 
                required rows={6}
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none"
                placeholder="请详细描述项目背景、具体工作内容、技术要求等..."
                value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              ></textarea>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-foreground mb-2">技能标签</label>
              <input 
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="多个标签请用逗号分隔，如: React, Python, UI设计"
                value={form.skillTags} onChange={e => setForm({...form, skillTags: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Budget & Timeline */}
        <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
          <h2 className="text-xl font-bold mb-6 font-display border-b border-border pb-4">预算与周期</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">预算下限 (元) *</label>
              <input 
                type="number" required min="100"
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={form.budgetMin} onChange={e => setForm({...form, budgetMin: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">预算上限 (元) *</label>
              <input 
                type="number" required min={form.budgetMin}
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={form.budgetMax} onChange={e => setForm({...form, budgetMax: parseInt(e.target.value)})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">总体截止日期 *</label>
              <input 
                type="date" required
                className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})}
              />
            </div>
            
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={form.isUrgent} onChange={e => setForm({...form, isUrgent: e.target.checked})}
                  className="w-5 h-5 rounded text-destructive focus:ring-destructive border-border"
                />
                <span className="text-sm font-bold text-destructive group-hover:text-destructive/80 transition-colors">标记为加急需求（优先展示）</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Milestones */}
        <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <h2 className="text-xl font-bold font-display">里程碑设置</h2>
            <button 
              type="button" 
              onClick={() => setForm({...form, milestones: [...form.milestones, { name: "", deadline: "", deliverableDesc: "" }]})}
              className="text-primary font-bold text-sm flex items-center hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={16} className="mr-1" /> 添加阶段
            </button>
          </div>
          
          <div className="space-y-6">
            {form.milestones.map((ms, index) => (
              <div key={index} className="flex gap-4 items-start p-4 bg-muted/50 rounded-2xl border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-black flex items-center justify-center shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input 
                      required placeholder="阶段名称 (如: UI设计稿)"
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-primary outline-none"
                      value={ms.name} onChange={e => {
                        const newMs = [...form.milestones];
                        newMs[index].name = e.target.value;
                        setForm({...form, milestones: newMs});
                      }}
                    />
                  </div>
                  <div>
                    <input 
                      type="date" required
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-primary outline-none"
                      value={ms.deadline} onChange={e => {
                        const newMs = [...form.milestones];
                        newMs[index].deadline = e.target.value;
                        setForm({...form, milestones: newMs});
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input 
                      placeholder="交付物要求描述"
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-primary outline-none"
                      value={ms.deliverableDesc} onChange={e => {
                        const newMs = [...form.milestones];
                        newMs[index].deliverableDesc = e.target.value;
                        setForm({...form, milestones: newMs});
                      }}
                    />
                  </div>
                </div>
                {index > 0 && (
                  <button type="button" onClick={() => setForm({...form, milestones: form.milestones.filter((_, i) => i !== index)})} className="text-muted-foreground hover:text-destructive p-2">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={() => window.history.back()} className="px-8 py-4 rounded-xl font-bold border-2 border-border text-foreground hover:bg-muted transition-colors">
            取消
          </button>
          <button type="submit" disabled={isPending} className="px-10 py-4 rounded-xl font-bold bg-primary text-white shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50 text-lg">
            {isPending ? "发布中..." : "确认发布需求"}
          </button>
        </div>
      </form>
    </div>
  );
}
