#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成接单吧OPC撮合交易平台软件说明书 PDF（用于软著申请）"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
import os
import datetime

# ─── 字体：使用 ReportLab 内置 CIDFont，无需系统字体 ────────────────────────
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
pdfmetrics.registerFont(UnicodeCIDFont("MSung-Light"))

FN = "STSong-Light"   # 正文
FB = "MSung-Light"    # 标题/粗体（无真粗体，用明朝体区分）

# ─── 配色 ───────────────────────────────────────────────────────────────────
C_DARK  = colors.HexColor("#1a3a6b")
C_MID   = colors.HexColor("#2c5aa0")
C_ALT   = colors.HexColor("#eef2f8")
C_GRID  = colors.HexColor("#c0c8d8")
C_GREY  = colors.HexColor("#666666")

# ─── 样式 ───────────────────────────────────────────────────────────────────
def st(name, **kw):
    return ParagraphStyle(name, **kw)

S = {
    "cov_t":  st("cov_t",  fontName=FB, fontSize=26, alignment=TA_CENTER, leading=38, spaceAfter=10, textColor=C_DARK),
    "cov_s":  st("cov_s",  fontName=FN, fontSize=14, alignment=TA_CENTER, leading=22, spaceAfter=8,  textColor=C_GREY),
    "cov_i":  st("cov_i",  fontName=FN, fontSize=12, alignment=TA_CENTER, leading=20, spaceAfter=6,  textColor=C_GREY),
    "h1":     st("h1",     fontName=FB, fontSize=16, textColor=C_DARK,   leading=26, spaceBefore=18, spaceAfter=8),
    "h2":     st("h2",     fontName=FB, fontSize=13, textColor=C_MID,    leading=22, spaceBefore=12, spaceAfter=6),
    "h3":     st("h3",     fontName=FB, fontSize=11, textColor=colors.HexColor("#333"), leading=20, spaceBefore=8, spaceAfter=4),
    "body":   st("body",   fontName=FN, fontSize=10.5, alignment=TA_JUSTIFY, leading=20, spaceAfter=4),
    "bul":    st("bul",    fontName=FN, fontSize=10.5, alignment=TA_LEFT,    leading=20, spaceAfter=4, leftIndent=16, bulletIndent=4),
    "th":     st("th",     fontName=FB, fontSize=10,   alignment=TA_CENTER,  leading=16, textColor=colors.white),
    "tc":     st("tc",     fontName=FN, fontSize=9.5,  alignment=TA_LEFT,    leading=15),
    "footer": st("footer", fontName=FN, fontSize=8,    alignment=TA_CENTER,  leading=12, textColor=C_GREY),
    "toc":    st("toc",    fontName=FN, fontSize=10.5, alignment=TA_LEFT,    leading=20, spaceAfter=2),
    "tocpg":  st("tocpg",  fontName=FN, fontSize=10.5, alignment=TA_CENTER,  leading=20, spaceAfter=2),
    "cov_ih": st("cov_ih", fontName=FB, fontSize=11,   alignment=TA_CENTER,  leading=18, textColor=C_DARK),
    "cov_iv": st("cov_iv", fontName=FN, fontSize=11,   alignment=TA_LEFT,    leading=18),
}

def H1(t): return Paragraph(t, S["h1"])
def H2(t): return Paragraph(t, S["h2"])
def H3(t): return Paragraph(t, S["h3"])
def P(t):  return Paragraph(t, S["body"])
def B(t):  return Paragraph(u"\u2022 " + t, S["bul"])
def SP(n=1): return Spacer(1, n * 0.35 * cm)
def HR(): return HRFlowable(width="100%", thickness=0.5, color=C_GRID, spaceAfter=6)

# ─── 表格辅助 ───────────────────────────────────────────────────────────────
def mktbl(headers, rows, widths=None):
    def para(v, style):
        return Paragraph(str(v), S[style])
    data = [[para(h, "th") for h in headers]]
    for row in rows:
        data.append([para(v, "tc") for v in row])
    ts = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),   C_DARK),
        ("FONTNAME",      (0, 0), (-1, -1),  FN),
        ("FONTNAME",      (0, 0), (-1, 0),   FB),
        ("FONTSIZE",      (0, 0), (-1, -1),  9.5),
        ("FONTSIZE",      (0, 0), (-1, 0),   10),
        ("VALIGN",        (0, 0), (-1, -1),  "MIDDLE"),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1),  [colors.white, C_ALT]),
        ("GRID",          (0, 0), (-1, -1),  0.5, C_GRID),
        ("TOPPADDING",    (0, 0), (-1, -1),  5),
        ("BOTTOMPADDING", (0, 0), (-1, -1),  5),
        ("LEFTPADDING",   (0, 0), (-1, -1),  6),
        ("RIGHTPADDING",  (0, 0), (-1, -1),  6),
    ])
    t = Table(data, colWidths=widths)
    t.setStyle(ts)
    return t

# ─── 页眉页脚 ────────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    W, H = A4
    if doc.page > 1:
        canvas.setFillColor(C_DARK)
        canvas.rect(1.5*cm, H-1.5*cm, W-3*cm, 0.3*cm, fill=1, stroke=0)
        canvas.setFillColor(C_GREY)
        canvas.setFont(FN, 8)
        canvas.drawString(1.5*cm, H-2.0*cm, u"接单吧 OPC撮合交易平台  软件说明书  V1.0")
        canvas.drawRightString(W-1.5*cm, H-2.0*cm, u"软件著作权申请材料")
        canvas.setFillColor(C_GRID)
        canvas.line(1.5*cm, 1.5*cm, W-1.5*cm, 1.5*cm)
        canvas.setFont(FN, 8)
        canvas.setFillColor(C_GREY)
        canvas.drawCentredString(W/2, 1.0*cm, u"第 %d 页" % doc.page)
    canvas.restoreState()

