#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""软著申请 - 用户操作手册\"""

import os, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
pdfmetrics.registerFont(UnicodeCIDFont("MSung-Light"))
FN = "STSong-Light"
FB = "MSung-Light"

C1 = colors.HexColor("#1a3a6b")
C2 = colors.HexColor("#2c5aa0")
CA = colors.HexColor("#eef2f8")
CG = colors.HexColor("#c0c8d8")
CGR= colors.HexColor("#666666")
W, H = A4

def sty(n,**k): return ParagraphStyle(n,**k)
S={
    "cov_t": sty("cov_t",fontName=FB,fontSize=22,alignment=TA_CENTER,leading=34,textColor=C1,spaceAfter=8),
    "cov_s": sty("cov_s",fontName=FN,fontSize=13,alignment=TA_CENTER,leading=20,textColor=CGR,spaceAfter=6),
    "cov_i": sty("cov_i",fontName=FN,fontSize=11,alignment=TA_CENTER,leading=18,textColor=CGR),
    "h1":    sty("h1",   fontName=FB,fontSize=15,textColor=C1,leading=24,spaceBefore=18,spaceAfter=8),
    "h2":    sty("h2",   fontName=FB,fontSize=12,textColor=C2,leading=20,spaceBefore=12,spaceAfter=6),
    "h3":    sty("h3",   fontName=FB,fontSize=10.5,textColor=colors.HexColor("#333"),leading=18,spaceBefore=8,spaceAfter=4),
    "body":  sty("body", fontName=FN,fontSize=10,alignment=TA_JUSTIFY,leading=18,spaceAfter=4),
    "bul":   sty("bul",  fontName=FN,fontSize=10,alignment=TA_LEFT,leading=18,spaceAfter=3,leftIndent=14),
    "step":  sty("step", fontName=FN,fontSize=10,alignment=TA_LEFT,leading=18,spaceAfter=4,leftIndent=22),
    "tip":   sty("tip",  fontName=FN,fontSize=9.5,alignment=TA_LEFT,leading=16,spaceAfter=4,
                 leftIndent=10,textColor=colors.HexColor("#2c5aa0"),backColor=colors.HexColor("#f0f5ff"),
                 borderPadding=4),
    "warn":  sty("warn", fontName=FN,fontSize=9.5,alignment=TA_LEFT,leading=16,spaceAfter=4,
                 leftIndent=10,textColor=colors.HexColor("#8b3a00"),backColor=colors.HexColor("#fff8f0"),
                 borderPadding=4),
    "th":    sty("th",   fontName=FB,fontSize=9,alignment=TA_CENTER,leading=14,textColor=colors.white),
    "tc":    sty("tc",   fontName=FN,fontSize=8.5,alignment=TA_LEFT,leading=13),
    "foot":  sty("foot", fontName=FN,fontSize=7.5,alignment=TA_CENTER,leading=12,textColor=CGR),
    "toc":   sty("toc",  fontName=FN,fontSize=10,alignment=TA_LEFT,leading=18,spaceAfter=2),
    "tocpg": sty("tocpg",fontName=FN,fontSize=10,alignment=TA_CENTER,leading=18,spaceAfter=2),
    "cih":   sty("cih",  fontName=FB,fontSize=11,alignment=TA_CENTER,leading=18,textColor=C1),
    "civ":   sty("civ",  fontName=FN,fontSize=11,alignment=TA_LEFT,leading=18),
}

def H1(t): return Paragraph(t, S["h1"])
def H2(t): return Paragraph(t, S["h2"])
def H3(t): return Paragraph(t, S["h3"])
def P(t):  return Paragraph(t, S["body"])
def B(t):  return Paragraph(u"\u2022 " + t, S["bul"])
def Step(n,t): return Paragraph(u"(%s) %s" % (n, t), S["step"])
def Tip(t):  return Paragraph(u"\u2139 " + t, S["tip"])
def Warn(t): return Paragraph(u"\u26a0 " + t, S["warn"])
def SP(n=1): return Spacer(1, n*0.3*cm)
def HR():    return HRFlowable(width="100%",thickness=0.5,color=CG,spaceAfter=4)

def tbl(headers, rows, widths=None):
    data = [[Paragraph(h,S["th"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(v),S["tc"]) for v in row])
    ts = TableStyle([
        ("BACKGROUND",(0,0),(-1,0),C1),
        ("FONTNAME",(0,0),(-1,-1),FN),("FONTNAME",(0,0),(-1,0),FB),
        ("FONTSIZE",(0,0),(-1,-1),8.5),("FONTSIZE",(0,0),(-1,0),9),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,CA]),
        ("GRID",(0,0),(-1,-1),0.4,CG),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
    ])
    t = Table(data, colWidths=widths)
    t.setStyle(ts)
    return t

