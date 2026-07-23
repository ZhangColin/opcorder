#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成软著申请用源代码文档 PDF
规则：前30页 + 后30页（共60页）；不足60页则全部输出
"""

import os, sys, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    HRFlowable, Preformatted
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# ── 字体 ──────────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
FONT_CN   = "STSong-Light"
FONT_CODE = "Courier"          # ASCII 等宽字体，覆盖全部源码字符
FONT_BOLD = "Courier-Bold"

# ── 配色 ──────────────────────────────────────────────────────────────────────
C_DARK = colors.HexColor("#1a3a6b")
C_MID  = colors.HexColor("#2c5aa0")
C_GREY = colors.HexColor("#888888")
C_BGFP = colors.HexColor("#f4f6fa")   # 文件路径背景

# ── 样式 ──────────────────────────────────────────────────────────────────────
S_TITLE  = ParagraphStyle("title",  fontName=FONT_CN,   fontSize=18, alignment=TA_CENTER,
                           leading=30, textColor=C_DARK, spaceAfter=8)
S_SUB    = ParagraphStyle("sub",    fontName=FONT_CN,   fontSize=11, alignment=TA_CENTER,
                           leading=18, textColor=C_GREY, spaceAfter=6)
S_INFO   = ParagraphStyle("info",  fontName=FONT_CN,   fontSize=10, alignment=TA_CENTER,
                           leading=16, textColor=C_GREY)
S_FPATH  = ParagraphStyle("fpath", fontName=FONT_BOLD, fontSize=8.5, alignment=TA_LEFT,
                           leading=14, textColor=C_MID,
                           backColor=C_BGFP, leftIndent=4, rightIndent=4,
                           spaceBefore=6, spaceAfter=2, borderPadding=3)
S_CODE   = ParagraphStyle("code",  fontName=FONT_CODE, fontSize=7.5, alignment=TA_LEFT,
                           leading=11, spaceAfter=0)
S_FOOTER = ParagraphStyle("foot",  fontName=FONT_CN,   fontSize=8, alignment=TA_CENTER,
                           leading=12, textColor=C_GREY)
S_LABEL  = ParagraphStyle("label", fontName=FONT_CN,   fontSize=10, alignment=TA_CENTER,
                           leading=16, textColor=colors.HexColor("#cc3300"), spaceAfter=4)

# ── 项目根目录 & 排除规则 ──────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXCLUDE_DIRS = {
    "node_modules", ".git", "dist", "build", ".local",
    ".pythonlibs", "attached_assets", "__pycache__",
    ".cache", "coverage", ".vite", ".turbo", "out",
    "generated", ".next", ".nuxt",
}
EXCLUDE_FILES = {
    "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
}
INCLUDE_EXT = {
    ".ts", ".tsx", ".py", ".sql", ".sh",
}

# ── 扫描源文件 ────────────────────────────────────────────────────────────────
def collect_files():
    result = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # 修改 dirnames 以跳过排除目录
        dirnames[:] = sorted(
            d for d in dirnames if d not in EXCLUDE_DIRS and not d.startswith(".")
        )
        for fname in sorted(filenames):
            if fname in EXCLUDE_FILES:
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in INCLUDE_EXT:
                continue
            full = os.path.join(dirpath, fname)
            rel  = os.path.relpath(full, ROOT)
            # 跳过生成物和测试数据
            if any(p in rel for p in ["dist/", "build/", ".d.ts", "node_modules"]):
                continue
            result.append((rel, full))
    return result

# ── 把一个文件拆成行列表（带行号，限 120 字符/行）──────────────────────────
MAX_LINE = 110

def file_lines(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            raw = f.readlines()
    except Exception:
        return ["<cannot read file>"]
    out = []
    for i, line in enumerate(raw, 1):
        line = line.rstrip("\n").rstrip("\r")
        # 超长行截断
        if len(line) > MAX_LINE:
            line = line[:MAX_LINE] + "  ..."
        # 替换 XML 特殊字符（Paragraph 用 XML 解析）
        line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        out.append("%4d  %s" % (i, line))
    return out

# ── 页眉页脚 ──────────────────────────────────────────────────────────────────
DOC_TITLE = u"接单吧 OPC撮合交易平台"

def on_page(canvas, doc):
    canvas.saveState()
    W, H = A4
    if doc.page > 1:
        canvas.setFillColor(C_DARK)
        canvas.rect(1.5*cm, H-1.5*cm, W-3*cm, 0.28*cm, fill=1, stroke=0)
        canvas.setFont(FONT_CN, 7.5)
        canvas.setFillColor(C_GREY)
        canvas.drawString(1.5*cm, H-1.95*cm, u"%s  源程序文档  V1.0" % DOC_TITLE)
        canvas.drawRightString(W-1.5*cm, H-1.95*cm, u"软件著作权申请材料")
        canvas.setFillColor(colors.HexColor("#cccccc"))
        canvas.line(1.5*cm, 1.4*cm, W-1.5*cm, 1.4*cm)
        canvas.setFont(FONT_CN, 7.5)
        canvas.setFillColor(C_GREY)
        canvas.drawCentredString(W/2, 0.9*cm, u"第 %d 页" % doc.page)
    canvas.restoreState()

# ── 构建所有 flowable（不分页截断，先全量生成）────────────────────────────────
def build_all_flowables(files):
    story = []
    # 封面
    story.append(Spacer(1, 2.5*cm))
    story.append(Paragraph(u"源 程 序 文 档", S_TITLE))
    story.append(HRFlowable(width="60%", thickness=1.5, color=C_DARK, spaceAfter=12))
    story.append(Paragraph(u"接单吧 OPC撮合交易平台", S_SUB))
    story.append(Paragraph(u"软件版本：V1.0", S_INFO))
    story.append(Spacer(1, 0.4*cm))
    today = datetime.date.today().strftime(u"%Y-%m-%d")
    story.append(Paragraph(u"编制日期：%s" % today, S_INFO))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(u"共收录源文件 %d 个" % len(files), S_INFO))
    story.append(PageBreak())

    for rel, full in files:
        # 文件路径标题
        story.append(Paragraph(rel, S_FPATH))
        # 代码行
        lines = file_lines(full)
        if not lines:
            story.append(Paragraph("(empty file)", S_CODE))
        else:
            block = "\n".join(lines)
            story.append(Preformatted(block, S_CODE))
        story.append(Spacer(1, 0.15*cm))

    return story

# ── 两遍渲染：第一遍计算总页数，第二遍输出截断版 ─────────────────────────────
import io
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate

PAGE_W, PAGE_H = A4
LMARGIN = 1.5*cm
RMARGIN = 1.5*cm
TMARGIN = 2.0*cm
BMARGIN = 1.8*cm

OUT = os.path.join(ROOT, u"接单吧OPC撮合交易平台_源程序文档_V1.0.pdf")

def make_doc(path):
    return SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=LMARGIN, rightMargin=RMARGIN,
        topMargin=TMARGIN,  bottomMargin=BMARGIN,
        title=u"接单吧 OPC撮合交易平台 源程序文档",
        author=u"接单吧平台",
        subject=u"软件著作权申请材料 - 源程序",
    )

# ── 策略：按文件整体分配到前30页或后30页 ─────────────────────────────────────
# 简化方案：
#   1. 收集所有文件行，按每页约 60 行估算每个文件占几页
#   2. 前面的文件塞满30页，后面的文件塞满30页
#   3. 中间文件跳过（插入分隔页说明）

LINES_PER_PAGE = 58   # 7.5pt * 11pt leading，A4 约 58 行/页

def estimate_pages(lines_count):
    """粗估一个文件的页数（不含文件头）"""
    return max(1, (lines_count + LINES_PER_PAGE - 1) // LINES_PER_PAGE)

def build_doc():
    files = collect_files()
    print(u"收集源文件数：%d" % len(files))

    # 统计每个文件的行数
    file_info = []
    total_lines = 0
    for rel, full in files:
        lines = file_lines(full)
        n = len(lines)
        total_lines += n
        file_info.append((rel, full, lines, n))

    total_estimated_pages = 2 + sum(estimate_pages(n) for _, _, _, n in file_info)  # +2 封面
    print(u"估计总页数：约 %d 页" % total_estimated_pages)

    TARGET = 60    # 目标页数
    HALF   = 30    # 前/后各占页数

    if total_estimated_pages <= TARGET:
        # 全部输出
        print(u"总页数不足 %d 页，全部输出" % TARGET)
        selected = [("ALL", fi) for fi in file_info]
        label_mid = None
    else:
        # 从头填满 HALF 页，从尾填满 HALF 页
        front = []
        front_pages = 0
        for fi in file_info:
            fp = estimate_pages(fi[3])
            if front_pages + fp > HALF:
                break
            front.append(fi)
            front_pages += fp

        back = []
        back_pages = 0
        for fi in reversed(file_info):
            fp = estimate_pages(fi[3])
            if back_pages + fp > HALF:
                break
            back.append(fi)
            back_pages += fp
        back = list(reversed(back))

        # 去重（前后可能有重叠）
        front_set = {fi[0] for fi in front}
        back = [fi for fi in back if fi[0] not in front_set]

        skipped = len(file_info) - len(front) - len(back)
        print(u"前段文件：%d 个（约 %d 页）" % (len(front), front_pages))
        print(u"后段文件：%d 个（约 %d 页）" % (len(back), back_pages))
        print(u"省略中间：%d 个文件" % skipped)

        selected = [("FRONT", fi) for fi in front]
        selected.append(("BREAK", skipped))
        selected.extend([("BACK", fi) for fi in back])
        label_mid = skipped

    # 构建 story
    story = []

    # 封面
    story.append(Spacer(1, 2.5*cm))
    story.append(Paragraph(u"源 程 序 文 档", S_TITLE))
    story.append(HRFlowable(width="60%", thickness=1.5, color=C_DARK, spaceAfter=12))
    story.append(Paragraph(u"接单吧 OPC撮合交易平台", S_SUB))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(u"软件版本：V1.0", S_INFO))
    story.append(Paragraph(u"编制日期：%s" % datetime.date.today().strftime(u"%Y-%m-%d"), S_INFO))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(u"源文件总数：%d 个    代码总行数：%d 行" % (
        len(file_info), total_lines), S_INFO))
    if total_estimated_pages > TARGET:
        story.append(Spacer(1, 0.2*cm))
        story.append(Paragraph(
            u"（依软著申请规范，本文档仅收录源代码前30页及后30页，共60页）",
            S_INFO))
    story.append(PageBreak())

    def add_file(rel, full, lines):
        story.append(Paragraph(rel, S_FPATH))
        if lines:
            block = "\n".join(lines)
            story.append(Preformatted(block, S_CODE))
        else:
            story.append(Paragraph("(empty file)", S_CODE))
        story.append(Spacer(1, 0.15*cm))

    for item in selected:
        if item[0] == "BREAK":
            skipped_count = item[1]
            story.append(PageBreak())
            story.append(Spacer(1, 3*cm))
            story.append(HRFlowable(width="80%", thickness=1, color=C_DARK))
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph(
                u"…… 中间省略约 %d 个源文件（约 %d 页）……" % (
                    skipped_count,
                    total_estimated_pages - 60
                ),
                S_LABEL
            ))
            story.append(Paragraph(
                u"依国家版权局软件著作权申请规范：源程序超过60页时，提交前30页及后30页",
                S_INFO
            ))
            story.append(Spacer(1, 0.3*cm))
            story.append(HRFlowable(width="80%", thickness=1, color=C_DARK))
            story.append(PageBreak())
        elif item[0] in ("ALL", "FRONT", "BACK"):
            _, (rel, full, lines, _) = item
            add_file(rel, full, lines)

    # 尾页声明
    story.append(PageBreak())
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph(
        u"本源程序文档依据国家版权局软件著作权登记相关规范编制，",
        S_INFO))
    story.append(Paragraph(
        u"所有源代码均为接单吧 OPC撮合交易平台原创开发成果。",
        S_INFO))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(u"编制日期：%s" % datetime.date.today().strftime(u"%Y-%m-%d"), S_INFO))

    doc = make_doc(OUT)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    sz = os.path.getsize(OUT)
    print(u"\nPDF 生成成功：%s" % OUT)
    print(u"文件大小：%.1f KB / %.2f MB" % (sz/1024, sz/1024/1024))

if __name__ == "__main__":
    build_doc()
