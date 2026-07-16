import React, { useState } from "react";
import { Building2, User, CreditCard, FileText, CheckCircle2, Circle } from "lucide-react";

export function VariantB() {
  const [activeSection, setActiveSection] = useState("business");
  const [isEditMode, setIsEditMode] = useState(true);

  const sections = [
    { id: "business", label: "工商信息", icon: <Building2 className="w-4 h-4 mr-2" />, completed: true },
    { id: "contact", label: "联系信息", icon: <User className="w-4 h-4 mr-2" />, completed: true },
    { id: "finance", label: "财务信息", icon: <CreditCard className="w-4 h-4 mr-2" />, completed: false },
    { id: "intro", label: "企业介绍", icon: <FileText className="w-4 h-4 mr-2" />, completed: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">
            星
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">企业信息</h1>
            <p className="text-sm text-slate-500 leading-tight">北京星火教育科技有限公司</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">当前处于</span>
          <div className="flex bg-slate-100 rounded-md p-1">
            <button 
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${!isEditMode ? 'bg-white shadow-sm font-medium text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setIsEditMode(false)}
            >
              查看模式
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${isEditMode ? 'bg-white shadow-sm font-medium text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setIsEditMode(true)}
            >
              编辑模式
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex max-w-6xl w-full mx-auto p-6 gap-6">
        
        {/* Left Sidebar */}
        <aside className="w-[220px] shrink-0">
          <nav className="sticky top-[100px] flex flex-col gap-1">
            <div className="mb-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              信息完善进度 2/4
            </div>
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive 
                      ? "bg-blue-50 text-blue-600 font-medium" 
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center">
                    {section.icon}
                    {section.label}
                  </div>
                  <div className="flex items-center">
                    {section.completed ? (
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {activeSection === "business" && (
              <div className="p-8">
                <div className="mb-6 pb-4 border-b border-slate-100">
                  <h2 className="text-xl font-semibold text-slate-900">工商信息</h2>
                  <p className="text-sm text-slate-500 mt-1">请确保证照信息与营业执照一致，用于平台认证与开票。</p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">企业名称 <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      defaultValue="北京星火教育科技有限公司" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">统一社会信用代码 <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      defaultValue="91110000MA01XXXXXX" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">纳税识别号</label>
                    <input 
                      type="text" 
                      defaultValue="91110000MA01XXXXXX" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                    <p className="text-xs text-slate-400 mt-1">如与统一社会信用代码一致可不填</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">所属行业 <span className="text-red-500">*</span></label>
                    <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow appearance-none">
                      <option>教育培训 / AI 培训</option>
                      <option>互联网 / 软件开发</option>
                      <option>文化传媒 / 广告</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">成立年份</label>
                      <input 
                        type="text" 
                        defaultValue="2018" 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">团队规模</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow appearance-none">
                        <option>51-200人</option>
                        <option>1-50人</option>
                        <option>201-500人</option>
                        <option>500人以上</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">营业执照附件 <span className="text-red-500">*</span></label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                      <div className="space-y-1 text-center">
                        <FileText className="mx-auto h-12 w-12 text-slate-300" />
                        <div className="flex text-sm text-slate-600 justify-center">
                          <span className="relative rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                            上传文件
                          </span>
                          <p className="pl-1">或拖拽文件到此处</p>
                        </div>
                        <p className="text-xs text-slate-500">支持 JPG, PNG, PDF 格式，不超过 10MB</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium">
                    取消
                  </button>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                    保存工商信息
                  </button>
                </div>
              </div>
            )}
            
            {activeSection !== "business" && (
              <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                <FileText className="w-12 h-12 mb-4 text-slate-200" />
                <p>当前处于 {sections.find(s => s.id === activeSection)?.label} 章节</p>
                <p className="text-sm mt-2 text-slate-400">仅作示例，暂不展示详细字段</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default VariantB;