def on_page(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(C1)
        canvas.rect(1.5*cm,H-1.5*cm,W-3*cm,0.25*cm,fill=1,stroke=0)
        canvas.setFont(FN,7.5); canvas.setFillColor(CGR)
        canvas.drawString(1.5*cm,H-1.9*cm,u"接单吧 OPC撮合交易平台  用户操作手册  V1.0")
        canvas.drawRightString(W-1.5*cm,H-1.9*cm,u"软件著作权申请材料\")
        canvas.setFillColor(CG)
        canvas.line(1.5*cm,1.4*cm,W-1.5*cm,1.4*cm)
        canvas.setFont(FN,7.5); canvas.setFillColor(CGR)
        canvas.drawCentredString(W/2,0.9*cm,u"第 %d 页\" % doc.page)
    canvas.restoreState()

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   u"接单吧OPC撮合交易平台_用户操作手册_V1.0.pdf")

def build():
    story = []
    today = datetime.date.today().strftime("%Y-%m-%d")

    # 封面
    story += [Spacer(1,3*cm),
              Paragraph(u"用 户 操 作 手 册\",S["cov_t"]),
              HRFlowable(width="60%",thickness=2,color=C1,spaceAfter=14),
              Paragraph(u"接单吧 OPC撮合交易平台\",S["cov_s"]),
              Spacer(1,3.5*cm)]
    ct = Table([[Paragraph(r[0],S["cih"]),Paragraph(r[1],S["civ"])] for r in [
        [u"软件名称\",u"接单吧 OPC撮合交易平台"],
        [u"版本号\",  u"V1.0"],
        [u"文档编号\",u"JDB-UM-2026-001"],
        [u"适用角色\",u"公众访客 / OPC服务商 / 发布方 / 管理员"],
        [u"编制日期\",today],
    ]],colWidths=[5*cm,9*cm])
    ct.setStyle(TableStyle([
        ("GRID",(0,0),(-1,-1),0.5,CG),
        ("BACKGROUND",(0,0),(0,-1),CA),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),10),
    ]))
    story += [ct, PageBreak()]

    # 目录
    story.append(H1(u"目  录\"))
    toc_items = [
        ("1","引言\","3"),
        ("1.1","编写目的\","3"),
        ("1.2","适用对象\","3"),
        ("1.3","运行环境\","3"),
        ("1.4","文档结构\","4"),
        ("2","软件概述\","4"),
        ("2.1","平台简介\","4"),
        ("2.2","主要功能\","4"),
        ("2.3","用户角色说明\","5"),
        ("3","注册与登录\","6"),
        ("3.1","用户注册\","6"),
        ("3.2","用户登录\","7"),
        ("3.3","修改密码\","7"),
        ("3.4","忘记密码\","8"),
        ("4","OPC 服务商使用指南\","8"),
        ("4.1","完善个人资料\","8"),
        ("4.2","浏览接单大厅与投标\","9"),
        ("4.3","订单执行与交付\","11"),
        ("4.4","财务结算\","13"),
        ("4.5","大赛报名与参赛\","14"),
        ("4.6","个人作品集管理\","16"),
        ("5","发布方使用指南\","17"),
        ("5.1","完善机构资料\","17"),
        ("5.2","发布需求\","18"),
        ("5.3","查看投标与选定 OPC","20"),
        ("5.4","合同签署\","21"),
        ("5.5","支付管理\","22"),
        ("5.6","交付验收\","23"),
        ("5.7","工单发起\","24"),
        ("6","管理员使用指南\","25"),
        ("6.1","登录管理后台\","25"),
        ("6.2","数据看板\","25"),
        ("6.3","用户审核\","26"),
        ("6.4","需求审核\","27"),
        ("6.5","V2 业务全流程管理\","27"),
        ("6.6","大赛与题库管理\","30"),
        ("6.7","AI 智能体配置\","32"),
        ("6.8","系统配置\","33"),
        ("7","常见问题解答（FAQ）\","34"),
    ]
    ind = u"\u3000\u3000"
    toc_rows = [[Paragraph((""if len(n)==1 else ind)+n+u"\u3000"+t,S["toc"]),
                 Paragraph(p,S["tocpg"])] for n,t,p in toc_items]
    tt = Table(toc_rows,colWidths=[13.5*cm,1.5*cm])
    tt.setStyle(TableStyle([
        ("LINEBELOW",(0,0),(-1,-1),0.3,colors.HexColor("#dddddd")),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
    ]))
    story += [tt, PageBreak()]

    # ══ 第 1 章 引言 ══════════════════════════════════════════════════════════
    story.append(H1(u"1  引言\"))

    story.append(H2(u"1.1  编写目的\"))
    story.append(P(u"本手册旨在为接单吧 OPC撮合交易平台（以下简称\"平台\"）的各类用户提供完整、清晰的操作指导，帮助用户快速上手并高效使用平台的各项功能。\"))
    story.append(SP())

    story.append(H2(u"1.2  适用对象\"))
    story.append(tbl([u"适用角色\",u"主要使用场景"],[
        [u"公众/访客\",  u"浏览平台公开内容，了解平台功能，完成注册"],
        [u"OPC 服务商\", u"接单投标、执行订单、提交交付物、参加大赛、申请结算"],
        [u"发布方\",     u"发布需求、选定 OPC、签署合同、支付验收"],
        [u"管理员\",     u"平台全流程运营管理、用户审核、财务审批、系统配置"],
    ],widths=[3.5*cm,11.5*cm]))
    story.append(SP())

    story.append(H2(u"1.3  运行环境\"))
    story.append(tbl([u"环境\",u"要求"],[
        [u"操作系统\",   u"Windows 10+、macOS 12+、iOS 16+、Android 10+"],
        [u"浏览器\",     u"Chrome 109+（推荐）、Edge 109+、Firefox 108+、Safari 16+"],
        [u"网络\",       u"需要连接互联网，带宽建议 4Mbps 以上"],
        [u"屏幕分辨率\", u"1280×720 及以上（响应式布局，支持手机/平板访问）"],
        [u"JavaScript", u"必须在浏览器中启用 JavaScript"],
    ],widths=[3.5*cm,11.5*cm]))
    story.append(SP())

    story.append(H2(u"1.4  文档结构\"))
    story.append(P(u"本手册按用户角色分章节组织：第 3 章介绍全角色通用的注册与登录操作；第 4-6 章分别针对 OPC 服务商、发布方和管理员详述各功能模块的操作步骤；第 7 章收录常见问题解答。\"))
    story.append(PageBreak())

    # ══ 第 2 章 软件概述 ══════════════════════════════════════════════════════
    story.append(H1(u"2  软件概述\"))

    story.append(H2(u"2.1  平台简介\"))
    story.append(P(u"接单吧 OPC撮合交易平台是一款面向企业级外包服务市场的 B/S 架构 Web 应用系统，通过互联网连接有外包需求的发布方（甲方）与具备专业服务能力的 OPC（服务商），实现需求发布、智能撮合、电子合同、交付验收、财务结算的全流程数字化管理。\"))
    story.append(SP())
    story.append(P(u"平台地址：通过管理员提供的系统网址，使用现代浏览器直接访问，无需安装任何客户端软件。\"))
    story.append(SP())

    story.append(H2(u"2.2  主要功能\"))
    story.append(tbl([u"功能模块\",u"简介"],[
        [u"需求发布与撮合\", u"发布方在线发布外包需求，OPC 自主投标，平台智能撮合确认中标"],
        [u"电子合同\",       u"撮合成功后自动生成电子合同，双方在线签署，全程留痕"],
        [u"交付管理\",       u"OPC 按里程碑上传交付物，发布方在线验收，系统记录全程"],
        [u"财务结算\",       u"平台担保交易，验收通过后按规则释放款项，OPC 在线申请结算"],
        [u"大赛认证\",       u"平台举办 OPC 综合能力大赛，通过标准化测评建立能力等级体系"],
        [u"AI 智能体\",      u"AI 辅助需求分析、自动生成摘要与演示 Demo，提升撮合效率"],
        [u"工单售后\",       u"执行争议时可发起工单，平台管理员介入仲裁调解"],
        [u"社区内容\",       u"OPC 发布案例动态，平台发布培训文章，构建行业交流社区"],
    ],widths=[3.5*cm,11.5*cm]))
    story.append(SP())

    story.append(H2(u"2.3  用户角色说明\"))
    story.append(tbl([u"角色\",u"开通方式",u"核心权限"],[
        [u"公众/访客\",  u"无需注册", u"浏览首页、需求大厅、作品集、学习中心、大赛公告等公开内容"],
        [u"OPC 服务商\", u"注册 → 管理员审核通过",u"接单投标、执行订单、大赛参赛、结算申请"],
        [u"发布方\",     u"注册 → 管理员审核通过",u"发布需求、选标、签合同、支付、验收"],
        [u"管理员\",     u"系统预置账号",          u"全平台运营管理，拥有最高权限"],
    ],widths=[2.8*cm,3.5*cm,8.7*cm]))
    story.append(PageBreak())

    # ══ 第 3 章 注册与登录 ════════════════════════════════════════════════════
    story.append(H1(u"3  注册与登录\"))

    story.append(H2(u"3.1  用户注册\"))
    story.append(P(u"OPC 服务商与发布方均需注册账号后，由管理员审核通过方可使用业务功能。\"))
    story.append(SP())
    story.append(H3(u"操作步骤\"))
    for n,t in [
        ("1",u"在浏览器中打开平台网址，点击页面右上角【注册】按钮\"),
        ("2",u"选择注册角色：【OPC 服务商】或【发布方】（注册后不可更改）\"),
        ("3",u"填写以下必填信息：昵称、手机号、邮箱地址、登录密码（8位以上，含字母与数字）\"),
        ("4",u"点击【发送验证码】，系统向手机号发送 6 位短信验证码（60 秒有效）\"),
        ("5",u"填写收到的验证码，点击【立即注册】\"),
        ("6",u"注册成功后自动跳转至工作台，显示【待审核】状态提示\"),
        ("7",u"等待管理员审核（通常 1 个工作日内），审核通过后手机收到通知短信\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(Tip(u"提示：同一手机号和邮箱只能注册一个账号。请使用常用手机号，审核结果将通过短信通知。\"))
    story.append(Warn(u"注意：注册完成后，管理员审核通过前，部分业务功能暂不可用。\"))
    story.append(SP())

    story.append(H2(u"3.2  用户登录\"))
    for n,t in [
        ("1",u"打开平台网址，点击【登录】按钮\"),
        ("2",u"在登录弹窗中选择角色（OPC / 发布方 / 管理员）\"),
        ("3",u"输入注册时使用的邮箱地址或手机号\"),
        ("4",u"输入登录密码，点击【登录】\"),
        ("5",u"登录成功后自动跳转至对应角色的工作台首页\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(Tip(u"提示：登录凭证支持邮箱或手机号，两者均为注册时填写的信息。\"))
    story.append(Warn(u"注意：连续 10 次密码错误将触发账号临时锁定（15 分钟），请注意保管密码。\"))
    story.append(SP())

    story.append(H2(u"3.3  修改密码\"))
    for n,t in [
        ("1",u"登录后，点击页面右上角头像，选择【账号设置】\"),
        ("2",u"在【安全设置】区域点击【修改密码】\"),
        ("3",u"依次输入【当前密码】和【新密码】（新密码需 8 位以上，含字母与数字）\"),
        ("4",u"再次输入新密码确认，点击【确认修改】\"),
        ("5",u"修改成功后系统自动退出登录，使用新密码重新登录\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())

    story.append(H2(u"3.4  忘记密码\"))
    for n,t in [
        ("1",u"在登录页面点击【忘记密码】链接\"),
        ("2",u"输入注册时填写的邮箱地址，点击【发送重置邮件】\"),
        ("3",u"登录邮箱，查收来自平台的邮件，邮件中包含临时密码\"),
        ("4",u"使用临时密码登录，系统提示修改密码\"),
        ("5",u"按 3.3 节步骤修改为新密码\"),
    ]:
        story.append(Step(n,t))
    story.append(PageBreak())

    # ══ 第 4 章 OPC 服务商使用指南 ════════════════════════════════════════════
    story.append(H1(u"4  OPC 服务商使用指南\"))

    story.append(H2(u"4.1  完善个人资料\"))
    story.append(P(u"首次登录后，建议先完善个人资料，资料质量直接影响发布方的选标决策。\"))
    story.append(H3(u"4.1.1  基本信息\"))
    for n,t in [
        ("1",u"登录后进入【个人资料】页面（顶部导航栏 → 头像 → 个人资料）\"),
        ("2",u"点击头像区域上传个人头像（建议正式照片，JPG/PNG，不超过 2MB）\"),
        ("3",u"填写【个人简介】，简述专业背景与核心能力（建议 100-300 字）\"),
        ("4",u"填写【所在城市】、【从业年限】、【个人网站】（可选）\"),
        ("5",u"在【技能标签】处点击添加，从系统预设标签中选择擅长技能（最多 10 个）\"),
        ("6",u"点击【保存】完成资料更新\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.1.2  收款信息（结算必填）\"))
    story.append(P(u"在申请财务结算前，必须提前维护收款银行信息：\"))
    for n,t in [
        ("1",u"进入【个人资料】→ 【收款信息】区域\"),
        ("2",u"填写真实姓名、银行卡号、开户银行名称、开户支行\"),
        ("3",u"点击【保存收款信息】\"),
    ]:
        story.append(Step(n,t))
    story.append(Warn(u"注意：收款信息必须与银行卡实名信息一致，填写错误将导致结算打款失败。\"))
    story.append(SP(2))

    story.append(H2(u"4.2  浏览接单大厅与投标\"))
    story.append(P(u"接单大厅是 OPC 发现外包需求并提交投标的核心功能区。\"))
    story.append(SP())
    story.append(H3(u"4.2.1  浏览需求\"))
    for n,t in [
        ("1",u"在左侧导航栏点击【接单大厅】，进入需求列表页面\"),
        ("2",u"使用顶部筛选栏按需过滤：需求类别（CAT 赛道）、预算区间、截止时间、紧急程度\"),
        ("3",u"需求卡片展示标题、类别标签、预算范围、投标截止时间、当前投标数等关键信息\"),
        ("4",u"点击需求卡片或【查看详情】按钮，进入需求详情页\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.2.2  需求详情页说明\"))
    story.append(tbl([u"区域\",u"内容说明"],[
        [u"需求概述\",   u"标题、类别、发布方机构名称、发布时间、紧急标记"],
        [u"需求描述\",   u"完整需求说明（Markdown 渲染），包含背景、目标、交付要求等"],
        [u"里程碑计划\", u"分阶段的交付节点与对应款项比例"],
        [u"预算与截止\", u"预算范围（元）、交付截止日期、投标截止时间"],
        [u"资质要求\",   u"要求 OPC 的最低等级（如 C 级及以上）"],
        [u"附件\",       u"发布方上传的参考文件（可下载查看）"],
        [u"投标按钮\",   u"资质满足时显示【立即投标】按钮，否则显示资质不足提示"],
    ],widths=[3*cm,12*cm]))
    story.append(SP())
    story.append(H3(u"4.2.3  提交投标\"))
    for n,t in [
        ("1",u"在需求详情页点击【立即投标】按钮（系统自动校验 OPC 等级资质）\"),
        ("2",u"填写投标信息：\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"字段\",u"说明",u"是否必填"],[
        [u"投标总价\",   u"对本需求的总报价（元），建议在预算范围内",   u"必填"],
        [u"分项报价\",   u"各里程碑/工作内容的分项价格说明",            u"推荐"],
        [u"预计周期\",   u"从接单到完成交付所需的工作天数",             u"必填"],
        [u"服务方案\",   u"详细阐述解决方案、工作思路、交付成果（建议附上过往案例说明）",u"必填"],
        [u"投标附件\",   u"相关作品集、案例文件（支持 PDF/Word/图片，多选）",u"可选"],
    ],widths=[2.8*cm,7.2*cm,2*cm]))
    for n,t in [
        ("3",u"检查填写内容无误后，点击【提交投标】\"),
        ("4",u"提交成功后，在【我的投标】列表可查看该投标的当前状态\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(Tip(u"提示：同一需求只能提交一份投标，请谨慎填写后再提交。投标截止前可在【我的投标】中修改内容。\"))
    story.append(SP())
    story.append(H3(u"4.2.4  投标状态说明\"))
    story.append(tbl([u"状态\",u"含义",u"后续操作"],[
        [u"待审核\",   u"投标已提交，等待发布方查看",       u"可修改投标（截止前）"],
        [u"入围\",     u"发布方已关注此投标",               u"等待最终选标结果"],
        [u"中标\",     u"被选中，成为执行方",               u"确认接受 → 进入合同环节"],
        [u"落标\",     u"本次未被选中",                     u"无需操作"],
        [u"已取消\",   u"需求撤销或已超过投标截止时间",     u"无需操作"],
    ],widths=[2.5*cm,5.5*cm,7*cm]))
    story.append(SP(2))

    story.append(H2(u"4.3  订单执行与交付\"))
    story.append(P(u"中标并签署合同后，OPC 进入订单执行阶段，需按里程碑节点提交交付物。\"))
    story.append(SP())
    story.append(H3(u"4.3.1  查看我的订单\"))
    for n,t in [
        ("1",u"在左侧导航栏点击【我的订单】，进入订单列表页\"),
        ("2",u"订单卡片展示：订单编号、需求标题、发布方名称、合同金额、当前状态、剩余天数\"),
        ("3",u"点击订单卡片，进入订单详情页\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.3.2  订单详情页说明\"))
    story.append(tbl([u"区域\",u"内容说明"],[
        [u"订单概要\",     u"订单编号、合同金额、当前状态、里程碑进度条"],
        [u"里程碑列表\",   u"各阶段名称、截止日期、对应款项金额与当前状态"],
        [u"交付物记录\",   u"历次提交的交付物及发布方的验收意见"],
        [u"合同详情\",     u"合同编号、签署时间、合同正文链接"],
        [u"支付计划\",     u"各阶段付款状态（发布方已付/待付/已到账）"],
    ],widths=[3*cm,12*cm]))
    story.append(SP())
    story.append(H3(u"4.3.3  提交交付物\"))
    for n,t in [
        ("1",u"在订单详情页，找到当前需要交付的里程碑节点，点击【提交交付物】\"),
        ("2",u"填写交付物标题（简要说明本次交付内容）\"),
        ("3",u"上传文件：点击【选择文件】或将文件拖入上传区，支持同时选择多个文件\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"支持格式\",u"大小限制"],[
        [u"PDF、Word（.docx）、Excel（.xlsx）、PowerPoint（.pptx）\",u"每个文件不超过 50MB"],
        [u"图片（JPG、PNG、GIF）\",                                  u"每个文件不超过 10MB"],
        [u"压缩包（ZIP、RAR、7Z）\",                                 u"每个文件不超过 100MB"],
        [u"视频（MP4、WebM）\",                                      u"每个文件不超过 500MB"],
    ],widths=[9*cm,6*cm]))
    for n,t in [
        ("4",u"如有在线演示链接，在【在线链接】栏填写网址\"),
        ("5",u"在【交付说明】中填写本次交付的说明（交付内容、注意事项、使用指引等）\"),
        ("6",u"确认无误后点击【确认提交】\"),
        ("7",u"提交成功后，发布方收到验收通知，订单状态变为【待验收】\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.3.4  处理验收反馈\"))
    story.append(P(u"发布方验收后，结果通过站内通知推送：\"))
    story.append(B(u"验收通过：里程碑状态更新为已完成，对应款项进入结算队列，OPC 可申请结算；\"))
    story.append(B(u"验收不通过：通知中包含发布方填写的修改意见，OPC 根据意见修改后重新提交（步骤同上，系统自动记录提交次数）；\"))
    story.append(B(u"若对验收结果有异议，可发起工单（参见第 4.6 节工单相关内容）。\"))
    story.append(SP(2))

    story.append(H2(u"4.4  财务结算\"))
    story.append(H3(u"4.4.1  查看收入明细\"))
    for n,t in [
        ("1",u"在左侧导航栏点击【收入结算】\"),
        ("2",u"【收入明细】标签页展示：订单编号、应收金额、平台服务费、实收净额、状态\"),
        ("3",u"支持按订单、日期范围筛选；点击【导出账单】可下载 Excel 流水表\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.4.2  申请结算\"))
    for n,t in [
        ("1",u"确认收款信息已在【个人资料】中填写完整\"),
        ("2",u"在【待结算】列表中，选择要结算的款项，点击【申请结算】\"),
        ("3",u"核对结算金额（系统自动扣除平台服务费），确认后点击【提交申请】\"),
        ("4",u"管理员审核后（通常 3 个工作日内），款项打入登记的银行账户\"),
        ("5",u"结算完成后，通过站内通知与短信收到到账提醒\"),
    ]:
        story.append(Step(n,t))
    story.append(Tip(u"提示：每笔结算会扣除平台服务费（具体比例见平台公告），实收金额以结算申请页面显示为准。\"))
    story.append(SP(2))

    story.append(H2(u"4.5  大赛报名与参赛\"))
    story.append(H3(u"4.5.1  查看大赛\"))
    for n,t in [
        ("1",u"在顶部导航栏点击【大赛专区】或访问平台首页的大赛入口\"),
        ("2",u"大赛列表展示：大赛名称、关联赛道（CAT 类别）、报名时间、参赛要求、奖励说明\"),
        ("3",u"点击大赛卡片查看完整大赛详情\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.5.2  报名参赛\"))
    for n,t in [
        ("1",u"在大赛详情页，确认报名截止时间尚未过期\"),
        ("2",u"点击目标赛道旁的【报名参赛】按钮（系统自动校验 OPC 账号资质）\"),
        ("3",u"填写参赛信息（如有），确认后点击【提交报名】\"),
        ("4",u"报名成功后在【我的大赛】列表可查看报名状态\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.5.3  在线测评答题\"))
    for n,t in [
        ("1",u"答题期开始后，在【我的大赛】→ 对应大赛 → 点击【开始答题】\"),
        ("2",u"答题页面展示题目内容（支持 Markdown 格式、附件查看）\"),
        ("3",u"依次作答（单选题选择一项，多选题选择多项）\"),
        ("4",u"题目支持保存草稿（点击【暂存】），可在截止前多次返回修改\"),
        ("5",u"确认所有题目作答完毕后，点击【最终提交】（提交后不可修改）\"),
        ("6",u"提交成功后系统显示提交时间，成绩将在大赛结束后公布\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.5.4  提交实操作品（部分赛道要求）\"))
    for n,t in [
        ("1",u"在【我的大赛】→ 对应大赛 → 点击【提交作品】\"),
        ("2",u"选择作品文件上传（支持多文件，同时可填写在线演示链接）\"),
        ("3",u"填写作品说明，点击【提交作品】\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.5.5  查看成绩与证书\"))
    story.append(B(u"大赛结束后，在【我的大赛】→ 对应大赛详情 → 查看【成绩详情】，包含测评分、作品分、综合排名；\"))
    story.append(B(u"获得 A/B/C 级认证的 OPC，可在【我的证书】查看并下载电子证书；\"))
    story.append(B(u"证书自动展示于个人作品集公开页面，信用积分同步更新。\"))
    story.append(SP(2))

    story.append(H2(u"4.6  个人作品集管理\"))
    story.append(H3(u"4.6.1  添加作品\"))
    for n,t in [
        ("1",u"进入【个人中心】→ 【作品集】→ 点击【+ 添加作品】\"),
        ("2",u"填写作品标题、类型（如产品设计、开发项目、运营案例等）\"),
        ("3",u"填写作品描述（可使用 Markdown 格式）\"),
        ("4",u"上传作品封面图（推荐比例 16:9）\"),
        ("5",u"上传作品文件或填写在线演示链接\"),
        ("6",u"设置显示状态：【公开】（显示于公开作品集页）或【私密】（仅自己可见）\"),
        ("7",u"点击【保存】完成添加\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"4.6.2  管理作品\"))
    story.append(B(u"编辑作品：在作品列表点击作品卡片右上角的【编辑】图标，修改内容后保存；\"))
    story.append(B(u"删除作品：点击【删除】图标，确认后永久删除（不可恢复）；\"))
    story.append(B(u"调整顺序：拖拽作品卡片可调整在公开页面的展示顺序。\"))
    story.append(PageBreak())

    # ══ 第 5 章 发布方使用指南 ════════════════════════════════════════════════
    story.append(H1(u"5  发布方使用指南\"))

    story.append(H2(u"5.1  完善机构资料\"))
    story.append(P(u"发布方账号审核通过后，建议先完善机构资料，以便 OPC 了解甲方背景，提升选标质量。\"))
    for n,t in [
        ("1",u"进入【机构资料】页面（顶部导航 → 头像 → 机构资料）\"),
        ("2",u"上传公司/机构 Logo"),
        ("3",u"填写公司描述（主营业务、规模、需求偏好）\"),
        ("4",u"填写所在地区、所属行业、团队规模、成立年份、官网地址\"),
        ("5",u"填写联系人姓名、联系邮箱\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"5.1.1  发票信息（结算必填）\"))
    story.append(P(u"如需开具发票，在机构资料页面填写：\"))
    story.append(tbl([u"字段\",u"说明"],[
        [u"发票类型\",         u"增值税专用发票 / 增值税普通发票"],
        [u"公司全称（抬头）\", u"与营业执照一致的公司名称"],
        [u"税务登记号\",       u"18 位统一社会信用代码"],
        [u"开票地址\",         u"公司注册地址"],
        [u"开户银行\",         u"基本账户开户银行名称"],
        [u"银行账号\",         u"基本账户银行账号"],
    ],widths=[4*cm,11*cm]))
    story.append(SP(2))

    story.append(H2(u"5.2  发布需求\"))
    story.append(P(u"发布需求是发布方使用平台的核心操作，需填写完整的需求信息以吸引优质 OPC 投标。\"))
    story.append(SP())
    story.append(H3(u"5.2.1  创建需求\"))
    for n,t in [
        ("1",u"在左侧导航栏点击【发布需求】或工作台首页的【+ 新建需求】按钮\"),
        ("2",u"选择需求类别（CAT 赛道，如产品设计、技术开发、市场营销等）\"),
        ("3",u"填写需求标题（简洁明确，建议 20-50 字）\"),
        ("4",u"在需求描述编辑器中填写详细内容：\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"描述要素\",u"建议内容"],[
        [u"背景说明\",   u"项目背景、业务目标、当前痛点"],
        [u"工作内容\",   u"具体需要 OPC 完成的工作项与范围"],
        [u"交付物\",     u"需要提交的成果物（文档/代码/设计稿/报告等）"],
        [u"验收标准\",   u"如何评判交付物是否合格"],
        [u"注意事项\",   u"特殊要求或限制条件"],
    ],widths=[3*cm,12*cm]))
    story.append(Tip(u"提示：需求描述编辑器支持 Markdown 格式，可直接粘贴 Markdown 文本，标题/列表/表格自动渲染。\"))
    for n,t in [
        ("5",u"设置预算范围（预算下限与上限，单位：元）\"),
        ("6",u"设置交付截止日期（要求 OPC 完成交付的最终日期）\"),
        ("7",u"设置投标截止时间（OPC 可提交投标的截止时间，建议提前 3-7 天）\"),
        ("8",u"设置 OPC 资质要求（最低等级：不限 / C 级 / B 级 / A 级）\"),
        ("9",u"配置里程碑（可选）：\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"字段\",u"说明"],[
        [u"里程碑名称\", u"如「第一阶段：原型设计」、「第二阶段：代码开发」"],
        [u"截止日期\",   u"该阶段的完成截止时间"],
        [u"款项比例\",   u"该阶段对应的付款金额占总合同金额的百分比，所有阶段合计须为 100%"],
    ],widths=[3*cm,12*cm]))
    for n,t in [
        ("10",u"上传需求相关附件（如参考资料、规格说明、样例文件，支持多选）\"),
        ("11",u"选择发布模式：【公开招募】（向所有符合条件的 OPC 开放）或【定向邀请】（指定特定 OPC）\"),
        ("12",u"勾选是否标记为【紧急需求】（紧急需求在大厅优先展示）\"),
        ("13",u"点击【提交审核】将需求提交给管理员审核\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"5.2.2  需求状态流转\"))
    story.append(tbl([u"状态\",u"含义",u"可执行操作"],[
        [u"草稿\",   u"已创建但未提交",           u"继续编辑、提交审核"],
        [u"审核中\", u"已提交，等待管理员审核",   u"等待，不可编辑"],
        [u"已驳回\", u"审核不通过（查看原因）",   u"修改内容后重新提交"],
        [u"招募中\", u"审核通过，OPC 可投标",     u"查看投标、撤销需求"],
        [u"执行中\", u"已选定 OPC，合同签署完成", u"支付、验收交付物"],
        [u"已完成\", u"所有里程碑验收通过",       u"查看历史记录"],
        [u"已撤销\", u"主动撤销",                 u"无"],
    ],widths=[2.5*cm,4.5*cm,8*cm]))
    story.append(SP(2))

    story.append(H2(u"5.3  查看投标与选定 OPC"))
    for n,t in [
        ("1",u"需求进入【招募中】状态后，在需求详情页点击【查看投标】标签\"),
        ("2",u"投标列表展示所有已提交的投标，信息包含：OPC 昵称、等级、报价、周期、方案摘要\"),
        ("3",u"点击投标卡片可查看 OPC 的完整方案说明与附件\"),
        ("4",u"可点击 OPC 头像或昵称，跳转查看其公开作品集与历史评分\"),
        ("5",u"综合评估后，点击目标投标的【选定此 OPC】按钮\"),
        ("6",u"系统弹出确认弹窗，确认后：中标 OPC 收到通知，其余投标自动标记为落标\"),
        ("7",u"管理员确认撮合后，系统自动生成电子合同，进入合同签署环节\"),
    ]:
        story.append(Step(n,t))
    story.append(Tip(u"提示：选定 OPC 后将触发合同流程，请在充分评估投标内容后再做决定。\"))
    story.append(SP(2))

    story.append(H2(u"5.4  合同签署\"))
    for n,t in [
        ("1",u"收到【合同待签署】站内通知后，进入【合同管理】页面\"),
        ("2",u"找到状态为【待您签署】的合同，点击【查看合同】\"),
        ("3",u"仔细阅读合同全文（包含：甲乙方信息、服务内容、里程碑节点、付款计划、违约条款）\"),
        ("4",u"如需修改合同内容，点击【提出修改意见】，填写意见后提交管理员处理\"),
        ("5",u"确认无误后，点击【确认签署】按钮\"),
        ("6",u"系统记录签署时间，合同双方均签署后，订单正式进入【执行中】状态\"),
    ]:
        story.append(Step(n,t))
    story.append(Warn(u"重要提示：电子合同具有法律效力，请在签署前仔细核实合同中的金额、交付节点与验收标准。\"))
    story.append(SP(2))

    story.append(H2(u"5.5  支付管理\"))
    story.append(P(u"平台采用担保交易模式，发布方按合同约定的支付计划节点付款，款项由平台托管至验收通过后释放。\"))
    story.append(SP())
    story.append(H3(u"5.5.1  查看支付计划\"))
    for n,t in [
        ("1",u"进入对应需求/订单的详情页，点击【支付计划】标签\"),
        ("2",u"列表展示各阶段应付金额、预计付款日期、当前状态\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"5.5.2  上传付款凭证\"))
    for n,t in [
        ("1",u"当某一支付节点到期时，完成银行转账（转账信息以合同为准）\"),
        ("2",u"在支付计划列表中，找到该节点，点击【上传凭证】\"),
        ("3",u"上传银行转账凭证截图（PNG/JPG，清晰显示转账金额、时间、账号）\"),
        ("4",u"点击【确认提交】，管理员将核实到账情况\"),
        ("5",u"管理员确认到账后，对应里程碑的执行权限解锁，OPC 可开始该阶段工作\"),
    ]:
        story.append(Step(n,t))
    story.append(Tip(u"提示：款项到账后，管理员通常在 1 个工作日内完成确认。\"))
    story.append(SP(2))

    story.append(H2(u"5.6  交付验收\"))
    story.append(P(u"OPC 提交交付物后，发布方需在 72 小时内完成验收。\"))
    for n,t in [
        ("1",u"收到【交付物待验收】站内通知后，进入【订单管理】→ 对应订单详情\"),
        ("2",u"在【交付物记录】区域，点击最新提交的交付物查看详情\"),
        ("3",u"下载附件文件或点击在线链接，仔细审查交付内容\"),
        ("4",u"根据合同中约定的验收标准进行评审，然后：\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"验收结论\",u"操作",u"系统行为"],[
        [u"通过\",     u"点击【验收通过】，填写简短评语（可选）",    u"里程碑标记完成，对应款项进入 OPC 结算队列"],
        [u"不通过\",   u"点击【需要修改】，必须填写详细修改意见",    u"OPC 收到通知，在修改后重新提交"],
        [u"有争议\",   u"点击【申请仲裁】，发起工单（见 5.7 节）",  u"管理员介入处理"],
    ],widths=[2.5*cm,5.5*cm,7*cm]))
    story.append(Warn(u"注意：超过 72 小时未操作验收，系统将自动标记为验收通过（自动验收保护 OPC 权益）。\"))
    story.append(SP(2))

    story.append(H2(u"5.7  工单发起\"))
    story.append(P(u"当验收存在争议、需求内容需要变更或执行过程有纠纷时，可发起工单申请管理员介入。\"))
    for n,t in [
        ("1",u"在订单详情页，点击【发起工单】按钮\"),
        ("2",u"填写工单标题（简要描述问题）\"),
        ("3",u"填写问题详情（描述争议背景、诉求、已沟通情况，建议附上截图证据）\"),
        ("4",u"选择工单类型（验收争议 / 需求变更 / 其他）\"),
        ("5",u"点击【提交工单】，管理员将在 1 个工作日内响应\"),
        ("6",u"在【工单记录】中可查看工单进展及管理员的调解方案\"),
    ]:
        story.append(Step(n,t))
    story.append(PageBreak())

    # ══ 第 6 章 管理员使用指南 ════════════════════════════════════════════════
    story.append(H1(u"6  管理员使用指南\"))

    story.append(H2(u"6.1  登录管理后台\"))
    for n,t in [
        ("1",u"打开平台网址，在登录弹窗中选择角色【管理员】\"),
        ("2",u"使用管理员账号（邮箱）和密码登录\"),
        ("3",u"登录成功后进入管理后台，左侧为功能导航菜单\"),
    ]:
        story.append(Step(n,t))
    story.append(Tip(u"提示：管理员账号由系统预置，如需新增管理员账号，请联系系统运维人员。\"))
    story.append(SP(2))

    story.append(H2(u"6.2  数据看板\"))
    story.append(P(u"管理后台首页即数据看板，提供平台运营状态的全局视图。\"))
    story.append(tbl([u"看板模块\",u"内容说明"],[
        [u"核心 KPI 卡片\",    u"注册用户总数、活跃 OPC 数、需求发布量、成交订单数、累计交易额、今日新增用户"],
        [u"趋势折线图\",       u"最近 30 天的用户注册趋势、需求发布趋势、订单成交趋势，支持切换日/周/月维度"],
        [u"待处理事项\",       u"待审核用户数、待审核需求数、待处理工单数等，点击可直接跳转到对应管理页面"],
        [u"数据大屏\",         u"点击【进入大屏模式】切换为全屏可视化展示，适用于大屏投影显示"],
        [u"驾驶舱\",           u"多维业务健康度面板：资金池状态、OPC 活跃度分布、异常订单预警"],
        [u"登录城市分布\",     u"展示用户登录地理分布，辅助了解用户区域构成"],
    ],widths=[3.5*cm,11.5*cm]))
    story.append(SP(2))

    story.append(H2(u"6.3  用户审核\"))
    story.append(P(u"新注册的 OPC 和发布方账号需经管理员审核后方可使用业务功能。\"))
    story.append(H3(u"6.3.1  查看待审核用户\"))
    for n,t in [
        ("1",u"在左侧导航点击【用户管理】\"),
        ("2",u"在顶部筛选栏将状态过滤为【待审核】，查看待处理的注册申请\"),
        ("3",u"列表展示：昵称、角色、注册时间、邮箱、手机号\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())
    story.append(H3(u"6.3.2  审核操作\"))
    story.append(tbl([u"操作\",u"步骤",u"说明"],[
        [u"审核通过\", u"点击用户行右侧【通过】按钮",           u"用户账号激活，收到短信通知，可使用业务功能"],
        [u"审核驳回\", u"点击【驳回】，弹窗中填写驳回原因",    u"用户收到通知，可修改资料后重新申请"],
        [u"账号封禁\", u"点击【封禁】按钮",                    u"账号无法登录，已发放 JWT 令牌立即失效"],
        [u"解除封禁\", u"在已封禁用户行点击【解封】",          u"恢复账号正常使用权限"],
    ],widths=[2.5*cm,5.5*cm,7*cm]))
    story.append(SP(2))

    story.append(H2(u"6.4  需求审核\"))
    story.append(P(u"发布方提交需求后，管理员需进行内容合规性审核。\"))
    for n,t in [
        ("1",u"在左侧导航点击【需求管理】，筛选状态为【审核中】\"),
        ("2",u"点击需求查看完整内容，重点核查：需求描述是否完整、预算是否合理、是否涉及违规内容\"),
        ("3",u"审核通过：点击【审核通过】，需求推送至接单大厅，发布方收到通知\"),
        ("4",u"审核驳回：点击【驳回】，填写驳回原因，发布方收到通知后可修改重新提交\"),
    ]:
        story.append(Step(n,t))
    story.append(SP(2))

    story.append(H2(u"6.5  V2 业务全流程管理\"))
    story.append(P(u"V2 通道（双通道模式）下，管理员作为业务枢纽，协调甲方需求与外包执行的全流程。\"))
    story.append(SP())

    story.append(H3(u"6.5.1  V2 甲方需求管理（发布方 → 平台）\"))
    story.append(tbl([u"操作\",u"入口",u"说明"],[
        [u"查看甲方需求\",  u"【V2发布方工作台】→ 甲方需求列表", u"查看所有发布方提交的需求，支持按状态筛选"],
        [u"审核需求\",      u"需求详情 → 操作按钮",              u"审核通过后需求变为 active 状态"],
        [u"创建外包需求\",  u"需求详情 → 【创建外包需求】",      u"将甲方需求转化为可分发给 OPC 的外包需求（设置外包价格范围、里程碑等）"],
        [u"关闭需求\",      u"需求详情 → 【关闭】",              u"填写关闭原因，需求从大厅下架"],
    ],widths=[3*cm,4.5*cm,7.5*cm]))
    story.append(SP())

    story.append(H3(u"6.5.2  V2 外包需求管理（平台 → OPC）\"))
    story.append(tbl([u"操作\",u"入口",u"说明"],[
        [u"查看外包需求\",   u"【V2 OPC 工作台】→ 外包需求",  u"展示已创建的外包需求与 OPC 投标情况"],
        [u"查看投标\",       u"外包需求详情 → 投标列表",      u"查看所有 OPC 的投标报价与方案"],
        [u"确认中标\",       u"投标列表 → 【选定此 OPC】",    u"确认中标 OPC，系统自动创建订单"],
        [u"管理投标状态\",   u"投标详情",                     u"可标记特定投标入围/驳回"],
    ],widths=[3*cm,4.5*cm,7.5*cm]))
    story.append(SP())

    story.append(H3(u"6.5.3  V2 合同管理\"))
    story.append(tbl([u"操作\",u"入口",u"说明"],[
        [u"查看合同\",    u"【V2发布方工作台】→ 合同列表", u"查看 A/B 两个通道的所有合同"],
        [u"生成合同\",    u"订单详情 → 【生成合同】",      u"系统自动填入条款，管理员可调整合同正文内容"],
        [u"配置税率\",    u"合同详情",                     u"设置适用税率与发票类型"],
        [u"跟踪签署\",    u"合同列表",                     u"查看发布方/OPC 是否已签署，催促未签方完成"],
    ],widths=[3*cm,4.5*cm,7.5*cm]))
    story.append(SP())

    story.append(H3(u"6.5.4  V2 支付计划管理\"))
    story.append(tbl([u"操作\",u"说明"],[
        [u"创建支付节点\", u"在合同确认后，按里程碑创建支付节点，填写金额与预计日期"],
        [u"确认到账\",     u"发布方上传付款凭证后，核实银行到账情况，点击【确认到账】解锁里程碑"],
        [u"释放款项\",     u"里程碑验收通过后，点击【释放款项】将该笔款项进入 OPC 结算队列"],
    ],widths=[4*cm,11*cm]))
    story.append(SP())

    story.append(H3(u"6.5.5  V2 交付物管理\"))
    story.append(tbl([u"操作\",u"说明"],[
        [u"查看交付物\", u"在【V2 OPC 工作台】→ 交付物列表，查看 OPC 提交的所有交付物及状态"],
        [u"验收通过\",   u"审查交付物文件/链接，确认符合要求后点击【验收通过】"],
        [u"验收驳回\",   u"填写详细修改意见后点击【需要修改】，OPC 收到通知后重新提交"],
    ],widths=[4*cm,11*cm]))
    story.append(SP())

    story.append(H3(u"6.5.6  财务结算审批\"))
    for n,t in [
        ("1",u"在【财务管理】→ 【结算申请】列表，查看 OPC 提交的结算申请\"),
        ("2",u"核对申请信息：OPC 姓名、银行卡号、申请金额（含平台服务费明细）\"),
        ("3",u"确认信息无误后，在银行系统操作打款\"),
        ("4",u"打款完成后点击【确认打款】，填写打款流水号\"),
        ("5",u"系统更新结算状态为已完成，OPC 收到到账通知\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())

    story.append(H3(u"6.5.7  工单处理\"))
    story.append(tbl([u"步骤\",u"操作"],[
        [u"查看工单\",  u"【工单管理】→ 选择未处理工单，查看详情（双方描述、证据文件）"],
        [u"响应工单\",  u"在工单详情中发送消息，告知双方已受理，了解争议详情"],
        [u"协商调解\",  u"基于合同条款与平台规则提出调解建议，与双方沟通达成一致"],
        [u"执行方案\",  u"根据调解结果在系统中操作（如：强制验收通过、部分退款、取消订单）"],
        [u"关闭工单\",  u"调解完成后关闭工单，填写处理结果说明"],
    ],widths=[3*cm,12*cm]))
    story.append(SP(2))

    story.append(H2(u"6.6  大赛与题库管理\"))
    story.append(H3(u"6.6.1  创建大赛\"))
    for n,t in [
        ("1",u"在左侧导航点击【大赛管理】→ 点击【+ 创建大赛】\"),
        ("2",u"填写大赛基本信息：\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"字段\",u"说明"],[
        [u"大赛名称\",     u"大赛的完整名称"],
        [u"大赛详情\",     u"大赛介绍、赛制规则、奖励方案（Markdown 格式）"],
        [u"公告发布时间\", u"大赛公告对外公开的时间"],
        [u"报名开始时间\", u"OPC 可以开始报名的时间"],
        [u"报名截止时间\", u"报名通道关闭时间"],
        [u"答题截止时间\", u"在线测评提交截止时间"],
    ],widths=[3.5*cm,11.5*cm]))
    for n,t in [
        ("3",u"点击【保存草稿】保存，或点击【发布大赛】立即发布（发布后 OPC 可见）\"),
    ]:
        story.append(Step(n,t))
    story.append(SP())

    story.append(H3(u"6.6.2  配置赛道与题目\"))
    for n,t in [
        ("1",u"在大赛详情页点击【赛道配置】，选择或创建关联 CAT 赛道\"),
        ("2",u"为每个赛道配置 A 类题（高级）、B 类题（中级）、C 类题（入门级）的题目\"),
        ("3",u"点击【题库管理】→ 【+ 新建题目】添加测评题目：\"),
    ]:
        story.append(Step(n,t))
    story.append(tbl([u"字段\",u"说明"],[
        [u"题目标题\",   u"题目简短描述"],
        [u"题目内容\",   u"完整题目正文（Markdown 格式，支持代码块、表格、图片）"],
        [u"题目附件\",   u"如有需要，上传参考文件（支持多选）"],
        [u"所属赛道\",   u"选择该题目归属的 CAT 赛道分类"],
    ],widths=[3.5*cm,11.5*cm]))
    story.append(SP())

    story.append(H3(u"6.6.3  管理报名与录入成绩\"))
    story.append(tbl([u"操作\",u"说明"],[
        [u"查看报名列表\", u"【大赛管理】→ 对应大赛 → 【报名列表】，查看所有参赛者信息"],
        [u"审核报名\",     u"对报名记录点击【通过】或【驳回】（如有资格审核要求）"],
        [u"录入成绩\",     u"评审期结束后，在报名列表对每位参赛者录入 testGrade（A/B/C/fail）和 assignmentGrade"],
        [u"颁发证书\",     u"成绩录入完成后，点击【批量颁发证书】，达标者自动获得电子证书"],
    ],widths=[4*cm,11*cm]))
    story.append(SP(2))

    story.append(H2(u"6.7  AI 智能体配置\"))
    story.append(H3(u"6.7.1  管理智能体\"))
    story.append(tbl([u"操作\",u"入口",u"说明"],[
        [u"查看智能体列表\", u"【AI管理】→ 智能体列表",   u"显示所有场景的智能体配置，包含启用状态、上次更新时间"],
        [u"编辑提示词\",     u"智能体详情 → 编辑",       u"修改 System Prompt 内容（Markdown 编辑器），保存后创建历史版本"],
        [u"查看版本历史\",   u"智能体详情 → 版本历史",   u"查看并回滚到历史版本的提示词"],
        [u"启用/禁用\",      u"智能体列表 → 开关",       u"禁用后该场景的 AI 功能对用户不可见"],
    ],widths=[3*cm,4*cm,8*cm]))
    story.append(SP())

    story.append(H3(u"6.7.2  Skill 注册中心\"))
    for n,t in [
        ("1",u"进入【AI管理】→ 【Skill 管理】\"),
        ("2",u"点击【安装 Skill】，输入 GitHub 仓库 URL（格式：https://github.com/...）\"),
        ("3",u"系统从 GitHub 拉取 Skill 定义文件，解析并预览内容\"),
        ("4",u"确认内容正确后，点击【确认安装】\"),
        ("5",u"安装完成后，在【任务类型配置】中将 Skill 与对应业务场景关联\"),
        ("6",u"如需更新 Skill，点击已安装 Skill 右侧的【同步更新】按钮\"),
    ]:
        story.append(Step(n,t))
    story.append(SP(2))

    story.append(H2(u"6.8  系统配置\"))
    story.append(tbl([u"配置项\",u"入口",u"说明"],[
        [u"平台基本参数\", u"【系统设置】→ 平台配置",   u"平台名称、ICP 备案号、平台抽佣比例（%）、客服联系方式"],
        [u"信用等级规则\", u"【系统设置】→ 信用等级",   u"定义各等级的积分阈值、颜色标识、权益（可投标等级上限等）"],
        [u"赛道分类管理\", u"【系统设置】→ CAT 分类",   u"创建/编辑需求赛道（名称、颜色、描述、是否启用）"],
        [u"数据库备份\",   u"【系统设置】→ 备份管理",   u"查看自动备份记录，手动触发备份"],
    ],widths=[3*cm,4*cm,8*cm]))
    story.append(PageBreak())

    # ══ 第 7 章 FAQ ════════════════════════════════════════════════════════════
    story.append(H1(u"7  常见问题解答（FAQ）\"))

    faqs = [
        (u"Q：注册后多久可以审核通过？\",
         u"A：管理员通常在 1 个工作日内完成审核。审核结果将通过短信通知。如超过 2 个工作日未收到通知，请通过平台客服联系管理员。\"),
        (u"Q：投标被选中后，多久需要签署合同？\",
         u"A：中标通知发出后，管理员会在 1-2 个工作日内生成合同并推送给您签署。建议在收到合同通知后 24 小时内完成签署，避免影响项目启动时间。\"),
        (u"Q：提交交付物后，发布方一直未验收怎么办？\",
         u"A：系统设有 72 小时自动验收机制。发布方在 72 小时内未操作验收，系统将自动标记为验收通过，对应款项进入结算队列。若您希望加快进度，可通过站内消息提醒发布方。\"),
        (u"Q：上传文件失败怎么处理？\",
         u"A：请确认：①文件格式在允许列表内（图片/PDF/Office 文档/压缩包/视频）；②文件大小未超过对应类型的限制；③网络连接稳定。刷新页面后重新上传。\"),
        (u"Q：忘记登录密码如何重置？\",
         u"A：在登录页点击【忘记密码】，输入注册邮箱，系统发送包含临时密码的邮件。登录后请立即修改密码。如邮箱不可用，联系平台客服人工处理。\"),
        (u"Q：大赛答题可以中途保存吗？\",
         u"A：支持。在答题过程中点击【暂存】，答题记录会保存为草稿，可在截止时间前返回继续作答和修改。点击【最终提交】后不可修改。\"),
        (u"Q：如何提升信用等级？\",
         u"A：信用积分通过以下方式获得：完成订单（按质量评分）、参加大赛并取得好成绩（A 级+15 分、B 级+8 分、C 级+3 分）、保持活跃（定期登录和参与社区互动）。当积分达到下一等级的阈值时，等级自动升级。\"),
        (u"Q：需求被驳回了，如何修改重新提交？\",
         u"A：在【我的需求】列表中找到被驳回的需求，点击进入详情，查看驳回原因。点击【编辑】修改需求内容，修改完成后重新点击【提交审核】。\"),
        (u"Q：合同中的金额与预期不符，如何处理？\",
         u"A：在合同签署页面点击【提出修改意见】，填写具体问题，管理员会与双方协商调整合同内容。切勿直接签署有疑虑的合同。\"),
        (u"Q：结算申请提交后多久到账？\",
         u"A：管理员通常在 3 个工作日内完成审核并操作打款。打款到账时间还取决于银行处理速度（通常 1-2 个工作日）。\"),
    ]
    for q, a in faqs:
        story.append(Paragraph(q, S["h3"]))
        story.append(P(a))
        story.append(SP())

    story.append(HR())
    story.append(H2(u"版本修订记录\"))
    story.append(tbl([u"版本号\",u"日期",u"修订内容"],[
        [u"V1.0", today, u"初始版本，软件著作权申请\"]
    ],widths=[2.5*cm,3.5*cm,9*cm]))
    story.append(SP(2))
    story.append(Paragraph(u"本用户操作手册为接单吧 OPC撮合交易平台官方文档，内容如有变更请以平台最新版本为准。\",S["foot"]))

    doc = SimpleDocTemplate(OUT,pagesize=A4,
        leftMargin=1.8*cm,rightMargin=1.8*cm,topMargin=2.2*cm,bottomMargin=2.0*cm,
        title=u"接单吧 OPC撮合交易平台 用户操作手册\",author=u"接单吧平台",
        subject=u"软件著作权申请材料\")
    doc.build(story,onFirstPage=on_page,onLaterPages=on_page)
    sz=os.path.getsize(OUT)
    print(u"✅ PDF：%s" % OUT)
    print(u"   大小：%.1f KB / %.2f MB" % (sz/1024,sz/1024/1024))

if __name__=="__main__":
    build()
