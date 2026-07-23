#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
软著申请 - 源代码鉴别材料
前 30 页 + 后 30 页（每页 50 行），共 60 页
不足 60 页则全部输出
"""

import os, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# ── 字体 ──────────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
CN   = "STSong-Light"
CODE = "STSong-Light"
CODB = "STSong-Light"

# ── 颜色 ──────────────────────────────────────────────────────────────────────
DARK  = colors.HexColor("#1a3a6b")
MID   = colors.HexColor("#336699")
GREY  = colors.HexColor("#777777")
LGREY = colors.HexColor("#eeeeee")
RED   = colors.HexColor("#cc2200")

# ── 样式 ──────────────────────────────────────────────────────────────────────
S = {
    "cov_t": ParagraphStyle("cov_t", fontName=CN, fontSize=20, alignment=TA_CENTER,
                             leading=32, textColor=DARK, spaceAfter=6),
    "cov_s": ParagraphStyle("cov_s", fontName=CN, fontSize=11, alignment=TA_CENTER,
                             leading=18, textColor=GREY, spaceAfter=4),
    "cov_i": ParagraphStyle("cov_i", fontName=CN, fontSize=9,  alignment=TA_CENTER,
                             leading=15, textColor=GREY),
    "fh":    ParagraphStyle("fh",    fontName=CODB, fontSize=7.5, alignment=TA_LEFT,
                             leading=12, textColor=MID, backColor=LGREY,
                             leftIndent=3, spaceBefore=4, spaceAfter=1,
                             borderPadding=(2,3,2,3)),
    "code":  ParagraphStyle("code",  fontName=CODE,  fontSize=7.5, alignment=TA_LEFT,
                             leading=13, spaceAfter=0, leftIndent=0),
    "sep":   ParagraphStyle("sep",   fontName=CN, fontSize=9, alignment=TA_CENTER,
                             leading=16, textColor=RED, spaceAfter=4),
    "foot":  ParagraphStyle("foot",  fontName=CN, fontSize=7.5, alignment=TA_CENTER,
                             leading=12, textColor=GREY),
    "info":  ParagraphStyle("info",  fontName=CN, fontSize=9, alignment=TA_CENTER,
                             leading=15, textColor=GREY),
}

# ── 常量 ──────────────────────────────────────────────────────────────────────
ROOT         = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH     = os.path.join(ROOT, u"接单吧OPC撮合交易平台_源程序文档_V1.0.pdf")
LINES_PG     = 50    # 每页 50 行代码
FRONT_PAGES  = 30
BACK_PAGES   = 30
MAX_LINE_LEN = 100   # 超过则截断

# ── 排除/包含规则 ─────────────────────────────────────────────────────────────
EXCL_DIRS = {
    "node_modules", ".git", "dist", "build", ".local", ".pythonlibs",
    "attached_assets", "__pycache__", ".cache", "coverage",
    ".vite", ".turbo", "out", "generated", ".next",
}
INCL_EXT = {".ts", ".tsx", ".py", ".sql", ".sh"}

# ── 收集源文件 ────────────────────────────────────────────────────────────────
def collect_files():
    result = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames
                             if d not in EXCL_DIRS and not d.startswith("."))
        rel_dir = os.path.relpath(dirpath, ROOT)
        for fname in sorted(filenames):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in INCL_EXT:
                continue
            full = os.path.join(dirpath, fname)
            rel  = os.path.relpath(full, ROOT)
            # 跳过生成物
            if any(p in rel for p in ["dist/", "build/", ".d.ts"]):
                continue
            result.append((rel, full))
    return result

# ── 把文件转成带行号的"展示行"列表 ──────────────────────────────────────────
def file_to_display_lines(rel, full):
    """返回 list of (tag, text)
       tag = 'header' | 'code'
    """
    out = []
    out.append(("header", rel))
    try:
        with open(full, encoding="utf-8", errors="replace") as f:
            raw = f.readlines()
    except Exception:
        out.append(("code", "    <cannot read file>"))
        return out
    for i, line in enumerate(raw, 1):
        line = line.rstrip("\r\n")
        if len(line) > MAX_LINE_LEN:
            line = line[:MAX_LINE_LEN] + " ..."
        out.append(("code", "%4d  %s" % (i, line)))
    return out

# ── 转义 XML 特殊字符 ─────────────────────────────────────────────────────────
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

# ── flowable：一个代码行 ──────────────────────────────────────────────────────
def code_para(text):
    return Paragraph(esc(text), S["code"])

def header_para(text):
    return Paragraph(esc(text), S["fh"])

# ── 页眉/页脚回调 ─────────────────────────────────────────────────────────────
SOFT_NAME = u"接单吧 OPC撮合交易平台"

def on_page(canvas, doc):
    canvas.saveState()
    W, H = A4
    if doc.page > 1:
        # 页眉
        canvas.setFillColor(DARK)
        canvas.rect(1.5*cm, H - 1.5*cm, W - 3*cm, 0.25*cm, fill=1, stroke=0)
        canvas.setFont(CN, 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(1.5*cm, H - 1.9*cm,
                          SOFT_NAME + u"  V1.0  源程序鉴别材料")
        canvas.drawRightString(W - 1.5*cm, H - 1.9*cm, u"软件著作权申请材料")
        # 页脚
        canvas.setFillColor(colors.HexColor("#cccccc"))
        canvas.line(1.5*cm, 1.35*cm, W - 1.5*cm, 1.35*cm)
        canvas.setFont(CN, 7.5)
        canvas.setFillColor(GREY)
        canvas.drawCentredString(W / 2, 0.85*cm, u"第 %d 页" % doc.page)
    canvas.restoreState()

# ── 主逻辑 ────────────────────────────────────────────────────────────────────
def build():
    files = collect_files()
    print(u"源文件数：%d" % len(files))

    # 合并所有展示行
    all_lines = []   # list of (tag, text, file_rel)
    file_count = 0
    total_code_lines = 0
    for rel, full in files:
        dl = file_to_display_lines(rel, full)
        for tag, text in dl:
            all_lines.append((tag, text, rel))
            if tag == "code":
                total_code_lines += 1
        file_count += 1

    # 每页 LINES_PG 行（仅统计 code 行）计算总页数
    total_pages_est = (total_code_lines + LINES_PG - 1) // LINES_PG
    print(u"代码总行数：%d，估计总页数：约 %d 页" % (total_code_lines, total_pages_est))

    need_truncate = total_pages_est > (FRONT_PAGES + BACK_PAGES)

    if need_truncate:
        front_line_limit = FRONT_PAGES * LINES_PG   # 前 30 页对应的 code 行数
        back_line_limit  = BACK_PAGES  * LINES_PG   # 后 30 页对应的 code 行数

        # 从头取前 front_line_limit 条 code 行（带上对应的 header 行）
        front_display = []
        code_seen = 0
        for tag, text, rel in all_lines:
            if code_seen >= front_line_limit:
                break
            front_display.append((tag, text, rel))
            if tag == "code":
                code_seen += 1

        # 从尾取后 back_line_limit 条 code 行
        back_display = []
        code_seen = 0
        for tag, text, rel in reversed(all_lines):
            if code_seen >= back_line_limit:
                break
            back_display.insert(0, (tag, text, rel))
            if tag == "code":
                code_seen += 1

        skipped_lines = total_code_lines - front_line_limit - back_line_limit
        print(u"前段：%d 行，后段：%d 行，省略：%d 行" % (
            front_line_limit, back_line_limit, skipped_lines))
    else:
        front_display = all_lines
        back_display  = []
        skipped_lines = 0
        print(u"总页数不足 %d 页，全部输出" % (FRONT_PAGES + BACK_PAGES))

    # ── 构建 story ──
    story = []

    # 封面
    story.append(Spacer(1, 2.8*cm))
    story.append(Paragraph(u"源 程 序 鉴 别 材 料", S["cov_t"]))
    story.append(HRFlowable(width="60%", thickness=1.5, color=DARK, spaceAfter=12))
    story.append(Paragraph(SOFT_NAME, S["cov_s"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(u"软件版本：V1.0", S["cov_i"]))
    story.append(Paragraph(u"编制日期：%s" % datetime.date.today().strftime("%Y-%m-%d"), S["cov_i"]))
    story.append(Spacer(1, 0.25*cm))
    story.append(Paragraph(u"源文件总数：%d 个    代码总行数：%d 行" % (
        file_count, total_code_lines), S["cov_i"]))
    if need_truncate:
        story.append(Spacer(1, 0.2*cm))
        story.append(Paragraph(
            u"（依软著申请规范：源代码超过 60 页时，提交前 30 页及后 30 页，每页约 50 行）",
            S["cov_i"]))
    story.append(PageBreak())

    # 写出一段展示行
    def emit_lines(display_lines, story):
        for tag, text, _ in display_lines:
            if tag == "header":
                story.append(Spacer(1, 0.08*cm))
                story.append(header_para("// ---- " + text + " ----"))
            else:
                story.append(code_para(text))

    if need_truncate:
        # 前段标签页
        story.append(Paragraph(u"【 前 30 页 · 源代码起始部分 】", S["sep"]))
        story.append(HRFlowable(width="80%", thickness=0.8, color=MID, spaceAfter=4))
        emit_lines(front_display, story)

        # 中间省略页
        story.append(PageBreak())
        story.append(Spacer(1, 3*cm))
        story.append(HRFlowable(width="80%", thickness=1, color=DARK, spaceAfter=8))
        story.append(Paragraph(
            u"…… 中间省略约 %d 行源代码 ……" % skipped_lines, S["sep"]))
        story.append(Spacer(1, 0.2*cm))
        story.append(Paragraph(
            u"依国家版权局《计算机软件著作权登记办法》相关规定，",
            S["info"]))
        story.append(Paragraph(
            u"源程序超过 60 页时，提交前 30 页及后 30 页作为鉴别材料。",
            S["info"]))
        story.append(HRFlowable(width="80%", thickness=1, color=DARK, spaceAfter=8))
        story.append(PageBreak())

        # 后段标签页
        story.append(Paragraph(u"【 后 30 页 · 源代码结束部分 】", S["sep"]))
        story.append(HRFlowable(width="80%", thickness=0.8, color=MID, spaceAfter=4))
        emit_lines(back_display, story)
    else:
        emit_lines(front_display, story)

    # 尾页
    story.append(PageBreak())
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph(u"本源程序鉴别材料依据国家版权局软件著作权登记相关规范编制，", S["info"]))
    story.append(Paragraph(u"所有源代码均为接单吧 OPC撮合交易平台原创开发成果。", S["info"]))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(u"编制日期：%s" % datetime.date.today().strftime("%Y-%m-%d"), S["info"]))

    doc = SimpleDocTemplate(
        OUT_PATH,
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=2.0*cm,  bottomMargin=1.8*cm,
        title=u"接单吧 OPC撮合交易平台 源程序鉴别材料",
        author=u"接单吧平台",
        subject=u"软件著作权申请材料",
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    sz = os.path.getsize(OUT_PATH)
    print(u"\n✅ PDF 生成成功：%s" % OUT_PATH)
    print(u"   大小：%.1f KB / %.2f MB" % (sz/1024, sz/1024/1024))

if __name__ == "__main__":
    build()
