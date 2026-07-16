import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Building2, Phone, CreditCard, FileText } from "lucide-react";

export function VariantA() {
  const data = {
    business: {
      name: "北京星火教育科技有限公司",
      creditCode: "91110000MA01XXXXXX",
      taxId: "91110000MA01XXXXXX",
      industry: "教育培训 / AI 培训",
      foundedYear: "2018",
      teamSize: "51-200人",
    },
    contact: {
      contactPerson: "张伟",
      phone: "13800138000",
      address: "北京市朝阳区建国路88号SOHO现代城C座1201室",
      email: "contact@xhkj.com",
      website: "https://xhkj.com",
      region: "北京市朝阳区",
    },
    financial: {
      bankName: "中国工商银行北京建国路支行",
      bankAccount: "6222021234567890123",
    },
    introduction:
      "北京星火教育科技有限公司成立于2018年，是一家专注于企业AI培训和数字化转型解决方案的科技公司。公司拥有资深师资团队和完善的课程体系，已为300+家政企客户提供定制化培训服务。",
  };

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex flex-col space-y-1.5">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-base text-slate-900">
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-slate-200/60 gap-4">
          <div className="flex items-center space-x-6">
            <div className="h-20 w-20 rounded-full border border-slate-100 shadow-sm bg-blue-50 flex items-center justify-center text-blue-600 text-2xl font-bold shrink-0">
              {data.business.name.substring(0, 1)}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {data.business.name}
                </h1>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-none font-medium px-2.5 py-0.5">
                  {data.business.industry}
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-500">
                统一社会信用代码：{data.business.creditCode}
              </p>
            </div>
          </div>
          <Button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm shrink-0">
            <Pencil className="mr-2 h-4 w-4" />
            编辑信息
          </Button>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          {/* Business Info */}
          <Card className="border-slate-200/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white pb-4">
              <CardTitle className="text-lg font-semibold flex items-center text-slate-800">
                <Building2 className="mr-2 h-5 w-5 text-blue-600" />
                工商信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <Field label="公司名称" value={data.business.name} />
                <Field label="统一社会信用代码" value={data.business.creditCode} />
                <Field label="纳税识别号" value={data.business.taxId} />
                <Field label="所属行业" value={data.business.industry} />
                <Field label="成立年份" value={data.business.foundedYear} />
                <Field label="团队规模" value={data.business.teamSize} />
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="border-slate-200/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white pb-4">
              <CardTitle className="text-lg font-semibold flex items-center text-slate-800">
                <Phone className="mr-2 h-5 w-5 text-blue-600" />
                联系信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <Field label="联系人" value={data.contact.contactPerson} />
                <Field label="联系电话" value={data.contact.phone} />
                <Field label="联系邮箱" value={data.contact.email} />
                <Field label="官方网站" value={data.contact.website} />
                <Field label="所在地区" value={data.contact.region} />
                <Field label="联系地址" value={data.contact.address} />
              </div>
            </CardContent>
          </Card>

          {/* Financial Info */}
          <Card className="border-slate-200/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white pb-4">
              <CardTitle className="text-lg font-semibold flex items-center text-slate-800">
                <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
                财务信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <Field label="开户银行" value={data.financial.bankName} />
                <Field label="账号" value={data.financial.bankAccount} />
              </div>
            </CardContent>
          </Card>

          {/* Company Intro */}
          <Card className="border-slate-200/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white pb-4">
              <CardTitle className="text-lg font-semibold flex items-center text-slate-800">
                <FileText className="mr-2 h-5 w-5 text-blue-600" />
                企业介绍
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
                {data.introduction || "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default VariantA;