# ─── 正文 ────────────────────────────────────────────────────────────────────
def build():
    story = []
    today = datetime.date.today().strftime("%Y \u5e74 %m \u6708 %d \u65e5")

    # ══ 封面 ══
    story.append(Spacer(1, 3.5*cm))
    story.append(Paragraph(u"软 件 说 明 书", S["cov_t"]))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="60%", thickness=2, color=C_DARK, spaceAfter=16))
    story.append(Paragraph(u"接单吧 OPC撮合交易平台", S["cov_s"]))
    story.append(Spacer(1, 4*cm))
    cov_data = [
        [u"软件名称", u"接单吧 OPC撮合交易平台"],
        [u"软件版本", u"V1.0"],
        [u"文档编号", u"JDB-DOC-2026-001"],
        [u"编制日期", today],
        [u"文档密级", u"内部资料"],
    ]
    cov_tbl = Table(
        [[Paragraph(r[0], S["cov_ih"]), Paragraph(r[1], S["cov_iv"])] for r in cov_data],
        colWidths=[5*cm, 9*cm]
    )
    cov_tbl.setStyle(TableStyle([
        ("GRID",          (0,0),(-1,-1), 0.5, C_GRID),
        ("BACKGROUND",    (0,0),(0,-1),  C_ALT),
        ("TOPPADDING",    (0,0),(-1,-1), 7),
        ("BOTTOMPADDING", (0,0),(-1,-1), 7),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
    ]))
    story.append(cov_tbl)
    story.append(PageBreak())

    # ══ 目录 ══
    story.append(H1(u"目  录"))
    toc = [
        ("1",    u"软件概述", "3"),
        ("1.1",  u"软件基本信息", "3"),
        ("1.2",  u"软件背景与目标", "3"),
        ("1.3",  u"术语与缩略语", "4"),
        ("2",    u"系统架构", "5"),
        ("2.1",  u"整体架构", "5"),
        ("2.2",  u"技术栈", "5"),
        ("2.3",  u"系统部署", "7"),
        ("3",    u"用户角色与权限", "8"),
        ("4",    u"功能模块详述", "9"),
        ("4.1",  u"公众访客功能", "9"),
        ("4.2",  u"OPC 服务商功能", "10"),
        ("4.3",  u"发布方功能", "13"),
        ("4.4",  u"管理员功能", "15"),
        ("5",    u"核心业务流程", "19"),
        ("5.1",  u"需求发布与撮合流程", "19"),
        ("5.2",  u"合同与交付流程", "20"),
        ("5.3",  u"大赛报名与评级流程", "21"),
        ("5.4",  u"财务结算流程", "21"),
        ("5.5",  u"工单与售后流程", "22"),
        ("6",    u"数据库设计说明", "23"),
        ("7",    u"接口设计说明", "27"),
        ("8",    u"安全性设计", "29"),
        ("9",    u"性能与扩展性", "30"),
        ("10",   u"运行环境要求", "31"),
    ]
    indent = u"\u3000\u3000"
    toc_rows = []
    for num, title, pg in toc:
        prefix = "" if len(num) == 1 else indent
        toc_rows.append([
            Paragraph(prefix + num + u"\u3000" + title, S["toc"]),
            Paragraph(pg, S["tocpg"])
        ])
    toc_tbl = Table(toc_rows, colWidths=[13.5*cm, 1.5*cm])
    toc_tbl.setStyle(TableStyle([
        ("LINEBELOW",     (0,0),(-1,-1), 0.3, colors.HexColor("#dddddd")),
        ("TOPPADDING",    (0,0),(-1,-1), 3),
        ("BOTTOMPADDING", (0,0),(-1,-1), 3),
    ]))
    story.append(toc_tbl)
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 1 章  软件概述
    # ══════════════════════════════════════════════
    story.append(H1(u"1  软件概述"))

    story.append(H2(u"1.1  软件基本信息"))
    story.append(mktbl(
        [u"字段", u"内容"],
        [
            [u"软件名称", u"接单吧 OPC撮合交易平台"],
            [u"英文名称", u"JiedanBa OPC Matching & Transaction Platform"],
            [u"软件版本", u"V1.0"],
            [u"开发语言", u"TypeScript（前端 React 18 / 后端 Node.js Express）"],
            [u"数据库",   u"PostgreSQL 15"],
            [u"运行平台", u"Linux 服务器（云计算环境）/ 现代 Web 浏览器"],
            [u"软件类型", u"B/S 架构 Web 应用系统"],
        ],
        widths=[4*cm, 11*cm]
    ))
    story.append(SP(2))

    story.append(H2(u"1.2  软件背景与目标"))
    story.append(P(u"随着数字化外包市场的快速发展，企业与个人在寻找专业外包服务商（OPC）时面临信息不对称、撮合效率低、合同履约不透明等诸多挑战。接单吧 OPC撮合交易平台（以下简称『平台』）应运而生，旨在通过互联网技术构建一套集需求发布、智能撮合、在线合同、交付管理、财务结算、大赛认证于一体的全生命周期外包服务闭环。"))
    story.append(SP())
    story.append(P(u"平台的核心目标包括："))
    for item in [
        u"为发布方（甲方/需求方）提供高效的需求发布、OPC 筛选与合同执行一站式工作台；",
        u"为 OPC（外包服务提供商）提供接单大厅、投标管理、订单执行、财务结算等完整的接单生态；",
        u"通过大赛、认证、信用评级等机制建立 OPC 能力标准化体系，提升平台撮合质量；",
        u"提供管理员全流程数字化运营后台，实现业务数据实时监控与精细化管控；",
        u"集成 AI 智能体（Agent）辅助运营，提升平台服务的自动化与智能化水平。",
    ]:
        story.append(B(item))
    story.append(SP(2))

    story.append(H2(u"1.3  术语与缩略语"))
    story.append(mktbl(
        [u"术语/缩写", u"说明"],
        [
            [u"OPC",      u"Order Processing Center，外包服务提供商，即平台上的接单方/服务商"],
            [u"发布方",   u"需求发布方，即甲方/企业客户，通过平台发布外包需求"],
            [u"需求",     u"发布方提出的具体工作任务，包含预算、周期、交付要求等信息"],
            [u"投标",     u"OPC 针对某一需求提交的服务报价与方案"],
            [u"外包订单", u"撮合成功后，平台生成的正式合同执行单元"],
            [u"交付物",   u"OPC 按合同要求提交的工作成果文件"],
            [u"工单",     u"用于处理售后问题、技术支持或履约纠纷的沟通工单"],
            [u"大赛",     u"平台举办的 OPC 综合能力竞赛，用于发现与认证高质量服务商"],
            [u"信用分",   u"平台对 OPC 能力与诚信度的量化评估指标"],
            [u"智能体",   u"AI Agent，平台集成的大模型驱动自动化服务模块"],
            [u"CAT",      u"Category，赛道/能力分类，是 OPC 专业领域的标准化分类体系"],
            [u"B/S 架构", u"浏览器/服务器架构，用户通过浏览器访问系统"],
            [u"RESTful",  u"基于 HTTP 协议的标准化 API 设计风格"],
            [u"JWT",      u"JSON Web Token，用于用户身份鉴权的令牌格式"],
        ],
        widths=[3.5*cm, 11.5*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 2 章  系统架构
    # ══════════════════════════════════════════════
    story.append(H1(u"2  系统架构"))

    story.append(H2(u"2.1  整体架构"))
    story.append(P(u"平台采用前后端分离的 B/S 三层架构设计，分为表现层、业务逻辑层与数据存储层，三层之间通过标准 HTTP/RESTful API 进行通信，各层职责独立、边界清晰。"))
    story.append(SP())
    story.append(mktbl(
        [u"层次", u"主要技术", u"职责说明"],
        [
            [u"表现层（前端）",   u"React 18 + TypeScript SPA（单页应用）",  u"用户界面渲染、路由管理、状态管理、与后端 API 通信"],
            [u"业务逻辑层（后端）", u"Node.js + Express + TypeScript",        u"API 接口处理、业务规则校验、权限控制、AI 智能体调度"],
            [u"数据存储层",       u"PostgreSQL 15",                          u"结构化数据持久化存储，含用户、需求、订单、合同、财务等 70+ 张业务表"],
            [u"对象存储",         u"Google Cloud Storage",                   u"附件、合同文件、交付物等非结构化文件存储"],
            [u"短信通道",         u"腾讯云 SMS",                             u"用户注册验证码、业务通知等短消息发送"],
        ],
        widths=[3.8*cm, 4.5*cm, 6.7*cm]
    ))
    story.append(SP(2))

    story.append(H2(u"2.2  技术栈"))
    story.append(H3(u"2.2.1  前端技术栈"))
    story.append(mktbl(
        [u"组件/库", u"用途"],
        [
            [u"React 18",          u"核心 UI 框架，组件化构建用户界面"],
            [u"TypeScript",        u"强类型语言，提升代码可维护性与安全性"],
            [u"Vite 7",            u"前端构建工具，提供极速开发体验与生产打包优化"],
            [u"Tailwind CSS",      u"原子化 CSS 框架，快速实现高度定制化的响应式设计"],
            [u"Radix UI / Shadcn", u"无障碍组件库，提供弹窗、下拉、选择器等高质量 UI 组件"],
            [u"Wouter",            u"轻量级前端路由库，管理多角色页面路由"],
            [u"TanStack Query",    u"服务端状态管理，自动缓存与数据同步"],
            [u"tiptap",            u"富文本编辑器，支持完整 Markdown 语法编辑与渲染"],
            [u"Recharts",          u"图表库，实现数据看板的可视化报表"],
            [u"Lucide Icons",      u"一致性图标体系"],
            [u"Zod",               u"前后端共用的数据校验 Schema 定义库"],
            [u"Orval",             u"基于 OpenAPI 规范自动生成 TypeScript 类型与 React Query Hook"],
        ],
        widths=[4.5*cm, 10.5*cm]
    ))
    story.append(SP())

    story.append(H3(u"2.2.2  后端技术栈"))
    story.append(mktbl(
        [u"组件/库", u"用途"],
        [
            [u"Node.js + Express",   u"HTTP 服务框架，处理 RESTful API 请求"],
            [u"TypeScript",          u"强类型后端开发，与前端共享类型定义"],
            [u"Drizzle ORM",         u"类型安全的 PostgreSQL ORM，管理数据库 Schema 与查询"],
            [u"Pino",                u"高性能结构化日志库"],
            [u"Zod",                 u"请求参数校验，防止非法输入"],
            [u"express-rate-limit",  u"接口限流，防御暴力攻击"],
            [u"bcrypt",              u"用户密码哈希存储"],
            [u"jsonwebtoken",        u"基于令牌的无状态身份鉴权（JWT）"],
            [u"multer",              u"文件上传中间件"],
            [u"OpenAI / Anthropic SDK", u"AI 大模型接入，驱动智能体功能"],
            [u"Resend",              u"邮件通知服务 SDK"],
            [u"node-cron",           u"后台定时任务调度（自动结算、自动验收等）"],
            [u"esbuild",             u"高性能 TypeScript 构建工具"],
        ],
        widths=[4.5*cm, 10.5*cm]
    ))
    story.append(SP(2))

    story.append(H2(u"2.3  系统部署"))
    story.append(P(u"平台部署于云计算环境（Replit 云平台），采用容器化运行模式。前端静态资源经 Vite 构建后由后端 Express 统一托管。系统通过反向代理对外提供 HTTPS 服务，mTLS 加密保障通信安全。数据库采用托管 PostgreSQL，附件文件存储于 Google Cloud Storage，具备高可用与自动备份能力。"))
    story.append(SP())
    story.append(mktbl(
        [u"部署项", u"说明"],
        [
            [u"应用运行环境", u"Replit 云计算平台，Linux 容器（NixOS）"],
            [u"数据库",       u"托管 PostgreSQL 15，自动每日备份，保留 30 天"],
            [u"文件存储",     u"Google Cloud Storage 私有桶，时效性预签名 URL 访问"],
            [u"HTTPS/TLS",    u"mTLS 双向认证，全站 HTTPS，HSTS 防降级"],
            [u"域名",         u"*.replit.app 平台域名（支持绑定自定义域名）"],
            [u"备份策略",     u"数据库每日 03:00 自动备份，保留 30 天"],
            [u"日志",         u"Pino 结构化日志，写入标准输出，云平台托管存储"],
        ],
        widths=[4.5*cm, 10.5*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 3 章  用户角色与权限
    # ══════════════════════════════════════════════
    story.append(H1(u"3  用户角色与权限"))
    story.append(P(u"平台设置四类用户角色，各角色功能权限相互独立，通过 JWT 令牌与后端中间件进行权限校验，确保数据隔离与安全访问控制。"))
    story.append(SP())
    story.append(mktbl(
        [u"角色", u"开通方式", u"主要权限范围"],
        [
            [u"公众/访客 (Guest)",   u"无需登录",           u"浏览首页、社区广场、公开需求大厅、学习中心、大赛公告、OPC 作品集等公开内容"],
            [u"OPC 服务商 (OPC)",    u"注册后需管理员审核", u"接单大厅与投标、订单执行与交付、大赛报名参赛、作品集管理、认证培训、财务结算、工单协作"],
            [u"发布方 (Publisher)",  u"注册后需管理员审核", u"发布与管理需求、筛选中标 OPC、签署合同、支付管理、交付验收、工单发起"],
            [u"管理员 (Admin)",      u"系统预置，无需注册", u"全平台用户与业务审核、数据看板、大赛/题库/认证管理、财务结算审批、AI 智能体配置、系统参数配置"],
        ],
        widths=[3.2*cm, 3.5*cm, 8.3*cm]
    ))
    story.append(SP(2))
    story.append(H2(u"3.1  权限控制机制"))
    for item in [
        u"所有 API 端点通过后端中间件校验 JWT 令牌有效性，令牌失效返回 401 Unauthorized；",
        u"角色相关端点在 JWT 校验基础上进一步检查用户角色字段（role），不匹配返回 403 Forbidden；",
        u"发布方与 OPC 端点额外校验账号审核状态（status = approved），未审核账号无法访问业务功能；",
        u"管理员端点仅允许 role = admin 的账号访问，所有管理接口前缀为 /api/admin/；",
        u"敏感操作（删除、资金操作等）额外记录操作日志，便于安全审计；",
        u"前端路由级别通过守卫组件（AuthGuard）拦截未授权访问，与后端形成双重防护。",
    ]:
        story.append(B(item))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 4 章  功能模块详述
    # ══════════════════════════════════════════════
    story.append(H1(u"4  功能模块详述"))

    # 4.1
    story.append(H2(u"4.1  公众访客功能"))
    story.append(P(u"公众用户无需登录即可访问平台的公开信息区域，主要包括以下功能模块。"))
    story.append(SP())
    story.append(mktbl(
        [u"模块名称", u"路由", u"功能描述"],
        [
            [u"平台首页",   u"/",                    u"展示平台核心数据（注册 OPC 数、已完成订单数等）、特色功能介绍、最新需求动态、明星 OPC 展示等引导性内容"],
            [u"社区广场",   u"/community",           u"OPC 发布的动态、案例分享、行业资讯；支持点赞、评论互动；展示热门话题与优质内容"],
            [u"需求大厅",   u"/opc/demand-hall",     u"展示审核通过的公开需求列表，包含类别、预算区间、截止日期等信息；投标需登录"],
            [u"学习中心",   u"/academy",             u"平台发布的培训文章、操作手册、行业指南；支持分类筛选与全文搜索"],
            [u"大赛专区",   u"/contests/:id",        u"大赛基本信息、报名要求、时间安排、赛制规则公开展示；达到条件的 OPC 可在此入口报名"],
            [u"作品集",     u"/portfolio/:id",       u"OPC 个人作品集公开展示页，包含技能标签、项目案例、荣誉证书等"],
        ],
        widths=[2.8*cm, 3.8*cm, 8.4*cm]
    ))
    story.append(SP(2))

    # 4.2
    story.append(H2(u"4.2  OPC 服务商功能"))
    story.append(P(u"OPC 用户注册并通过平台审核后，可使用以下完整的接单与服务交付功能体系。"))
    story.append(SP())

    story.append(H3(u"4.2.1  接单大厅与投标"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"接单大厅",   u"浏览全部对外公开的外包需求，支持按类别、预算、截止时间等条件筛选；需求卡片展示关键信息，点击可查看完整需求详情"],
            [u"投标申请",   u"OPC 选定需求后填写投标报价、服务周期、交付说明，可附参考案例或过往证明材料后提交；系统自动校验是否满足需求的 OPC 等级要求"],
            [u"投标管理",   u"OPC 可查看自己提交的所有投标记录及当前状态（待审核/入围/中标/落标）；支持在截止前修改投标内容"],
            [u"中标通知",   u"中标后系统自动推送站内通知及短信提醒，OPC 确认接受后进入合同签署环节"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.2.2  订单执行与交付"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"订单工作台", u"展示当前进行中及历史订单列表；每个订单卡片显示状态（执行中/验收中/已完成）、剩余天数、合同金额等关键信息"],
            [u"里程碑管理", u"订单按合同约定的里程碑节点推进；OPC 可查看每个里程碑的截止时间与验收要求"],
            [u"交付物提交", u"OPC 在各阶段完成后上传交付文件（支持 PDF、Word、Excel、PPT、压缩包、视频等多种格式）；可同时提交在线演示链接或说明文档；支持一次选择多个文件批量上传"],
            [u"订单沟通",   u"订单内置的消息沟通记录，便于双方就执行过程进行协调"],
            [u"工单发起",   u"执行过程中如遇需求变更、合同争议等情况，OPC 可发起工单申请平台管理员介入协调"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.2.3  财务与结算"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"收入明细",     u"按订单列出每笔应收款项、实收金额、平台服务费（扣除后净收入）"],
            [u"结算申请",     u"OPC 在阶段验收完成后可发起结算申请；管理员审核后款项打入指定银行账户"],
            [u"账单导出",     u"支持导出历史收入流水，格式为 Excel/CSV"],
            [u"收款信息维护", u"OPC 在个人资料中维护真实姓名、银行卡号、开户行等收款信息；结算前系统自动校验信息完整性"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.2.4  大赛与认证"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"大赛列表",   u"展示平台当前开放报名的大赛，包含赛道（CAT 分类）、报名截止时间、参赛要求、奖励说明"],
            [u"报名参赛",   u"OPC 按赛道报名，填写参赛资料后提交；系统校验 OPC 等级与赛道资质"],
            [u"在线测评",   u"答题期开放后，OPC 进入在线答题模块完成测评题目；提交后系统自动评分并记录答题记录"],
            [u"作品提交",   u"部分赛道要求提交实操作品；OPC 上传附件（支持多文件）或填写在线链接作为参赛作品"],
            [u"成绩与排名", u"大赛结束后展示个人成绩、排名及与其他参赛者的分位对比"],
            [u"证书颁发",   u"获奖或达标的 OPC 自动获得平台电子证书，显示于个人作品集"],
            [u"信用分提升", u"大赛成绩与平台信用分体系挂钩，优秀表现可提升 OPC 信用等级"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.2.5  个人资料与作品集"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"基本资料",   u"维护姓名、头像、所在城市、从业年限、擅长技能标签等个人信息"],
            [u"作品集管理", u"上传过往项目案例（标题、描述、附件、在线演示链接）；可设置公开/私密显示"],
            [u"技能认证",   u"展示平台颁发的认证证书，证书自动与大赛成绩挂钩"],
            [u"信用等级",   u"显示当前信用分、等级标识及提升建议"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP(2))

    # 4.3
    story.append(H2(u"4.3  发布方功能"))
    story.append(P(u"发布方（企业客户/甲方）注册审核后拥有以下功能，涵盖需求全生命周期管理。"))
    story.append(SP())

    story.append(H3(u"4.3.1  需求管理"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"发布需求",     u"填写需求标题、详细描述（支持 Markdown 富文本编辑器，可粘贴 Markdown 文本自动渲染）、类别、预算区间、交付截止时间、OPC 资质要求等；支持上传需求相关附件"],
            [u"需求版本管理", u"需求提交后进入平台审核；审核驳回后支持修改内容并重新提交；系统保留历次修改版本记录"],
            [u"需求列表",     u"查看所有已发布/草稿/审核中/已撤销的需求，支持按状态筛选；点击可查看投标列表"],
            [u"投标管理",     u"查看所有 OPC 的投标记录；可按报价、评级、投标时间等维度排序；对感兴趣的投标进行标记或直接发起确认"],
            [u"需求撤销",     u"需求发布后、尚未有 OPC 中标前可申请撤销；撤销后从大厅下架"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.3.2  合同管理"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"合同生成",   u"OPC 中标后系统自动生成电子合同，含双方信息、服务内容、里程碑节点、付款计划、违约条款等核心条款"],
            [u"合同审阅",   u"发布方在线阅读合同全文，支持 Markdown 渲染与滚动查看"],
            [u"合同签署",   u"发布方确认无误后在线签署；系统记录签署时间与 IP 信息"],
            [u"合同归档",   u"已签署合同支持下载 PDF 版本存档；历史合同可按需查阅"],
            [u"发票信息",   u"维护公司抬头、税号、开票地址等发票信息，用于税务合规"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.3.3  支付管理"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"支付计划",   u"合同中按里程碑设定的付款节点自动生成支付计划；展示每笔金额、预计付款时间、当前状态"],
            [u"支付操作",   u"发布方按支付计划节点进行线上支付（款项进入平台资金池担保）；支持上传银行转账凭证"],
            [u"支付凭证",   u"上传银行转账凭证截图作为付款证明，待管理员确认到账"],
            [u"支付记录",   u"查看所有支付记录及到账状态；支持对账单导出"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.3.4  交付验收"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"交付通知",   u"OPC 提交交付物后，发布方收到站内通知及邮件提醒"],
            [u"在线预览",   u"文档类交付物支持在线预览；图片、视频等直接展示"],
            [u"验收评审",   u"发布方对交付物进行评审，可填写验收意见；通过则触发对应里程碑的付款释放；不通过则填写修改要求"],
            [u"申请工单",   u"验收存在争议时可发起工单，由平台管理员仲裁协调"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP(2))

    # 4.4
    story.append(H2(u"4.4  管理员功能"))
    story.append(P(u"管理员拥有最高权限，通过一体化运营后台实现平台全流程数字化管理。管理后台为单页应用（SPA），通过模块切换进入不同业务区域。"))
    story.append(SP())

    story.append(H3(u"4.4.1  数据看板与驾驶舱"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"数据看板",     u"展示平台核心运营指标：注册用户数、活跃 OPC 数、需求发布量、成交订单量、累计交易额、今日新增等关键 KPI"],
            [u"趋势图表",     u"用户注册趋势、需求发布趋势、订单成交趋势的折线图；支持按日/周/月维度切换"],
            [u"数据大屏",     u"全屏可视化大屏模式，适用于运营中心投影展示；实时刷新核心业务数据"],
            [u"驾驶舱",       u"多维业务健康度仪表盘：待处理事项提醒、异常订单预警、资金池状态、OPC 活跃度等"],
            [u"登录城市分布", u"用户登录地理分布热力图，辅助了解用户区域构成"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.4.2  业务审核与监控"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"用户审核",        u"审核发布方与 OPC 的注册申请，验证资质信息后审批通过或驳回；驳回时填写驳回原因"],
            [u"需求审核",        u"对发布方提交的需求进行内容合规性审核；审核通过后推送至接单大厅"],
            [u"投标管理",        u"监控所有投标记录，支持管理员协助推进选标流程"],
            [u"V2 发布方工作台", u"V2 通道下的甲方需求、外包订单、合同、支付计划、交付物、工单的全流程统一管理视图"],
            [u"V2 OPC 工作台",   u"V2 通道下针对 OPC 的订单、交付、结算、工单的全流程统一管理视图"],
            [u"财务结算审批",    u"审核 OPC 的结算申请，确认到账后操作放款；记录每笔结算的审批日志"],
        ],
        widths=[3.5*cm, 11.5*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.4.3  OPC 生态管理"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"人才库",   u"查看并管理全部 OPC 详情，包含技能标签、信用等级、历史订单统计、在线状态"],
            [u"培训管理", u"发布与管理 OPC 培训课程/资料；追踪学习进度"],
            [u"等级认证", u"配置 OPC 信用等级评定规则；手动调整特殊情况下的 OPC 等级；查看各等级 OPC 分布统计"],
            [u"赛道分类", u"管理平台的 CAT 能力分类体系，包含赛道名称、颜色标签、是否启用大赛功能等"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.4.4  大赛与题库管理"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"大赛管理", u"创建与配置大赛活动：设置名称、时间轴（报名期/答题期/评审期/公示期）、关联赛道、报名要求、奖励方案；实时查看各大赛报名与参赛数据"],
            [u"赛道配置", u"为大赛配置 A/B/C 题型（对应不同难度层级的测评题目）"],
            [u"题库管理", u"创建与管理测评题目，支持 Markdown 富文本内容编辑、多附件批量上传；支持按赛道分类筛选与关键词搜索"],
            [u"报名审核", u"查看大赛报名列表，审核参赛资格；手动调整参赛状态"],
            [u"成绩管理", u"查看参赛者答题记录与成绩；支持手动评分（主观题）"],
            [u"证书发放", u"批量生成并发放电子证书；证书与 OPC 个人档案自动关联"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.4.5  AI 智能体配置"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"智能体列表",    u"查看与管理平台配置的所有 AI 智能体，包含名称、适用任务类型、关联大模型、启用状态等"],
            [u"任务模板配置",  u"为各业务场景配置 AI 提示词（System Prompt）模板；支持版本历史追踪与 Markdown 富文本编辑"],
            [u"Skill 注册中心",u"从 GitHub 仓库动态安装第三方 Skill 扩展包；配置不同任务类型自动加载的 Skill 集合；支持 Skill 同步更新与版本管理；安装时提供完整的超时与错误提示"],
            [u"智能体调试",    u"在后台直接发送测试消息调试智能体响应效果"],
            [u"Demo 演示生成", u"AI 自动为需求生成交互式 Demo 预览（HTML/CSS/JS），帮助发布方直观验证交付预期"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP())

    story.append(H3(u"4.4.6  系统配置"))
    story.append(mktbl(
        [u"功能", u"说明"],
        [
            [u"平台参数配置", u"配置平台名称、ICP 备案号、平台抽佣比例、资金池账户信息、短信/邮件模板等全局参数"],
            [u"信用等级规则", u"定义各信用等级的分值区间与对应权益（可投标需求等级上限、费率优惠等）"],
            [u"标签体系管理", u"管理平台的技能标签分类体系，供 OPC 个人资料与需求发布时使用"],
            [u"数据备份",     u"查看数据库备份记录；支持手动触发备份操作"],
            [u"操作日志",     u"记录管理员关键操作日志，包含操作人、时间、操作内容，便于安全审计"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 5 章  核心业务流程
    # ══════════════════════════════════════════════
    story.append(H1(u"5  核心业务流程"))

    story.append(H2(u"5.1  需求发布与撮合流程"))
    story.append(P(u"需求从创建到撮合成功经历以下主要环节，实现发布方与 OPC 的高效对接。"))
    story.append(SP())
    story.append(mktbl(
        [u"步骤", u"操作主体", u"动作", u"系统行为"],
        [
            [u"1", u"发布方", u"填写并提交需求",   u"系统保存草稿，状态置为【审核中】"],
            [u"2", u"管理员", u"审核需求内容",     u"通过→状态变为【招募中】，推送至接单大厅；驳回→通知发布方修改"],
            [u"3", u"OPC",   u"查看需求，提交投标", u"系统校验 OPC 资质等级，保存投标记录，发布方收到通知"],
            [u"4", u"发布方", u"查看投标，选定 OPC", u"向选定 OPC 发起中标确认，其余投标自动标记为落标"],
            [u"5", u"管理员", u"确认撮合，生成合同", u"系统自动生成电子合同，状态变为【合同签署中】"],
            [u"6", u"双方",  u"各自签署合同",      u"合同双方均签署后，状态变为【执行中】，里程碑倒计时启动"],
        ],
        widths=[1.2*cm, 2.4*cm, 3.8*cm, 7.6*cm]
    ))
    story.append(SP(2))

    story.append(H2(u"5.2  合同与交付流程"))
    story.append(P(u"合同签署完成后进入执行阶段，平台按里程碑节点追踪交付进度，确保每个阶段的验收与付款形成闭环。"))
    story.append(SP())
    for step, desc in [
        (u"合同生效",   u"双方签署后合同自动生效，系统解锁 OPC 的任务执行权限"),
        (u"里程碑推进", u"OPC 按合同里程碑节点开展工作，系统显示剩余天数倒计时"),
        (u"交付物提交", u"OPC 上传阶段性交付物（文件 + 说明文档 + 在线链接），系统通知发布方"),
        (u"发布方验收", u"发布方在 72 小时内审查交付物，填写验收意见：通过/不通过"),
        (u"修改迭代",   u"不通过时 OPC 根据意见修改后重新提交；系统记录每次提交历史"),
        (u"阶段付款",   u"验收通过后，对应里程碑款项从资金池自动释放，进入 OPC 结算队列"),
        (u"订单完成",   u"所有里程碑验收完成后，订单状态变为【已完成】，双方可互评"),
    ]:
        story.append(Paragraph(u"<b>\u25b6 %s</b>\uff1a%s" % (step, desc), S["body"]))
        story.append(SP(0.5))
    story.append(SP())

    story.append(H2(u"5.3  大赛报名与评级流程"))
    story.append(P(u"平台定期举办 OPC 综合能力大赛，通过标准化测评建立 OPC 能力等级体系。"))
    story.append(SP())
    for step, desc in [
        (u"大赛发布", u"管理员配置大赛信息（赛道、时间轴、题目配置）并正式发布"),
        (u"OPC 报名", u"OPC 在报名期内提交参赛申请，系统自动校验参赛资格"),
        (u"在线测评", u"答题期开放后，OPC 进入在线答题模块完成测评题目"),
        (u"作品提交", u"有实操要求的赛道，OPC 上传实操作品或在线演示链接"),
        (u"成绩评定", u"系统自动评分客观题；专家评审主观题与作品；生成综合评分"),
        (u"排名公示", u"大赛结束后公示排名，展示各 OPC 成绩分布"),
        (u"证书颁发", u"达标或获奖的 OPC 自动获得电子证书，信用分相应提升"),
    ]:
        story.append(Paragraph(u"<b>\u25b6 %s</b>\uff1a%s" % (step, desc), S["body"]))
        story.append(SP(0.5))
    story.append(SP())

    story.append(H2(u"5.4  财务结算流程"))
    story.append(P(u"平台采用担保交易模式，资金在验收完成前由平台托管，确保双方资金安全。"))
    story.append(SP())
    story.append(mktbl(
        [u"环节", u"说明"],
        [
            [u"发布方付款", u"发布方按支付计划节点将款项支付至平台资金池，上传付款凭证"],
            [u"管理员确认", u"管理员核实到账后，在后台确认收款，解锁对应里程碑执行权限"],
            [u"阶段验收",   u"发布方验收 OPC 交付物，通过后触发该阶段款项释放"],
            [u"结算申请",   u"OPC 发起结算申请，确认收款账户信息"],
            [u"结算审批",   u"管理员审核结算申请，扣除平台服务费后操作打款"],
            [u"打款完成",   u"款项到达 OPC 银行账户，系统更新结算状态，双方收到通知"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(SP(2))

    story.append(H2(u"5.5  工单与售后流程"))
    story.append(P(u"当合同执行过程中出现异常情况（需求变更、验收争议、履约纠纷等），双方可通过工单机制申请平台介入调解。"))
    story.append(SP())
    story.append(mktbl(
        [u"环节", u"说明"],
        [
            [u"工单创建",   u"发布方或 OPC 创建工单，描述问题背景、诉求及相关证据"],
            [u"系统分发",   u"工单按问题类型分配至对应管理员处理队列"],
            [u"管理员响应", u"管理员在规定时间内响应，与双方沟通核实情况"],
            [u"协商调解",   u"管理员基于合同条款与平台规则提出调解建议"],
            [u"结果执行",   u"双方确认调解方案后，管理员在系统中执行相应操作（退款/变更/关闭）"],
            [u"工单归档",   u"工单处理完毕后归档，记录保留用于后续查阅与合规审计"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 6 章  数据库设计说明
    # ══════════════════════════════════════════════
    story.append(H1(u"6  数据库设计说明"))
    story.append(P(u"系统使用 PostgreSQL 15 关系型数据库，通过 Drizzle ORM 进行 Schema 管理与查询。数据库共设计 70+ 张业务表，以下列出核心业务域的主要表结构说明。"))
    story.append(SP())

    story.append(H2(u"6.1  用户与认证域"))
    story.append(mktbl(
        [u"表名", u"用途", u"主要字段（示例）"],
        [
            [u"users",               u"核心用户表",       u"id, email, phone, password_hash, role, status, created_at"],
            [u"opc_profiles",        u"OPC 扩展资料",     u"user_id, real_name, skills, credit_score, level, bank_info"],
            [u"publisher_profiles",  u"发布方扩展资料",   u"user_id, company_name, industry, contact_info"],
            [u"opc_track_certs",     u"OPC 赛道认证记录", u"user_id, cat_category_id, level, certified_at"],
            [u"credit_levels",       u"信用等级配置表",   u"level, min_score, max_score, max_demand_level, fee_discount"],
            [u"refresh_tokens",      u"JWT 刷新令牌",      u"token, user_id, expires_at"],
        ],
        widths=[4*cm, 3.5*cm, 7.5*cm]
    ))
    story.append(SP())

    story.append(H2(u"6.2  需求与撮合域"))
    story.append(mktbl(
        [u"表名", u"用途", u"主要字段（示例）"],
        [
            [u"demands",               u"V1 版需求主表",         u"id, publisher_id, title, content, budget_min, budget_max, status"],
            [u"demand_versions",       u"需求历史版本",          u"id, demand_id, version, content, created_at"],
            [u"v2_client_demands",     u"V2 版甲方需求表",       u"id, publisher_id, title, cat_id, budget, bid_deadline, status"],
            [u"v2_outsource_demands",  u"V2 平台分发外包需求",   u"id, client_demand_id, title, opc_requirements, status"],
            [u"v2_tenders",            u"OPC 投标记录",          u"id, demand_id, opc_id, price, period, proposal, status"],
            [u"bids",                  u"V1 投标记录",           u"id, demand_id, opc_id, amount, message, status"],
        ],
        widths=[4.5*cm, 3.5*cm, 7*cm]
    ))
    story.append(SP())

    story.append(H2(u"6.3  合同与订单域"))
    story.append(mktbl(
        [u"表名", u"用途", u"主要字段（示例）"],
        [
            [u"orders",              u"V1 版订单主表",   u"id, demand_id, opc_id, publisher_id, amount, status"],
            [u"v2_outsource_orders", u"V2 版外包订单",   u"id, order_no(唯一), demand_id, opc_id, amount, status"],
            [u"v2_contracts",        u"电子合同表",      u"id, contract_no(唯一), order_id, content_md, signed_at, tax_info"],
            [u"v2_payment_plans",    u"支付计划节点",    u"id, contract_id, amount, due_date, status, paid_at"],
            [u"v2_deliverables",     u"交付物记录",      u"id, order_id, milestone, files, urls, status, review_note"],
            [u"sub_orders",          u"分账子订单",      u"order_no, sub_order_no, party_name, amount, role"],
            [u"demand_payments",     u"需求付款记录",    u"id, demand_id, amount, payment_order_no, status"],
        ],
        widths=[4.5*cm, 3*cm, 7.5*cm]
    ))
    story.append(SP())

    story.append(H2(u"6.4  大赛与题库域"))
    story.append(mktbl(
        [u"表名", u"用途", u"主要字段（示例）"],
        [
            [u"contests",               u"大赛活动主表",    u"id, title, cat_id, reg_start, reg_end, exam_start, exam_end, status"],
            [u"contest_registrations",  u"参赛报名记录",    u"id, contest_id, user_id, score, rank, cert_issued_at, status"],
            [u"contest_questions",      u"题库题目",        u"id, cat_category_id, title, content_md, attachments"],
            [u"cat_categories",         u"赛道分类配置",    u"id, name, color_hex, description, sort_order"],
            [u"demo_projects",          u"AI 演示项目",     u"id, demand_id, html_content, status, created_at"],
            [u"demo_project_versions",  u"演示项目版本历史",u"id, demo_id, html_content, created_at"],
        ],
        widths=[4.5*cm, 3*cm, 7.5*cm]
    ))
    story.append(SP())

    story.append(H2(u"6.5  AI 智能体与 Skill 域"))
    story.append(mktbl(
        [u"表名", u"用途", u"主要字段（示例）"],
        [
            [u"agent_configs",           u"智能体配置主表",       u"id, name, scene_key, model, system_prompt, enabled"],
            [u"agent_config_versions",   u"提示词版本历史",       u"id, agent_config_id, system_prompt, created_at"],
            [u"agent_task_types",        u"智能体任务类型注册",   u"task_type, label, description"],
            [u"skills",                  u"Skill 扩展包注册表",   u"id, name, source_url, content_md, synced_at"],
            [u"agent_task_skill_links",  u"任务类型与 Skill 关联",u"task_type, skill_id, sort_order"],
        ],
        widths=[4.5*cm, 3.5*cm, 7*cm]
    ))
    story.append(SP())

    story.append(H2(u"6.6  工单、通知与系统域"))
    story.append(mktbl(
        [u"表名", u"用途", u"主要字段（示例）"],
        [
            [u"v2_tickets_a",      u"A 通道工单（发布方-平台）", u"id, demand_id, creator_id, title, status, messages"],
            [u"v2_tickets_b",      u"B 通道工单（平台-OPC）",    u"id, order_id, creator_id, title, status, messages"],
            [u"notifications",     u"站内通知表",                u"id, user_id, type, title, content, read_at"],
            [u"portfolios",        u"OPC 作品集",                u"id, opc_id, title, description, files, is_public"],
            [u"site_settings",     u"平台全局配置",              u"key, value（键值对存储）"],
            [u"schema_migrations", u"数据库迁移记录",            u"id（防重复执行标识）"],
        ],
        widths=[3.8*cm, 3.7*cm, 7.5*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 7 章  接口设计说明
    # ══════════════════════════════════════════════
    story.append(H1(u"7  接口设计说明"))
    story.append(P(u"平台后端提供标准 RESTful HTTP API，所有接口前缀为 /api，采用 JSON 格式传输数据。接口文档通过 OpenAPI 3.0 规范维护，并自动生成前端 TypeScript 类型定义与 React Query Hook（通过 orval 工具链）。"))
    story.append(SP())

    story.append(H2(u"7.1  接口鉴权"))
    story.append(P(u"所有需鉴权的接口须在 HTTP 请求头携带 JWT 访问令牌："))
    story.append(Paragraph(u"<b>Authorization: Bearer &lt;access_token&gt;</b>", S["body"]))
    story.append(SP())
    story.append(P(u"令牌有效期为 2 小时，过期后客户端使用 Refresh Token 调用 /api/auth/refresh 获取新令牌。Refresh Token 有效期 30 天，存储于 HttpOnly Cookie，不暴露给 JavaScript，防止 XSS 窃取。"))
    story.append(SP())

    story.append(H2(u"7.2  核心接口模块"))
    story.append(mktbl(
        [u"模块", u"URL 前缀", u"主要功能"],
        [
            [u"认证",        u"/api/auth/*",                    u"注册、登录、刷新令牌、登出、短信验证码发送/校验"],
            [u"用户",        u"/api/users/*",                   u"用户资料查询、个人信息更新、OPC 排行榜"],
            [u"需求",        u"/api/demands/*",                 u"需求 CRUD、版本管理、状态流转"],
            [u"V2 甲方需求", u"/api/v2/client-demands/*",       u"V2 通道甲方需求管理"],
            [u"V2 外包需求", u"/api/v2/outsource-demands/*",    u"外包需求发布、投标管理"],
            [u"V2 订单",     u"/api/v2/outsource-orders/*",     u"订单状态管理、里程碑推进"],
            [u"V2 合同",     u"/api/v2/contracts/*",            u"合同生成、签署、查询"],
            [u"V2 支付",     u"/api/v2/payment-plans/*",        u"支付计划管理、支付凭证上传"],
            [u"交付物",      u"/api/v2/deliverables/*",         u"交付物提交、验收操作"],
            [u"大赛",        u"/api/contests/*",                u"大赛列表、报名、答题提交"],
            [u"工单",        u"/api/v2/tickets/*",              u"工单创建、消息发送、状态变更"],
            [u"通知",        u"/api/notifications/*",           u"通知列表、标记已读"],
            [u"文件存储",    u"/api/storage/*",                 u"文件上传（预签名 URL）、文件查询"],
            [u"智能体",      u"/api/agent/*",                   u"消息发送、对话历史查询"],
            [u"Skill 管理",  u"/api/admin/skills/*",            u"Skill 安装、同步、查询（管理员专用）"],
            [u"管理员",      u"/api/admin/*",                   u"全部管理功能接口（需 admin 角色）"],
        ],
        widths=[2.8*cm, 5.2*cm, 7*cm]
    ))
    story.append(SP())

    story.append(H2(u"7.3  响应格式规范"))
    for item in [
        u"成功响应：HTTP 200/201，Body 直接为数据对象或数组；",
        u"错误响应：HTTP 4xx/5xx，Body 格式为 { \"error\": \"错误描述\" }；",
        u"分页响应：Body 格式为 { \"items\": [...], \"total\": N, \"page\": N, \"pageSize\": N }；",
        u"文件上传：接受 multipart/form-data，文件大小限制普通附件 50MB、视频 500MB；",
        u"文件类型白名单：图片、PDF、Office 文档、Markdown、纯文本、压缩包（ZIP/RAR/7Z）、视频（MP4/WebM）。",
    ]:
        story.append(B(item))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 8 章  安全性设计
    # ══════════════════════════════════════════════
    story.append(H1(u"8  安全性设计"))
    story.append(mktbl(
        [u"安全机制", u"实现说明"],
        [
            [u"身份鉴权",    u"JWT 双令牌机制（Access Token + Refresh Token）；令牌采用 HS256 签名；Refresh Token 存储于 HttpOnly Cookie，防止 XSS 窃取"],
            [u"密码安全",    u"用户密码使用 bcrypt 算法哈希存储（cost factor >= 10）；系统不存储明文密码；忘记密码通过手机验证码重置"],
            [u"接口防护",    u"所有 API 接口通过 express-rate-limit 实施请求频率限制；登录接口单 IP 15 分钟内最多 10 次尝试，超限自动锁定"],
            [u"文件安全",    u"上传文件后端校验 MIME 类型与文件扩展名白名单（双重校验）；文件存储于 GCS 私有桶，访问须经后端签发时效性预签名 URL"],
            [u"SQL 注入防护",u"全面使用 Drizzle ORM 参数化查询，不拼接 SQL 字符串；数据库用户仅具备业务所需的最小权限"],
            [u"传输安全",    u"全站 HTTPS（mTLS），HTTP 请求强制重定向至 HTTPS；HSTS 头部防止降级攻击"],
            [u"XSS 防护",    u"前端对用户输入内容进行净化处理；Markdown 内容渲染时开启 HTML 净化；HTTP 响应头设置 Content-Security-Policy"],
            [u"CSRF 防护",   u"关键写操作接口校验 Origin/Referer 头；Refresh Token 使用 SameSite=Strict Cookie"],
            [u"权限隔离",    u"后端多层权限中间件：JWT 有效性 → 角色校验 → 账号状态校验；数据查询层按用户 ID 过滤，防止越权访问他人数据"],
            [u"操作审计",    u"管理员关键操作（资金操作、账号封禁等）记录操作日志，日志不可篡改，保留时间 >= 180 天"],
        ],
        widths=[3*cm, 12*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 9 章  性能与扩展性
    # ══════════════════════════════════════════════
    story.append(H1(u"9  性能与扩展性"))

    story.append(H2(u"9.1  性能优化措施"))
    story.append(mktbl(
        [u"优化措施", u"说明"],
        [
            [u"前端代码分割",  u"Vite 自动对路由组件进行懒加载（dynamic import），首屏仅加载必要代码，减少初始加载时间"],
            [u"服务端缓存",    u"TanStack Query 在前端实现请求级别的自动缓存与后台刷新；列表数据 staleTime 配置为 30-60 秒，减少重复请求"],
            [u"数据库索引",    u"对高频查询字段（user_id, demand_id, order_no, status, created_at）建立数据库索引，提升查询性能"],
            [u"分页查询",      u"所有列表接口强制分页（默认 10-20 条/页），避免大数据量全表查询"],
            [u"后台任务异步化",u"耗时操作（PDF 生成、批量通知发送）通过后台定时任务异步执行，不阻塞主 HTTP 请求链路"],
        ],
        widths=[3.5*cm, 11.5*cm]
    ))
    story.append(SP())

    story.append(H2(u"9.2  扩展性设计"))
    story.append(mktbl(
        [u"扩展维度", u"说明"],
        [
            [u"模块化路由",    u"后端路由按业务域拆分为独立模块（auth, demands, contests 等），新业务模块可独立添加而不影响现有逻辑"],
            [u"OpenAPI 规范",  u"接口通过 OpenAPI 3.0 规范描述；orval 工具自动生成前端 TypeScript 类型定义与 React Query Hook，降低接口变更的维护成本"],
            [u"AI 智能体扩展", u"Skill 注册中心支持从 GitHub 仓库动态安装第三方扩展包；智能体任务类型与 Skill 解耦，按需组合，无需重启服务"],
            [u"数据库迁移",    u"Drizzle ORM 管理 Schema 版本；自定义 once() 迁移机制确保每条迁移只执行一次，支持安全迭代升级"],
            [u"多角色工作台",  u"前端路由与组件按角色（pub/opc/admin）严格分区，各角色工作台可独立迭代开发，互不干扰"],
            [u"pnpm 工作区",   u"项目采用 pnpm monorepo 结构，前端、后端、共享库作为独立包管理，便于按需构建与独立部署"],
        ],
        widths=[3.5*cm, 11.5*cm]
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════
    # 第 10 章  运行环境要求
    # ══════════════════════════════════════════════
    story.append(H1(u"10  运行环境要求"))

    story.append(H2(u"10.1  服务器端环境"))
    story.append(mktbl(
        [u"环境项", u"要求"],
        [
            [u"操作系统", u"Linux（推荐 Ubuntu 22.04 LTS 或 NixOS）"],
            [u"运行时",   u"Node.js 20.x LTS 及以上"],
            [u"包管理",   u"pnpm 9.x（monorepo 工作区管理）"],
            [u"数据库",   u"PostgreSQL 15.x 及以上"],
            [u"内存",     u"建议 2GB RAM 以上（生产环境推荐 4GB+）"],
            [u"存储",     u"操作系统盘 20GB+；媒体文件使用对象存储（GCS）"],
            [u"网络",     u"开放 80（HTTP）和 443（HTTPS）端口；数据库端口仅内网可访问"],
            [u"Python",   u"Python 3.10+（用于数据库备份脚本等辅助工具）"],
        ],
        widths=[3.5*cm, 11.5*cm]
    ))
    story.append(SP())

    story.append(H2(u"10.2  客户端（浏览器）环境"))
    story.append(mktbl(
        [u"浏览器/环境", u"版本要求"],
        [
            [u"Google Chrome", u"109 及以上版本（推荐）"],
            [u"Microsoft Edge",u"109 及以上版本"],
            [u"Mozilla Firefox",u"108 及以上版本"],
            [u"Apple Safari",  u"16 及以上版本（macOS / iOS）"],
            [u"屏幕分辨率",    u"建议 1280x720 及以上（响应式设计，兼容移动端）"],
            [u"网络",          u"需要访问互联网（不支持纯内网离线部署）"],
        ],
        widths=[3.5*cm, 11.5*cm]
    ))
    story.append(SP())

    story.append(H2(u"10.3  第三方服务依赖"))
    story.append(mktbl(
        [u"服务", u"用途"],
        [
            [u"Google Cloud Storage", u"文件对象存储（附件、合同文件、交付物等），需配置服务账号密钥"],
            [u"腾讯云 SMS",           u"短信验证码与业务通知发送，需配置 SecretId/SecretKey/SignName"],
            [u"Resend",               u"邮件通知服务（可选，支持邮件通知功能），需配置 API Key"],
            [u"OpenAI / Anthropic",   u"AI 大模型 API（智能体功能，需配置对应厂商的 API Key）"],
            [u"GitHub",               u"Skill 扩展包从 GitHub 仓库拉取安装（需网络访问权限）"],
        ],
        widths=[4.5*cm, 10.5*cm]
    ))
    story.append(SP(2))

    # 版本历史
    story.append(HR())
    story.append(H2(u"版本修订记录"))
    story.append(mktbl(
        [u"版本号", u"日期", u"说明"],
        [[u"V1.0", datetime.date.today().strftime("%Y-%m-%d"), u"初始版本，软件著作权申请版本"]],
        widths=[2.5*cm, 3.5*cm, 9*cm]
    ))
    story.append(SP(2))
    story.append(Paragraph(
        u"本文档为接单吧 OPC撮合交易平台软件说明书，仅用于软件著作权申请及内部存档，未经授权不得对外发布。",
        S["footer"]
    ))
    return story

# ─── 生成 PDF ────────────────────────────────────────────────────────────────
OUT = "/home/runner/workspace/接单吧OPC撮合交易平台_软件说明书_V1.0.pdf"
doc = SimpleDocTemplate(
    OUT,
    pagesize=A4,
    leftMargin=1.8*cm, rightMargin=1.8*cm,
    topMargin=2.2*cm,  bottomMargin=2.0*cm,
    title=u"接单吧 OPC撮合交易平台 软件说明书",
    author=u"接单吧平台",
    subject=u"软件著作权申请材料",
)
doc.build(build(), onFirstPage=on_page, onLaterPages=on_page)
sz = os.path.getsize(OUT)
print(u"PDF 生成成功：%s" % OUT)
print(u"文件大小：%.1f KB  /  %.2f MB" % (sz/1024, sz/1024/1024))
