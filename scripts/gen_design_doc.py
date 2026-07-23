#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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

pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
pdfmetrics.registerFont(UnicodeCIDFont('MSung-Light'))
FN = 'STSong-Light'
FB = 'MSung-Light'
FC = 'Courier'

C1 = colors.HexColor('#1a3a6b')
C2 = colors.HexColor('#2c5aa0')
CA = colors.HexColor('#eef2f8')
CG = colors.HexColor('#c0c8d8')
CGR= colors.HexColor('#666666')

W, H = A4

def sty(name, **k): return ParagraphStyle(name, **k)
S = {
    'cov_t': sty('cov_t',fontName=FB,fontSize=22,alignment=TA_CENTER,leading=34,textColor=C1,spaceAfter=8),
    'cov_s': sty('cov_s',fontName=FN,fontSize=13,alignment=TA_CENTER,leading=20,textColor=CGR,spaceAfter=6),
    'cov_i': sty('cov_i',fontName=FN,fontSize=11,alignment=TA_CENTER,leading=18,textColor=CGR),
    'h1':    sty('h1',   fontName=FB,fontSize=15,textColor=C1,leading=24,spaceBefore=16,spaceAfter=8),
    'h2':    sty('h2',   fontName=FB,fontSize=12,textColor=C2,leading=20,spaceBefore=10,spaceAfter=6),
    'h3':    sty('h3',   fontName=FB,fontSize=10.5,textColor=colors.HexColor('#333'),leading=18,spaceBefore=7,spaceAfter=4),
    'body':  sty('body', fontName=FN,fontSize=10,alignment=TA_JUSTIFY,leading=18,spaceAfter=4),
    'bul':   sty('bul',  fontName=FN,fontSize=10,alignment=TA_LEFT,leading=18,spaceAfter=3,leftIndent=14),
    'th':    sty('th',   fontName=FB,fontSize=9,alignment=TA_CENTER,leading=14,textColor=colors.white),
    'tc':    sty('tc',   fontName=FN,fontSize=8.5,alignment=TA_LEFT,leading=13),
    'code':  sty('code', fontName=FC,fontSize=8,alignment=TA_LEFT,leading=12),
    'foot':  sty('foot', fontName=FN,fontSize=7.5,alignment=TA_CENTER,leading=12,textColor=CGR),
    'toc':   sty('toc',  fontName=FN,fontSize=10,alignment=TA_LEFT,leading=18,spaceAfter=2),
    'tocpg': sty('tocpg',fontName=FN,fontSize=10,alignment=TA_CENTER,leading=18,spaceAfter=2),
    'cih':   sty('cih',  fontName=FB,fontSize=11,alignment=TA_CENTER,leading=18,textColor=C1),
    'civ':   sty('civ',  fontName=FN,fontSize=11,alignment=TA_LEFT,leading=18),
}

def H1(t): return Paragraph(t, S['h1'])
def H2(t): return Paragraph(t, S['h2'])
def H3(t): return Paragraph(t, S['h3'])
def P(t):  return Paragraph(t, S['body'])
def B(t):  return Paragraph('\u2022 ' + t, S['bul'])
def C(t):  return Paragraph(t, S['code'])
def SP(n=1):return Spacer(1, n*0.3*cm)
def HR():  return HRFlowable(width='100%',thickness=0.5,color=CG,spaceAfter=4)

def tbl(headers, rows, widths=None):
    data = [[Paragraph(h,S['th']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(v),S['tc']) for v in row])
    ts = TableStyle([
        ('BACKGROUND',(0,0),(-1,0),C1),
        ('FONTNAME',(0,0),(-1,-1),FN),('FONTNAME',(0,0),(-1,0),FB),
        ('FONTSIZE',(0,0),(-1,-1),8.5),('FONTSIZE',(0,0),(-1,0),9),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,CA]),
        ('GRID',(0,0),(-1,-1),0.4,CG),
        ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
        ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
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
        canvas.drawString(1.5*cm,H-1.9*cm,'\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0  \u8f6f\u4ef6\u8bbe\u8ba1\u8bf4\u660e\u4e66  V1.0')
        canvas.drawRightString(W-1.5*cm,H-1.9*cm,'\u8f6f\u4ef6\u8457\u4f5c\u6743\u7533\u8bf7\u6750\u6599')
        canvas.setFillColor(CG)
        canvas.line(1.5*cm,1.4*cm,W-1.5*cm,1.4*cm)
        canvas.setFont(FN,7.5); canvas.setFillColor(CGR)
        canvas.drawCentredString(W/2,0.9*cm,'\u7b2c %d \u9875' % doc.page)
    canvas.restoreState()

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   '\u63a5\u5355\u5427OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0_\u8f6f\u4ef6\u8bbe\u8ba1\u8bf4\u660e\u4e66_V1.0.pdf')

def build():
    story = []
    today = datetime.date.today().strftime('%Y-%m-%d')

    # Cover
    story += [Spacer(1,3*cm),
              Paragraph('\u8f6f\u4ef6\u8bbe\u8ba1\u8bf4\u660e\u4e66',S['cov_t']),
              HRFlowable(width='60%',thickness=2,color=C1,spaceAfter=14),
              Paragraph('\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0',S['cov_s']),
              Spacer(1,3.5*cm)]
    cov_data=[
        ['\u8f6f\u4ef6\u540d\u79f0','\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0'],
        ['\u7248\u672c\u53f7','V1.0'],
        ['\u6587\u6863\u7f16\u53f7','JDB-SDS-2026-001'],
        ['\u7f16\u5236\u4f9d\u636e','GB/T 8567-2006 \u8ba1\u7b97\u673a\u8f6f\u4ef6\u6587\u6863\u7f16\u5236\u89c4\u8303'],
        ['\u7f16\u5236\u65e5\u671f',today],
        ['\u5bc6\u7ea7','\u5185\u90e8\u8d44\u6599'],
    ]
    ct = Table([[Paragraph(r[0],S['cih']),Paragraph(r[1],S['civ'])] for r in cov_data],
               colWidths=[5*cm,9*cm])
    ct.setStyle(TableStyle([
        ('GRID',(0,0),(-1,-1),0.5,CG),
        ('BACKGROUND',(0,0),(0,-1),CA),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LEFTPADDING',(0,0),(-1,-1),10),
    ]))
    story += [ct, PageBreak()]

    # TOC
    story.append(H1('\u76ee  \u5f55'))
    toc = [
        ('1','\u5f15\u8a00','3'),
        ('1.1','\u7f16\u5199\u76ee\u7684','3'),
        ('1.2','\u80cc\u666f','3'),
        ('1.3','\u5b9a\u4e49\u4e0e\u7f29\u7565\u8bed','4'),
        ('1.4','\u53c2\u8003\u8d44\u6599','5'),
        ('2','\u603b\u4f53\u8bbe\u8ba1','5'),
        ('2.1','\u529f\u80fd\u9700\u6c42','5'),
        ('2.2','\u8fd0\u884c\u73af\u5883','7'),
        ('2.3','\u57fa\u672c\u8bbe\u8ba1\u6982\u5ff5\u548c\u5904\u7406\u6d41\u7a0b','8'),
        ('2.4','\u67b6\u6784\u8bbe\u8ba1','10'),
        ('2.5','\u6280\u672f\u9009\u578b','12'),
        ('3','\u6a21\u5757\u8bbe\u8ba1','14'),
        ('3.1','\u7528\u6237\u8ba4\u8bc1\u6a21\u5757','14'),
        ('3.2','\u9700\u6c42\u53d1\u5e03\u4e0e\u64ae\u5408\u6a21\u5757','15'),
        ('3.3','\u5408\u540c\u4e0e\u8ba2\u5355\u6a21\u5757','16'),
        ('3.4','\u4ea4\u4ed8\u4e0e\u9a8c\u6536\u6a21\u5757','17'),
        ('3.5','\u8d22\u52a1\u7ed3\u7b97\u6a21\u5757','18'),
        ('3.6','\u5927\u8d5b\u4e0e\u8ba4\u8bc1\u6a21\u5757','19'),
        ('3.7','AI \u667a\u80fd\u4f53\u6a21\u5757','20'),
        ('3.8','\u5de5\u5355\u4e0e\u901a\u77e5\u6a21\u5757','21'),
        ('3.9','\u6587\u4ef6\u5b58\u50a8\u6a21\u5757','22'),
        ('4','\u6570\u636e\u5e93\u8bbe\u8ba1','23'),
        ('4.1','\u6982\u8ff0','23'),
        ('4.2','\u6570\u636e\u8868\u8bbe\u8ba1','24'),
        ('5','\u63a5\u53e3\u8bbe\u8ba1','42'),
        ('5.1','\u63a5\u53e3\u89c4\u8303','42'),
        ('5.2','\u8ba4\u8bc1\u63a5\u53e3','43'),
        ('5.3','\u7528\u6237\u4e0e\u8d44\u6599\u63a5\u53e3','44'),
        ('5.4','\u9700\u6c42\u63a5\u53e3','45'),
        ('5.5','V2 \u4e1a\u52a1\u6838\u5fc3\u63a5\u53e3','46'),
        ('5.6','\u5927\u8d5b\u63a5\u53e3','49'),
        ('5.7','AI \u667a\u80fd\u4f53\u63a5\u53e3','50'),
        ('5.8','\u7ba1\u7406\u5458\u63a5\u53e3','51'),
        ('5.9','\u6587\u4ef6\u5b58\u50a8\u4e0e\u901a\u77e5\u63a5\u53e3','53'),
        ('6','\u5b89\u5168\u8bbe\u8ba1','54'),
        ('7','\u5173\u952e\u7b97\u6cd5\u4e0e\u6d41\u7a0b','57'),
        ('7.1','JWT \u53cc\u4ee4\u724c\u9274\u6743\u6d41\u7a0b','57'),
        ('7.2','\u4e1a\u52a1\u7f16\u53f7\u751f\u6210\u7b97\u6cd5','58'),
        ('7.3','\u6587\u4ef6\u4e0a\u4f20\u6d41\u7a0b','59'),
        ('7.4','\u6570\u636e\u5e93\u8fc1\u79fb\u673a\u5236','60'),
    ]
    ind = '\u3000\u3000'
    toc_rows = [[Paragraph(('' if len(n)==1 else ind)+n+'\u3000'+title,S['toc']),
                 Paragraph(pg,S['tocpg'])] for n,title,pg in toc]
    tt = Table(toc_rows,colWidths=[13.5*cm,1.5*cm])
    tt.setStyle(TableStyle([
        ('LINEBELOW',(0,0),(-1,-1),0.3,colors.HexColor('#dddddd')),
        ('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),
    ]))
    story += [tt, PageBreak()]

    # ===== Chapter 1: Introduction =====
    story.append(H1('1  \u5f15\u8a00'))
    story.append(H2('1.1  \u7f16\u5199\u76ee\u7684'))
    story.append(P('\u672c\u6587\u6863\u662f\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0\uff08\u4ee5\u4e0b\u7b80\u79f0\u300c\u5e73\u53f0\u300d\u6216\u300c\u672c\u7cfb\u7edf\u300d\uff09\u7684\u8f6f\u4ef6\u8bbe\u8ba1\u8bf4\u660e\u4e66\uff0c\u4f9d\u636e GB/T 8567-2006\u300a\u8ba1\u7b97\u673a\u8f6f\u4ef6\u6587\u6863\u7f16\u5236\u89c4\u8303\u300b\u7f16\u5236\u3002\u672c\u6587\u6863\u65e8\u5728\uff1a'))
    for t in [
        '\u660e\u786e\u7cfb\u7edf\u7684\u603b\u4f53\u67b6\u6784\u8bbe\u8ba1\u65b9\u6848\uff0c\u4e3a\u5f00\u53d1\u56e2\u961f\u63d0\u4f9b\u7edf\u4e00\u7684\u6280\u672f\u5b9e\u73b0\u6307\u5bfc\uff1b',
        '\u8be6\u7ec6\u63cf\u8ff0\u5404\u529f\u80fd\u6a21\u5757\u7684\u8bbe\u8ba1\u7ec6\u8282\u3001\u6570\u636e\u6d41\u7a0b\u53ca\u6a21\u5757\u95f4\u7684\u63a5\u53e3\u5173\u7cfb\uff1b',
        '\u89c4\u8303\u6570\u636e\u5e93\u8868\u7ed3\u6784\u8bbe\u8ba1\uff0c\u4f5c\u4e3a\u6570\u636e\u6301\u4e45\u5316\u5c42\u7684\u6743\u5a01\u53c2\u8003\uff1b',
        '\u5b9a\u4e49\u7cfb\u7edf\u5bf9\u5916\u5f00\u653e\u7684 RESTful API \u63a5\u53e3\u89c4\u8303\uff1b',
        '\u63cf\u8ff0\u7cfb\u7edf\u5b89\u5168\u673a\u5236\u4e0e\u5173\u952e\u7b97\u6cd5\uff0c\u4fdd\u969c\u5e73\u53f0\u7684\u7a33\u5b9a\u6027\u4e0e\u5b89\u5168\u6027\uff1b',
        '\u4e3a\u8f6f\u4ef6\u8457\u4f5c\u6743\u767b\u8bb0\u7533\u8bf7\u63d0\u4f9b\u5b8c\u6574\u7684\u6280\u672f\u6587\u6863\u652f\u6490\u6750\u6599\u3002',
    ]:
        story.append(B(t))
    story.append(SP(2))

    story.append(H2('1.2  \u80cc\u666f'))
    story.append(P('\u968f\u7740\u56fd\u5185\u6570\u5b57\u5316\u5916\u5305\u670d\u52a1\u5e02\u573a\u7684\u6301\u7eed\u6269\u5927\uff0c\u4f01\u4e1a\u5bf9\u5916\u5305\u670d\u52a1\u5546\uff08OPC\uff0cOrder Processing Center\uff09\u7684\u9700\u6c42\u65e5\u76ca\u589e\u957f\uff0c\u4f46\u5e02\u573a\u4e0a\u666e\u904d\u5b58\u5728\u4fe1\u606f\u4e0d\u900f\u660e\u3001\u64ae\u5408\u6548\u7387\u4f4e\u3001\u5408\u540c\u6267\u884c\u4e0d\u89c4\u8303\u7b49\u95ee\u9898\uff0c\u4e25\u91cd\u5236\u7ea6\u4e86\u5916\u5305\u670d\u52a1\u5e02\u573a\u7684\u5065\u5eb7\u53d1\u5c55\u3002'))
    story.append(SP())
    story.append(P('\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0\u7531\u672c\u56e2\u961f\u81ea\u4e3b\u7814\u53d1\uff0c\u662f\u4e00\u5957\u9762\u5411\u4f01\u4e1a\u7ea7\u5e94\u7528\u573a\u666f\u7684\u5916\u5305\u670d\u52a1\u4ea4\u6613\u64ae\u5408\u7cfb\u7edf\u3002\u5e73\u53f0\u56f4\u7ed5\u300c\u53d1\u5e03\u65b9\uff08\u7532\u65b9\uff09- \u5e73\u53f0\u64ae\u5408 - OPC\uff08\u670d\u52a1\u5546\uff09\u300d\u4e09\u65b9\u751f\u6001\u6784\u5efa\uff0c\u8986\u76d6\u4ece\u9700\u6c42\u53d1\u5e03\u3001\u667a\u80fd\u7b5b\u9009\u3001\u7535\u5b50\u5408\u540c\u3001\u4ea4\u4ed8\u9a8c\u6536\u3001\u8d22\u52a1\u7ed3\u7b97\u5230 OPC \u80fd\u529b\u8ba4\u8bc1\u7684\u5b8c\u6574\u4e1a\u52a1\u95ed\u73af\u3002'))
    story.append(SP())
    story.append(P('\u5e73\u53f0\u6280\u672f\u67b6\u6784\u57fa\u4e8e React 18 + Node.js + PostgreSQL \u6784\u5efa\uff0c\u91c7\u7528\u524d\u540e\u7aef\u5206\u79bb\u6a21\u5f0f\uff0c\u652f\u6301\u591a\u89d2\u8272\u3001\u591a\u4e1a\u52a1\u6d41\u5e76\u884c\u8fd0\u884c\u3002\u7cfb\u7edf\u96c6\u6210 AI \u5927\u6a21\u578b\uff08OpenAI / Anthropic\uff09\u9a71\u52a8\u7684\u667a\u80fd\u4f53\uff08Agent\uff09\u6a21\u5757\uff0c\u8fdb\u4e00\u6b65\u63d0\u5347\u64ae\u5408\u8d28\u91cf\u4e0e\u8fd0\u8425\u6548\u7387\u3002'))
    story.append(SP(2))

    story.append(H2('1.3  \u5b9a\u4e49\u4e0e\u7f29\u7565\u8bed'))
    story.append(tbl(
        ['\u672f\u8bed/\u7f29\u5199','\u5168\u79f0','\u8bf4\u660e'],
        [
            ['OPC','Order Processing Center','\u5916\u5305\u670d\u52a1\u63d0\u4f9b\u5546\uff0c\u5e73\u53f0\u4e0a\u7684\u63a5\u5355\u65b9/\u670d\u52a1\u5546'],
            ['\u53d1\u5e03\u65b9','Publisher','\u9700\u6c42\u53d1\u5e03\u65b9\uff0c\u5373\u7532\u65b9/\u4f01\u4e1a\u5ba2\u6237'],
            ['B/S','Browser/Server','\u6d4f\u89c8\u5668/\u670d\u52a1\u5668\u67b6\u6784'],
            ['SPA','Single Page Application','\u5355\u9875\u5e94\u7528\u7a0b\u5e8f'],
            ['ORM','Object Relational Mapping','\u5bf9\u8c61\u5173\u7cfb\u6620\u5c04\uff0c\u7528\u4e8e\u6570\u636e\u5e93\u64cd\u4f5c'],
            ['JWT','JSON Web Token','\u7528\u4e8e\u65e0\u72b6\u6001\u8eab\u4efd\u9274\u6743\u7684\u4ee4\u724c\u683c\u5f0f'],
            ['API','Application Programming Interface','\u5e94\u7528\u7a0b\u5e8f\u7f16\u7a0b\u63a5\u53e3'],
            ['RESTful','Representational State Transfer','\u57fa\u4e8e HTTP \u7684\u6807\u51c6\u5316\u63a5\u53e3\u8bbe\u8ba1\u98ce\u683c'],
            ['GCS','Google Cloud Storage','\u8c37\u6b4c\u4e91\u5bf9\u8c61\u5b58\u50a8\u670d\u52a1'],
            ['CAT','Category','\u5e73\u53f0\u5b9a\u4e49\u7684 OPC \u4e13\u4e1a\u80fd\u529b\u8d5b\u9053\u5206\u7c7b'],
            ['V2','Version 2','\u5e73\u53f0\u7b2c\u4e8c\u7248\u4e1a\u52a1\u901a\u9053\uff08\u53cc\u901a\u9053\u64ae\u5408\u6a21\u5f0f\uff09'],
            ['HTTPS','HyperText Transfer Protocol Secure','\u52a0\u5bc6\u7684 HTTP \u901a\u4fe1\u534f\u8bae'],
            ['mTLS','Mutual TLS','\u53cc\u5411 TLS \u8ba4\u8bc1\uff0c\u7528\u4e8e\u670d\u52a1\u95f4\u901a\u4fe1\u5b89\u5168'],
            ['HSTS','HTTP Strict Transport Security','\u5f3a\u5236\u4f7f\u7528 HTTPS \u7684\u5b89\u5168\u7b56\u7565\u5934'],
            ['CSP','Content Security Policy','\u5185\u5bb9\u5b89\u5168\u7b56\u7565\uff0c\u9632\u6b62 XSS \u653b\u51fb'],
            ['XSS','Cross-Site Scripting','\u8de8\u7ad9\u811a\u672c\u653b\u51fb'],
            ['bcrypt','-','\u5bc6\u7801\u54c8\u5e0c\u7b97\u6cd5\uff0c\u7528\u4e8e\u5b89\u5168\u5b58\u50a8\u7528\u6237\u5bc6\u7801'],
        ],
        widths=[2.8*cm,5*cm,7.2*cm]
    ))
    story.append(SP(2))

    story.append(H2('1.4  \u53c2\u8003\u8d44\u6599'))
    for t in [
        'GB/T 8567-2006 \u300a\u8ba1\u7b97\u673a\u8f6f\u4ef6\u6587\u6863\u7f16\u5236\u89c4\u8303\u300b',
        'GB/T 9385-2008 \u300a\u8ba1\u7b97\u673a\u8f6f\u4ef6\u9700\u6c42\u8bf4\u660e\u7f16\u5236\u6307\u5357\u300b',
        'RFC 7519 \u300aJSON Web Token (JWT)\u300b',
        'OpenAPI Specification 3.0.3',
        'PostgreSQL 15 \u5b98\u65b9\u6587\u6863',
        'Drizzle ORM \u5b98\u65b9\u6587\u6863\uff08https://orm.drizzle.team\uff09',
        'React 18 \u5b98\u65b9\u6587\u6863\uff08https://react.dev\uff09',
        'Express.js 4.x \u5b98\u65b9\u6587\u6863',
        'Google Cloud Storage \u5b98\u65b9\u6587\u6863',
    ]:
        story.append(B(t))
    story.append(PageBreak())

    # ===== Chapter 2: Overall Design =====
    story.append(H1('2  \u603b\u4f53\u8bbe\u8ba1'))
    story.append(H2('2.1  \u529f\u80fd\u9700\u6c42'))
    story.append(P('\u7cfb\u7edf\u9700\u6ee1\u8db3\u4ee5\u4e0b\u56db\u7c7b\u7528\u6237\u89d2\u8272\u7684\u529f\u80fd\u9700\u6c42\uff1a'))
    story.append(SP())
    story.append(H3('2.1.1  \u516c\u4f17/\u8bbf\u5ba2\u529f\u80fd\u9700\u6c42'))
    story.append(tbl(['\u7f16\u53f7','\u9700\u6c42\u63cf\u8ff0','\u4f18\u5148\u7ea7'],[
        ['F-G-01','\u6d4f\u89c8\u5e73\u53f0\u9996\u9875\uff0c\u67e5\u770b\u5e73\u53f0\u6838\u5fc3\u6570\u636e\u7edf\u8ba1\u4e0e\u529f\u80fd\u4ecb\u7ecd','\u9ad8'],
        ['F-G-02','\u6d4f\u89c8\u516c\u5f00\u9700\u6c42\u5927\u5385\uff0c\u67e5\u770b\u9700\u6c42\u6458\u8981\u4fe1\u606f\uff08\u9884\u7b97\u3001\u7c7b\u522b\u3001\u622a\u6b62\u7b49\uff09','\u9ad8'],
        ['F-G-03','\u6d4f\u89c8 OPC \u4e2a\u4eba\u4f5c\u54c1\u96c6\uff08\u6280\u80fd\u6807\u7b7e\u3001\u9879\u76ee\u6848\u4f8b\u3001\u8ba4\u8bc1\u8bc1\u4e66\uff09','\u9ad8'],
        ['F-G-04','\u6d4f\u89c8\u793e\u533a\u5e7f\u573a\u5185\u5bb9\uff08\u52a8\u6001\u3001\u6848\u4f8b\u3001\u6587\u7ae0\uff09\uff0c\u53c2\u4e0e\u70b9\u8d5e\u8bc4\u8bba','\u4e2d'],
        ['F-G-05','\u6d4f\u89c8\u5b66\u4e60\u4e2d\u5fc3\u57f9\u8bad\u8d44\u6599\u4e0e\u884c\u4e1a\u6587\u7ae0','\u4e2d'],
        ['F-G-06','\u67e5\u770b\u5927\u8d5b\u516c\u544a\u4e0e\u8d5b\u5236\u89c4\u5219','\u4e2d'],
        ['F-G-07','\u7528\u6237\u6ce8\u518c\uff08\u586b\u5199\u90ae\u7b261/\u624b\u673a/\u5bc6\u7801\uff0c\u9009\u62e9\u89d2\u8272\uff0c\u77ed\u4fe1\u9a8c\u8bc1\uff09','\u9ad8'],
    ],widths=[2.5*cm,10.5*cm,2*cm]))
    story.append(SP())

    story.append(H3('2.1.2  OPC \u670d\u52a1\u5546\u529f\u80fd\u9700\u6c42'))
    story.append(tbl(['\u7f16\u53f7','\u9700\u6c42\u63cf\u8ff0','\u4f18\u5148\u7ea7'],[
        ['F-O-01','\u67e5\u770b\u63a5\u5355\u5927\u5385\u5168\u90e8\u5916\u5305\u9700\u6c42\uff0c\u652f\u6301\u591a\u6761\u4ef6\u7b5b\u9009\uff08\u7c7b\u522b\u3001\u9884\u7b97\u3001\u622a\u6b62\u65f6\u95f4\u7b49\uff09','\u9ad8'],
        ['F-O-02','\u5bf9\u76ee\u6807\u9700\u6c42\u63d0\u4ea4\u6295\u6807\uff08\u62a5\u4ef7\u3001\u5468\u671f\u3001\u65b9\u6848\u8bf4\u660e\u3001\u9644\u4ef6\uff09','\u9ad8'],
        ['F-O-03','\u7ba1\u7406\u5df2\u63d0\u4ea4\u7684\u6295\u6807\u8bb0\u5f55\uff0c\u67e5\u770b\u72b6\u6001\u53ca\u5e73\u53f0/\u53d1\u5e03\u65b9\u53cd\u9988','\u9ad8'],
        ['F-O-04','\u63a5\u53d7\u4e2d\u6807\u901a\u77e5\u5e76\u786e\u8ba4\uff0c\u8fdb\u5165\u5408\u540c\u7b7e\u7f72\u73af\u8282','\u9ad8'],
        ['F-O-05','\u5728\u7ebf\u9605\u8bfb\u5e76\u7b7e\u7f72\u7535\u5b50\u5408\u540c','\u9ad8'],
        ['F-O-06','\u6309\u91cc\u7a0b\u7891\u4e0a\u4f20\u4ea4\u4ed8\u7269\uff08\u652f\u6301\u591a\u6587\u4ef6\uff09\uff0c\u586b\u5199\u4ea4\u4ed8\u8bf4\u660e','\u9ad8'],
        ['F-O-07','\u67e5\u770b\u8ba2\u5355\u6267\u884c\u72b6\u6001\u3001\u91cc\u7a0b\u7891\u5012\u8ba1\u65f6\u4e0e\u9a8c\u6536\u53cd\u9988','\u9ad8'],
        ['F-O-08','\u5728\u7ebf\u7533\u8bf7\u8d22\u52a1\u7ed3\u7b97\uff0c\u7ef4\u62a4\u94f6\u884c\u6536\u6b3e\u4fe1\u606f','\u9ad8'],
        ['F-O-09','\u5927\u8d5b\u62a5\u540d\u3001\u5728\u7ebf\u7b54\u9898\u3001\u63d0\u4ea4\u4f5c\u54c1','\u4e2d'],
        ['F-O-10','\u67e5\u770b\u5927\u8d5b\u6210\u7ee9\u4e0e\u6392\u540d\uff0c\u83b7\u53d6\u7535\u5b50\u8ba4\u8bc1\u8bc1\u4e66','\u4e2d'],
        ['F-O-11','\u7ef4\u62a4\u4e2a\u4eba\u8d44\u6599\u4e0e\u4f5c\u54c1\u96c6\uff08\u516c\u5f00\u5c55\u793a\uff09','\u4e2d'],
        ['F-O-12','\u67e5\u770b\u4fe1\u7528\u5206\u4e0e\u7b49\u7ea7\uff0c\u4e86\u89e3\u63d0\u5347\u5efa\u8bae','\u4f4e'],
        ['F-O-13','\u53d1\u8d77\u552e\u540e\u5de5\u5355\uff0c\u4e0e\u7ba1\u7406\u5458\u534f\u5546\u4e89\u8bae','\u4e2d'],
        ['F-O-14','\u63a5\u6536\u5e76\u67e5\u770b\u7ad9\u5185\u901a\u77e5\uff08\u4e2d\u6807\u3001\u9a8c\u6536\u3001\u7ed3\u7b97\u7b49\uff09','\u9ad8'],
    ],widths=[2.5*cm,10.5*cm,2*cm]))
    story.append(SP())

    story.append(H3('2.1.3  \u53d1\u5e03\u65b9\u529f\u80fd\u9700\u6c42'))
    story.append(tbl(['\u7f16\u53f7','\u9700\u6c42\u63cf\u8ff0','\u4f18\u5148\u7ea7'],[
        ['F-P-01','\u53d1\u5e03\u9700\u6c42\uff08Markdown \u5bcc\u6587\u672c\u7f16\u8f91\u5668\u3001\u7c7b\u522b\u3001\u9884\u7b97\u3001\u622a\u6b62\u65f6\u95f4\u3001\u8d44\u8d28\u8981\u6c42\u3001\u9644\u4ef6\uff09','\u9ad8'],
        ['F-P-02','\u7ba1\u7406\u5df2\u53d1\u5e03\u9700\u6c42\uff0c\u67e5\u770b\u5ba1\u6838\u72b6\u6001\uff0c\u9a73\u56de\u65f6\u4fee\u6539\u5e76\u91cd\u65b0\u63d0\u4ea4','\u9ad8'],
        ['F-P-03','\u67e5\u770b\u9700\u6c42\u7684\u6240\u6709\u6295\u6807\u8bb0\u5f55\uff0c\u7b5b\u9009\u5e76\u786e\u8ba4\u4e2d\u6807 OPC','\u9ad8'],
        ['F-P-04','\u5728\u7ebf\u9605\u8bfb\u5e76\u7b7e\u7f72\u7535\u5b50\u5408\u540c\uff0c\u7ef4\u62a4\u5f00\u7968\u4fe1\u606f','\u9ad8'],
        ['F-P-05','\u6309\u652f\u4ed8\u8ba1\u5212\u4e0a\u4f20\u4ed8\u6b3e\u51ed\u8bc1\uff0c\u63d0\u4ea4\u652f\u4ed8','\u9ad8'],
        ['F-P-06','\u5728\u7ebf\u5ba1\u67e5 OPC \u63d0\u4ea4\u7684\u4ea4\u4ed8\u7269\uff0c\u586b\u5199\u9a8c\u6536\u610f\u89c1\uff08\u901a\u8fc7/\u62d2\u7edd\uff09','\u9ad8'],
        ['F-P-07','\u9a8c\u6536\u4e89\u8bae\u65f6\u53d1\u8d77\u5de5\u5355\uff0c\u7533\u8bf7\u5e73\u53f0\u4ed2\u88c1','\u4e2d'],
        ['F-P-08','\u67e5\u770b\u5386\u53f2\u8ba2\u5355\u4e0e\u652f\u4ed8\u8bb0\u5f55\uff0c\u5bfc\u51fa\u5bf9\u8d26\u5355','\u4e2d'],
        ['F-P-09','\u7ef4\u62a4\u673a\u6784\u8d44\u6599\uff08\u516c\u53f8\u4fe1\u606f\u3001\u8054\u7cfb\u65b9\u5f0f\u3001\u7a0e\u52a1\u4fe1\u606f\uff09','\u4e2d'],
    ],widths=[2.5*cm,10.5*cm,2*cm]))
    story.append(SP())

    story.append(H3('2.1.4  \u7ba1\u7406\u5458\u529f\u80fd\u9700\u6c42'))
    story.append(tbl(['\u7f16\u53f7','\u9700\u6c42\u63cf\u8ff0','\u4f18\u5148\u7ea7'],[
        ['F-A-01','\u6570\u636e\u770b\u677f\uff1a\u6838\u5fc3 KPI \u5b9e\u65f6\u5c55\u793a\uff08\u7528\u6237\u6570\u3001\u9700\u6c42\u91cf\u3001\u6210\u4ea4\u989d\u3001\u5b8c\u6210\u7387\u7b49\uff09','\u9ad8'],
        ['F-A-02','\u7528\u6237\u5ba1\u6838\uff1a\u5ba1\u6279 OPC \u4e0e\u53d1\u5e03\u65b9\u6ce8\u518c\u7533\u8bf7\uff0c\u652f\u6301\u9a73\u56de\u5e76\u586b\u5199\u539f\u56e0','\u9ad8'],
        ['F-A-03','\u9700\u6c42\u5ba1\u6838\uff1a\u5185\u5bb9\u5408\u89c4\u6027\u5ba1\u6838\uff0c\u901a\u8fc7\u540e\u63a8\u9001\u81f3\u63a5\u5355\u5927\u5385','\u9ad8'],
        ['F-A-04','V2 \u53cc\u901a\u9053\u4e1a\u52a1\u5168\u6d41\u7a0b\u76d1\u63a7\uff08\u7532\u65b9\u9700\u6c42\u3001\u5916\u5305\u8ba2\u5355\u3001\u5408\u540c\u3001\u652f\u4ed8\u3001\u4ea4\u4ed8\u7269\uff09','\u9ad8'],
        ['F-A-05','\u8d22\u52a1\u7ed3\u7b97\u5ba1\u6279\uff1a\u5ba1\u6838 OPC \u7ed3\u7b97\u7533\u8bf7\uff0c\u786e\u8ba4\u5230\u8d26\u540e\u64cd\u4f5c\u653e\u6b3e','\u9ad8'],
        ['F-A-06','OPC \u4eba\u624d\u5e93\uff1a\u67e5\u770b OPC \u8be6\u60c5\u3001\u4fe1\u7528\u7b49\u7ea7\u3001\u5386\u53f2\u8ba2\u5355\u7edf\u8ba1','\u4e2d'],
        ['F-A-07','\u5927\u8d5b\u7ba1\u7406\uff1a\u521b\u5efa\u5927\u8d5b\u3001\u914d\u7f6e\u9898\u76ee\u3001\u5ba1\u6838\u62a5\u540d\u3001\u5f55\u5165\u6210\u7ee9\u3001\u9881\u53d1\u8bc1\u4e66','\u4e2d'],
        ['F-A-08','AI \u667a\u80fd\u4f53\u914d\u7f6e\uff1a\u7ba1\u7406 Agent\u3001\u63d0\u793a\u8bcd\u6a21\u677f\u3001Skill \u6269\u5c55\u5305','\u4e2d'],
        ['F-A-09','\u7cfb\u7edf\u53c2\u6570\u914d\u7f6e\uff1a\u5e73\u53f0\u540d\u79f0\u3001\u62bd\u4f63\u6bd4\u4f8b\u3001\u4fe1\u7528\u7b49\u7ea7\u89c4\u5219\u3001\u6807\u7b7e\u4f53\u7cfb','\u4e2d'],
        ['F-A-10','\u6570\u636e\u5927\u5c4f\uff1a\u5168\u5c4f\u53ef\u89c6\u5316\u6a21\u5f0f\uff0c\u5b9e\u65f6\u5237\u65b0\u6838\u5fc3\u8fd0\u8425\u6570\u636e','\u4f4e'],
        ['F-A-11','\u64cd\u4f5c\u65e5\u5fd7\uff1a\u8bb0\u5f55\u7ba1\u7406\u5458\u5173\u952e\u64cd\u4f5c\uff0c\u652f\u6301\u5b89\u5168\u5ba1\u8ba1','\u4e2d'],
    ],widths=[2.5*cm,10.5*cm,2*cm]))
    story.append(SP(2))

    story.append(H2('2.2  \u8fd0\u884c\u73af\u5883'))
    story.append(H3('2.2.1  \u670d\u52a1\u5668\u7aef\u8fd0\u884c\u73af\u5883'))
    story.append(tbl(['\u73af\u5883\u9879','\u89c4\u683c\u8981\u6c42','\u8bf4\u660e'],[
        ['\u64cd\u4f5c\u7cfb\u7edf','Linux\uff08Ubuntu 22.04 LTS / NixOS\uff09','\u4e91\u8ba1\u7b97\u5e73\u53f0\u5bb9\u5668\u73af\u5883'],
        ['Node.js','v20.x LTS \u53ca\u4ee5\u4e0a','\u540e\u7aef API \u670d\u52a1\u8fd0\u884c\u65f6'],
        ['PostgreSQL','15.x \u53ca\u4ee5\u4e0a','\u4e3b\u6570\u636e\u5e93\uff0c\u6258\u7ba1\u5b9e\u4f8b'],
        ['pnpm','9.x','Monorepo \u5305\u7ba1\u7406\u5de5\u5177'],
        ['Python','3.10+','\u8f85\u52a9\u811a\u672c\uff08\u5907\u4efd\u3001\u6587\u6863\u751f\u6210\uff09'],
        ['\u5185\u5b58','\u2265 2GB\uff08\u751f\u4ea7\u63a8\u8350 4GB+\uff09','API \u670d\u52a1 + \u6570\u636e\u5e93'],
        ['\u78c1\u76d8','\u2265 20GB SSD','\u7cfb\u7edf\u76d8\uff1b\u6587\u4ef6\u7528 GCS \u5b58\u50a8'],
        ['\u7f51\u7edc','\u5f00\u653e 80 / 443 \u7aef\u53e3','HTTP \u91cd\u5b9a\u5411 + HTTPS \u670d\u52a1'],
    ],widths=[3*cm,4.5*cm,7.5*cm]))
    story.append(SP())
    story.append(H3('2.2.2  \u5ba2\u6237\u7aef\u8fd0\u884c\u73af\u5883'))
    story.append(tbl(['\u73af\u5883\u9879','\u8981\u6c42'],[
        ['Chrome / Edge','109+ \uff08\u63a8\u8350\uff09'],
        ['Firefox','108+'],
        ['Safari','16+\uff08macOS / iOS\uff09'],
        ['\u5206\u8fa8\u7387','1280\xd7720 \u53ca\u4ee5\u4e0a\uff08\u54cd\u5e94\u5f0f\uff0c\u517c\u5bb9\u79fb\u52a8\u7aef\uff09'],
        ['JavaScript','\u5fc5\u987b\u5f00\u542f\uff08SPA \u5e94\u7528\u4f9d\u8d56 JS \u8fd0\u884c\uff09'],
        ['\u7f51\u7edc','\u9700\u8981\u8bbf\u95ee\u516c\u7f51\uff0c\u5e26\u5bbd\u5efa\u8bae \u2265 4Mbps'],
    ],widths=[4*cm,11*cm]))
    story.append(SP())
    story.append(H3('2.2.3  \u7b2c\u4e09\u65b9\u670d\u52a1\u4f9d\u8d56'))
    story.append(tbl(['\u670d\u52a1\u540d\u79f0','\u7528\u9014','\u5fc5\u8981\u6027'],[
        ['Google Cloud Storage (GCS)','\u975e\u7ed3\u6784\u5316\u6587\u4ef6\u5bf9\u8c61\u5b58\u50a8\uff08\u9644\u4ef6\u3001\u5408\u540c\u3001\u4ea4\u4ed8\u7269\u7b49\uff09','\u5fc5\u987b'],
        ['\u817e\u8baf\u4e91 SMS','\u77ed\u4fe1\u9a8c\u8bc1\u7801\u53d1\u9001\uff08\u6ce8\u518c\u9a8c\u8bc1\u3001\u4e1a\u52a1\u901a\u77e5\uff09','\u5fc5\u987b'],
        ['Resend','\u90ae\u4ef6\u901a\u77e5\u670d\u52a1\uff08\u5bc6\u7801\u91cd\u7f6e\u3001\u7ed3\u7b97\u901a\u77e5\u7b49\uff09','\u63a8\u8350'],
        ['OpenAI API','GPT \u5927\u6a21\u578b\u63a5\u5165\uff0c\u9a71\u52a8 AI \u667a\u80fd\u4f53\u529f\u80fd','\u53ef\u9009'],
        ['Anthropic API','Claude \u5927\u6a21\u578b\u63a5\u5165\uff0c\u5907\u7528 AI \u5f15\u64ce','\u53ef\u9009'],
        ['GitHub','AI Skill \u6269\u5c55\u5305\u4ece GitHub \u4ed3\u5e93\u52a8\u6001\u62c9\u53d6\u5b89\u88c5','\u53ef\u9009'],
    ],widths=[4.5*cm,7*cm,2.5*cm]))
    story.append(SP(2))

    story.append(H2('2.3  \u57fa\u672c\u8bbe\u8ba1\u6982\u5ff5\u548c\u5904\u7406\u6d41\u7a0b'))
    story.append(H3('2.3.1  \u53cc\u901a\u9053\u64ae\u5408\u6a21\u5f0f'))
    story.append(P('\u5e73\u53f0\u91c7\u7528 V1\uff08\u5355\u901a\u9053\uff09\u4e0e V2\uff08\u53cc\u901a\u9053\uff09\u5e76\u884c\u7684\u64ae\u5408\u67b6\u6784\uff1a'))
    story.append(B('V1 \u901a\u9053\uff1a\u53d1\u5e03\u65b9\u76f4\u63a5\u53d1\u5e03\u9700\u6c42\u81f3\u63a5\u5355\u5927\u5385\uff0cOPC \u81ea\u4e3b\u6295\u6807\uff0c\u7ba1\u7406\u5458\u5ba1\u6838\u540e\u5b8c\u6210\u64ae\u5408\u3002\u9002\u7528\u4e8e\u7b80\u5355\u3001\u6807\u51c6\u5316\u7684\u9700\u6c42\u573a\u666f\u3002'))
    story.append(B('V2 \u901a\u9053\uff08\u53cc\u901a\u9053\uff09\uff1a\u5c06\u7532\u65b9\u9700\u6c42\uff08Channel A\uff09\u4e0e\u5916\u5305\u6267\u884c\uff08Channel B\uff09\u89e3\u8026\u5206\u79bb\u3002\u7ba1\u7406\u5458\u4f5c\u4e3a\u4e2d\u95f4\u5c42\uff0c\u5c06\u7532\u65b9\u9700\u6c42\u8f6c\u5316\u4e3a\u53ef\u5206\u53d1\u7684\u5916\u5305\u9700\u6c42\uff0c\u5b9e\u73b0\u66f4\u7cbe\u7ec6\u7684\u8d44\u6e90\u8c03\u914d\u4e0e\u8d28\u91cf\u63a7\u5236\u3002'))
    story.append(SP())
    story.append(H3('2.3.2  \u6838\u5fc3\u5904\u7406\u6d41\u7a0b'))
    story.append(P('(1) \u9700\u6c42\u53d1\u5e03\u4e0e\u5ba1\u6838\u6d41\u7a0b\uff1a'))
    story.append(tbl(['\u6b65\u9aa4','\u64cd\u4f5c\u65b9','\u5904\u7406\u5185\u5bb9','\u72b6\u6001\u53d8\u5316'],[
        ['1','\u53d1\u5e03\u65b9','\u586b\u5199\u5e76\u63d0\u4ea4\u9700\u6c42\u8868\u5355\uff08\u6807\u9898\u3001\u63cf\u8ff0\u3001\u9884\u7b97\u3001\u622a\u6b62\u3001\u9644\u4ef6\uff09','\u8349\u7a3f\u2192\u5ba1\u6838\u4e2d'],
        ['2','\u7cfb\u7edf','\u81ea\u52a8\u6821\u9a8c\u5fc5\u586b\u5b57\u6bb5\u3001\u9884\u7b97\u5408\u7406\u6027\u3001\u9644\u4ef6\u683c\u5f0f','\u6821\u9a8c\u901a\u8fc7/\u9a73\u56de'],
        ['3','\u7ba1\u7406\u5458','\u5185\u5bb9\u5408\u89c4\u6027\u5ba1\u6838\uff0c\u68c0\u67e5\u9700\u6c42\u5b8c\u6574\u6027\u4e0e\u771f\u5b9e\u6027','\u5ba1\u6838\u4e2d\u2192\u62db\u52df\u4e2d/\u9a73\u56de'],
        ['4','\u7cfb\u7edf','\u5ba1\u6838\u901a\u8fc7\u540e\uff0c\u9700\u6c42\u63a8\u9001\u81f3\u63a5\u5355\u5927\u5385\uff0c\u901a\u77e5\u76f8\u5173 OPC','\u62db\u52df\u4e2d'],
        ['5','OPC','\u67e5\u770b\u9700\u6c42\uff0c\u63d0\u4ea4\u6295\u6807\uff08\u7cfb\u7edf\u6821\u9a8c OPC \u8d44\u8d28\u7b49\u7ea7\uff09','\u6295\u6807\u8bb0\u5f55\u521b\u5efa'],
        ['6','\u53d1\u5e03\u65b9','\u67e5\u770b\u6295\u6807\u5217\u8868\uff0c\u9009\u5b9a\u76ee\u6807 OPC\uff0c\u53d1\u8d77\u4e2d\u6807\u786e\u8ba4','OPC \u4e2d\u6807/\u5176\u4f59\u843d\u6807'],
        ['7','\u7ba1\u7406\u5458','\u786e\u8ba4\u64ae\u5408\u7ed3\u679c\uff0c\u89e6\u53d1\u5408\u540c\u751f\u6210','\u5408\u540c\u7b7e\u7f72\u4e2d'],
        ['8','\u53cc\u65b9','\u5404\u81ea\u5728\u7ebf\u7b7e\u7f72\u5408\u540c','\u6267\u884c\u4e2d'],
    ],widths=[1*cm,2*cm,9*cm,3*cm]))
    story.append(SP())
    story.append(P('(2) \u4ea4\u4ed8\u4e0e\u7ed3\u7b97\u6d41\u7a0b\uff1a'))
    story.append(tbl(['\u6b65\u9aa4','\u64cd\u4f5c\u65b9','\u5904\u7406\u5185\u5bb9','\u72b6\u6001\u53d8\u5316'],[
        ['1','\u53d1\u5e03\u65b9','\u6309\u652f\u4ed8\u8ba1\u5212\u4e0a\u4f20\u4ed8\u6b3e\u51ef\u8bc1\uff0c\u5e73\u53f0\u6258\u7ba1\u6b3e\u9879','\u5f85\u786e\u8ba4'],
        ['2','\u7ba1\u7406\u5458','\u6838\u5b9e\u5230\u8d26\uff0c\u786e\u8ba4\u6b3e\u9879\u5165\u6c60\uff0c\u89e3\u9501\u91cc\u7a0b\u7891\u6267\u884c\u6743\u9650','\u5df2\u5230\u8d26'],
        ['3','OPC','\u6309\u91cc\u7a0b\u7891\u5f00\u5c55\u5de5\u4f5c\uff0c\u5b8c\u6210\u540e\u4e0a\u4f20\u4ea4\u4ed8\u7269','\u5f85\u9a8c\u6536'],
        ['4','\u53d1\u5e03\u65b9','\u5ba1\u67e5\u4ea4\u4ed8\u7269\uff0c\u586b\u5199\u9a8c\u6536\u610f\u89c1\uff08\u901a\u8fc7/\u62d2\u7edd\uff09','\u9a8c\u6536\u901a\u8fc7/\u9a73\u56de'],
        ['5','\u7cfb\u7edf','\u9a8c\u6536\u901a\u8fc7\u540e\uff0c\u5bf9\u5e94\u91cc\u7a0b\u7891\u6b3e\u9879\u91ca\u653e\u8fdb\u5165\u7ed3\u7b97\u961f\u5217','\u5f85\u7ed3\u7b97'],
        ['6','OPC','\u53d1\u8d77\u7ed3\u7b97\u7533\u8bf7\uff0c\u586b\u5199\u6536\u6b3e\u94f6\u884c\u4fe1\u606f','\u7ed3\u7b97\u7533\u8bf7\u4e2d'],
        ['7','\u7ba1\u7406\u5458','\u5ba1\u6838\u7533\u8bf7\uff0c\u6263\u9664\u670d\u52a1\u8d39\u540e\u64cd\u4f5c\u6253\u6b3e','\u5df2\u7ed3\u7b97'],
    ],widths=[1*cm,2*cm,9*cm,3*cm]))
    story.append(SP(2))

    story.append(H2('2.4  \u67b6\u6784\u8bbe\u8ba1'))
    story.append(H3('2.4.1  \u6574\u4f53\u67b6\u6784'))
    story.append(tbl(['\u5c42\u6b21','\u6280\u672f\u5b9e\u73b0','\u4e3b\u8981\u8d23\u4e4b'],[
        ['\u8868\u73b0\u5c42\uff08\u524d\u7aef\uff09','React 18 + TypeScript + Vite 7','SPA \u7528\u6237\u754c\u9762\uff0c\u8def\u7531\u7ba1\u7406\uff0c\u72b6\u6001\u7ba1\u7406\uff0c\u4e0e\u540e\u7aef API \u901a\u4fe1'],
        ['\u4e1a\u52a1\u903b\u8f91\u5c42\uff08\u540e\u7aef\uff09','Node.js 20 + Express 4 + TypeScript','RESTful API\uff0c\u4e1a\u52a1\u89c4\u5219\uff0c\u6743\u9650\u63a7\u5236\uff0cAI \u8c03\u5ea6'],
        ['\u6570\u636e\u8bbf\u95ee\u5c42','Drizzle ORM + PostgreSQL 15','\u7c7b\u578b\u5b89\u5168\u6570\u636e\u5e93\u64cd\u4f5c\uff0cSchema \u7ba1\u7406\uff0c\u4e8b\u52a1\u5904\u7406'],
        ['\u5bf9\u8c61\u5b58\u50a8\u5c42','Google Cloud Storage','\u975e\u7ed3\u6784\u5316\u6587\u4ef6\uff08\u9644\u4ef6\u3001\u5408\u540c\u3001\u4ea4\u4ed8\u7269\uff09'],
        ['\u901a\u4fe1\u5c42','\u817e\u8baf\u4e91 SMS / Resend','\u77ed\u4fe1\u4e0e\u90ae\u4ef6\u901a\u77e5'],
    ],widths=[3.5*cm,4.5*cm,7*cm]))
    story.append(SP())
    story.append(H3('2.4.2  Monorepo \u5de5\u7a0b\u7ed3\u6784'))
    story.append(tbl(['\u5305\u540d','\u8def\u5f84','\u8bf4\u660e'],[
        ['@workspace/jiedanba','artifacts/jiedanba/','\u524d\u7aef React SPA\uff0cVite \u6784\u5efa'],
        ['@workspace/api-server','artifacts/api-server/','\u540e\u7aef Express API \u670d\u52a1'],
        ['@workspace/db','lib/db/','\u5171\u4eab\u6570\u636e\u5e93 Schema\uff08Drizzle\uff09\u4e0e\u8fc1\u79fb\u811a\u672c'],
        ['@workspace/scripts','scripts/','\u8fd0\u7ef4\u8f85\u52a9\u811a\u672c\uff08\u5907\u4efd\u3001\u6587\u6863\u751f\u6210\uff09'],
    ],widths=[4*cm,4.5*cm,6.5*cm]))
    story.append(SP(2))

    story.append(H2('2.5  \u6280\u672f\u9009\u578b'))
    story.append(tbl(['\u7c7b\u522b','\u9009\u578b','\u7248\u672c','\u9009\u578b\u7406\u7531'],[
        ['\u524d\u7aef\u6846\u67b6','React','18.x','\u6210\u719f\u751f\u6001\uff0c\u5e76\u53d1\u6a21\u5f0f\uff0c\u7ec4\u4ef6\u590d\u7528\u7387\u9ad8'],
        ['\u524d\u7aef\u8bed\u8a00','TypeScript','5.x','\u5f3a\u7c7b\u578b\uff0c\u4e0e\u540e\u7aef\u5171\u4eab\u7c7b\u578b\u5b9a\u4e49\uff0c\u51cf\u5c11\u8fd0\u884c\u65f6\u9519\u8bef'],
        ['\u524d\u7aef\u6784\u5efa','Vite','7.x','\u6781\u901f HMR\uff0cRollup \u751f\u4ea7\u6784\u5efa\uff0c\u539f\u751f ESM'],
        ['UI \u7ec4\u4ef6\u5e93','Radix UI + Shadcn','-','\u65e0\u6837\u5f0f\u539f\u5b50\u7ec4\u4ef6\uff0cWCAG \u65e0\u969c\u788d\uff0c\u9ad8\u5ea6\u53ef\u5b9a\u5236'],
        ['CSS \u6846\u67b6','Tailwind CSS','3.x','\u539f\u5b50\u5316\uff0c\u6309\u9700\u751f\u6210\uff0c\u4e0e\u7ec4\u4ef6\u5e93\u6df1\u5ea6\u96c6\u6210'],
        ['\u8def\u7531','Wouter','3.x','\u8f7b\u91cf\uff082KB\uff09\uff0c\u7c7b React Router API\uff0c\u65e0\u5197\u4f59\u4f9d\u8d56'],
        ['\u6570\u636e\u8bf7\u6c42','TanStack Query','5.x','\u670d\u52a1\u7aef\u72b6\u6001\u6700\u4f73\u5b9e\u8df5\uff0c\u81ea\u52a8\u7f13\u5b58\u4e0e\u540c\u6b65'],
        ['\u5bcc\u6587\u672c','tiptap','2.x','\u53ef\u6269\u5c55 ProseMirror \u65b9\u6848\uff0c\u652f\u6301 Markdown \u6269\u5c55'],
        ['\u56fe\u8868','Recharts','2.x','React \u539f\u751f\u56fe\u8868\uff0c\u58f0\u660e\u5f0f API\uff0c\u53ef\u7ec4\u5408'],
        ['\u540e\u7aef\u6846\u67b6','Express','4.x','\u8f7b\u91cf\u6210\u719f\uff0c\u4e2d\u95f4\u4ef6\u751f\u6001\u4e30\u5bcc\uff0c\u6613\u4e8e\u6269\u5c55'],
        ['ORM','Drizzle ORM','0.x','\u7c7b\u578b\u5b89\u5168\uff0c\u96f6\u8fd0\u884c\u65f6\u5f00\u9500\uff0cSQL-like DSL'],
        ['\u6570\u636e\u5e93','PostgreSQL','15.x','\u5f00\u6e90\uff0cACID \u4e8b\u52a1\uff0cJSONB \u5217\u652f\u6301\uff0c\u6210\u719f\u53ef\u9760'],
        ['\u6821\u9a8c','Zod','3.x','\u524d\u540e\u7aef\u5171\u4eab Schema\uff0cTypeScript \u7c7b\u578b\u63a8\u5bfc'],
        ['\u52a0\u5bc6','bcrypt','5.x','\u5de5\u4e1a\u6807\u51c6\u5bc6\u7801\u54c8\u5e0c\uff0c\u81ea\u52a8\u52a0\u76d0'],
        ['\u9274\u6743','jsonwebtoken','9.x','JWT \u6807\u51c6\u5b9e\u73b0\uff0cHMAC-SHA256 \u7b7e\u540d'],
        ['AI','OpenAI/Anthropic SDK','-','\u652f\u6301 GPT-4/Claude \u591a\u6a21\u578b\uff0c\u53ef\u7075\u6d3b\u5207\u6362'],
    ],widths=[2.5*cm,3.5*cm,2*cm,7*cm]))
    story.append(PageBreak())

    # ===== Chapter 3: Module Design =====
    story.append(H1('3  \u6a21\u5757\u8bbe\u8ba1'))

    story.append(H2('3.1  \u7528\u6237\u8ba4\u8bc1\u6a21\u5757'))
    story.append(H3('3.1.1  \u6a21\u5757\u8fde\u63a5\u53e3'))
    story.append(tbl(['\u63a5\u53e3','\u65b9\u5f0f','\u8bf4\u660e'],[
        ['POST /api/auth/send-sms-code','\u516c\u5f00','\u53d1\u9001\u77ed\u4fe1\u9a8c\u8bc1\u7801\uff0c60 \u79d2\u5185\u6709\u6548\uff0c\u5355\u53f7\u6bcf\u5c0f\u65f6\u9650 5 \u6b21'],
        ['POST /api/auth/register','\u516c\u5f00','\u7528\u6237\u6ce8\u518c\uff0c\u6821\u9a8c smsCode \u540e\u521b\u5efa\u7528\u6237\uff0c\u8fd4\u56de\u4ee4\u724c\u5bf9'],
        ['POST /api/auth/login','\u516c\u5f00','\u7528\u6237\u767b\u5f55\uff0c\u8fd4\u56de accessToken + refreshToken'],
        ['POST /api/auth/refresh','\u516c\u5f00','\u5237\u65b0\u4ee4\u724c\uff0c\u8fd4\u56de\u65b0 accessToken'],
        ['POST /api/auth/logout','\u9700\u767b\u5f55','\u64a4\u9500\u5f53\u524d refreshToken'],
        ['POST /api/auth/change-password','\u9700\u767b\u5f55','\u4fee\u6539\u5bc6\u7801\uff0c\u64a4\u9500\u6240\u6709 refreshToken'],
        ['POST /api/auth/forgot-password','\u516c\u5f00','\u91cd\u7f6e\u5bc6\u7801\uff0c\u53d1\u9001\u4e34\u65f6\u5bc6\u7801\u81f3\u6ce8\u518c\u90ae\u7b261'],
    ],widths=[5.5*cm,2.5*cm,7*cm]))
    story.append(SP(2))

    story.append(H2('3.2  \u9700\u6c42\u53d1\u5e03\u4e0e\u64ae\u5408\u6a21\u5757'))
    story.append(H3('3.2.1  \u9700\u6c42\u72b6\u6001\u673a\uff08V2 \u901a\u9053\uff09'))
    story.append(tbl(['\u72b6\u6001\u503c','\u542b\u4e49','\u8fdb\u5165\u6761\u4ef6','\u540e\u7eed\u72b6\u6001'],[
        ['draft','\u8349\u7a3f','\u53d1\u5e03\u65b9\u521b\u5efa','reviewing'],
        ['reviewing','\u5ba1\u6838\u4e2d','\u53d1\u5e03\u65b9\u63d0\u4ea4','active / rejected'],
        ['active','\u62db\u52df\u4e2d','\u7ba1\u7406\u5458\u5ba1\u6838\u901a\u8fc7','in_progress / cancelled'],
        ['in_progress','\u6267\u884c\u4e2d','\u64ae\u5408\u6210\u529f\uff0c\u5408\u540c\u53cc\u65b9\u7b7e\u7f72','completed / disputed'],
        ['completed','\u5df2\u5b8c\u6210','\u5168\u90e8\u91cc\u7a0b\u7891\u9a8c\u6536\u901a\u8fc7','-\uff08\u7ec8\u6001\uff09'],
        ['rejected','\u5df2\u9a73\u56de','\u7ba1\u7406\u5458\u5ba1\u6838\u4e0d\u901a\u8fc7','reviewing\uff08\u4fee\u6539\u540e\u91cd\u63d0\uff09'],
        ['cancelled','\u5df2\u64a4\u9500','\u53d1\u5e03\u65b9\u4e3b\u52a8\u64a4\u9500','-\uff08\u7ec8\u6001\uff09'],
    ],widths=[2.8*cm,2*cm,4.2*cm,4*cm]))
    story.append(SP())
    story.append(H3('3.2.2  \u6295\u6807\u4e1a\u52a1\u89c4\u5219'))
    for t in [
        '\u6295\u6807\u524d\u7cfb\u7edf\u81ea\u52a8\u6821\u9a8c OPC \u4fe1\u7528\u7b49\u7ea7\u662f\u5426\u6ee1\u8db3\u9700\u6c42\u8981\u6c42\uff1b',
        '\u5b9a\u5411\u9080\u8bf7\u6a21\u5f0f\uff08mode=directed\uff09\u4e0b\uff0c\u4ec5\u88ab\u9080\u8bf7\u7684 OPC \u53ef\u89c1\u8be5\u9700\u6c42\uff1b',
        '\u540c\u4e00 OPC \u5bf9\u540c\u4e00\u9700\u6c42\u53ea\u80fd\u63d0\u4ea4\u4e00\u4efd\u6709\u6548\u6295\u6807\uff1b',
        '\u6295\u6807\u622a\u6b62\uff08bidDeadline\uff09\u540e\uff0c\u5927\u5385\u81ea\u52a8\u4e0b\u7ebf\uff0c\u4e0d\u518d\u63a5\u53d7\u65b0\u6295\u6807\uff1b',
        '\u4e2d\u6807\u786e\u8ba4\u540e\uff0c\u5176\u4f59\u6240\u6709\u6295\u6807\u81ea\u52a8\u6807\u8bb0\u4e3a rejected\u3002',
    ]:
        story.append(B(t))
    story.append(SP(2))

    story.append(H2('3.3  \u5408\u540c\u4e0e\u8ba2\u5355\u6a21\u5757'))
    story.append(H3('3.3.1  \u8ba2\u5355\u72b6\u6001\u673a'))
    story.append(tbl(['\u72b6\u6001\u503c','\u542b\u4e49','\u8fdb\u5165\u6761\u4ef6'],[
        ['pending_contract','\u5f85\u7b7e\u5408\u540c','\u64ae\u5408\u6210\u529f\u540e\u81ea\u52a8\u521b\u5efa'],
        ['active','\u6267\u884c\u4e2d','\u53cc\u65b9\u5747\u5b8c\u6210\u5408\u540c\u7b7e\u7f72'],
        ['completed','\u5df2\u5b8c\u6210','\u5168\u90e8\u91cc\u7a0b\u7891\u9a8c\u6536\u901a\u8fc7\u4e14\u7ed3\u7b97\u5b8c\u6210'],
        ['cancelled','\u5df2\u53d6\u6d88','\u7ba1\u7406\u5458\u4ecb\u5165\u53d6\u6d88\u6216\u53cc\u65b9\u534f\u5546'],
        ['in_warranty','\u8d28\u4fdd\u671f','\u5b8c\u6210\u540e\u8fdb\u5165\u7ea6\u5b9a\u8d28\u4fdd\u5468\u671f'],
    ],widths=[3.5*cm,3*cm,8.5*cm]))
    story.append(SP(2))

    story.append(H2('3.4  \u4ea4\u4ed8\u4e0e\u9a8c\u6536\u6a21\u5757'))
    for t in [
        'v2_deliverables_a\uff1a\u7532\u65b9\u4fa7\u4ea4\u4ed8\u7269\uff0c\u5173\u8054 client_demand_id\uff0c\u7531\u53d1\u5e03\u65b9\u786e\u8ba4\u9a8c\u6536\uff1b',
        'v2_deliverables_b\uff1a\u5916\u5305\u4fa7\u4ea4\u4ed8\u7269\uff0c\u5173\u8054 outsource_order_id\uff0c\u7531\u7ba1\u7406\u5458\u4ee3\u7406\u7532\u65b9\u786e\u8ba4\uff1b',
        '\u4ea4\u4ed8\u7269\u652f\u6301\u591a\u6587\u4ef6\u6279\u91cf\u4e0a\u4f20\uff08attachments JSONB \u6570\u7ec4\uff09\uff0c\u540c\u65f6\u652f\u6301\u5728\u7ebf\u94fe\u63a5\uff08url\uff09\uff1b',
        'submissionCount \u5b57\u6bb5\u8bb0\u5f55 OPC \u7684\u63d0\u4ea4\u6b21\u6570\uff0c\u9a73\u56de\u540e\u91cd\u65b0\u63d0\u4ea4\u8ba1\u6570\u9012\u589e\uff1b',
        '\u53d1\u5e03\u65b9\u4e0d\u901a\u8fc7\u65f6\u586b\u5199 reviewNote\uff0cOPC \u6536\u5230\u901a\u77e5\u540e\u4fee\u6539\u91cd\u63d0\u3002',
    ]:
        story.append(B(t))
    story.append(SP(2))

    story.append(H2('3.5  \u8d22\u52a1\u7ed3\u7b97\u6a21\u5757'))
    story.append(tbl(['\u73af\u8282','\u7cfb\u7edf\u884c\u4e3a','\u6570\u636e\u53d8\u5316'],[
        ['\u53d1\u5e03\u65b9\u4ed8\u6b3e','\u4e0a\u4f20\u51ef\u8bc1\uff0c\u7ba1\u7406\u5458\u786e\u8ba4\u5230\u8d26','v2_payment_plans.status \u2192 confirmed'],
        ['\u91cc\u7a0b\u7891\u89e3\u9501','\u5230\u8d26\u540e\u89e3\u9501 OPC \u5de5\u4f5c\u6743\u9650','v2_outsource_orders \u5173\u8054\u91cc\u7a0b\u7891\u6807\u8bb0'],
        ['\u9636\u6bb5\u9a8c\u6536\u901a\u8fc7','\u89e6\u53d1\u5bf9\u5e94\u6b3e\u9879\u91ca\u653e','v2_payment_plans.status \u2192 released'],
        ['\u7ed3\u7b97\u7533\u8bf7','OPC \u63d0\u4ea4\u7533\u8bf7\uff0c\u7ba1\u7406\u5458\u5ba1\u6838','settlement \u8bb0\u5f55\u521b\u5efa'],
        ['\u6253\u6b3e\u5b8c\u6210','\u6263\u9664\u5e73\u53f0\u670d\u52a1\u8d39\uff0c\u786e\u8ba4\u6253\u6b3e','settlement.status \u2192 paid'],
    ],widths=[3*cm,5*cm,7*cm]))
    story.append(SP(2))

    story.append(H2('3.6  \u5927\u8d5b\u4e0e\u8ba4\u8bc1\u6a21\u5757'))
    story.append(H3('3.6.1  \u5927\u8d5b\u65f6\u95f4\u8f74\u72b6\u6001'))
    story.append(tbl(['\u72b6\u6001','\u542b\u4e49','\u65f6\u95f4\u8282\u70b9\u5b57\u6bb5'],[
        ['draft','\u8349\u7a3f\uff0c\u672a\u53d1\u5e03','-'],
        ['published','\u5df2\u53d1\u5e03\uff0c\u53ef\u62a5\u540d','registrationAt \u2192 registrationEndAt'],
        ['in_exam','\u7b54\u9898\u8fdb\u884c\u4e2d','registrationEndAt \u2192 deadlineAt'],
        ['reviewing','\u8bc4\u5ba1\u4e2d','deadlineAt \u4e4b\u540e'],
        ['ended','\u5df2\u7ed3\u675f\uff0c\u7ed3\u679c\u516c\u793a','announcementAt \u4e4b\u540e'],
    ],widths=[3*cm,3.5*cm,8.5*cm]))
    story.append(SP())
    story.append(H3('3.6.2  \u4fe1\u7528\u5206\u8054\u52a8\u89c4\u5219'))
    for t in [
        '\u53c2\u8d5b\u6210\u7ee9\u8bc4\u5b9a\u4e3a A \u7ea7\uff1a+15 \u4fe1\u7528\u5206\uff1bB \u7ea7\uff1a+8 \u5206\uff1bC \u7ea7\uff1a+3 \u5206\uff1bfail\uff1a-2 \u5206\uff1b',
        '\u4fe1\u7528\u5206\u7d2f\u8ba1\u8fbe\u5230 credit_levels \u8868\u914d\u7f6e\u7684 minPoints \u9608\u503c\u65f6\uff0c\u81ea\u52a8\u5347\u7ea7\uff1b',
        'OPC \u7b49\u7ea7\u5f71\u54cd\u53ef\u6295\u6807\u7684\u9700\u6c42\u7b49\u7ea7\u4e0a\u9650\u4e0e\u5e73\u53f0\u670d\u52a1\u8d39\u7387\u3002',
    ]:
        story.append(B(t))
    story.append(SP(2))

    story.append(H2('3.7  AI \u667a\u80fd\u4f53\u6a21\u5757'))
    for t in [
        'ReAct \u5faa\u73af\uff1aReason\uff08\u63a8\u7406\uff09\u2192 Action\uff08\u5de5\u5177\u8c03\u7528\uff09\u2192 Observation\uff08\u7ed3\u679c\u89c2\u5bdf\uff09\u2192 \u518d\u6b21\u63a8\u7406\uff0c\u76f4\u81f3\u4efb\u52a1\u5b8c\u6210\uff1b',
        '\u591a\u8f6e\u5bf9\u8bdd\uff1a\u5386\u53f2\u6d88\u606f\uff08historyMessages\uff09\u8de8\u8f6e\u6b21\u4f20\u9012\uff0c\u7ef4\u6301\u4e0a\u4e0b\u6587\u8fde\u8d2f\uff1b',
        '\u5de5\u5177\u8c03\u7528\uff1a\u5185\u7f6e validate_timeline\u3001generate_summary\u3001get_platform_skills \u7b49\u5de5\u5177\uff1b',
        'Skill \u7cfb\u7edf\uff1a\u4ece GitHub \u4ed3\u5e93\u52a8\u6001\u52a0\u8f7d Skill Markdown \u5b9a\u4e49\uff0c\u6ce8\u5165 System Prompt \u6269\u5c55\u667a\u80fd\u4f53\u80fd\u529b\u3002',
    ]:
        story.append(B(t))
    story.append(SP(2))

    story.append(H2('3.8  \u5de5\u5355\u4e0e\u901a\u77e5\u6a21\u5757'))
    story.append(tbl(['\u5de5\u5355\u7c7b\u578b','\u6570\u636e\u8868','\u5173\u8054\u4e1a\u52a1','\u5178\u578b\u573a\u666f'],[
        ['A \u901a\u9053\u5de5\u5355','v2_tickets_a','v2_client_demands','\u7532\u65b9\u5bf9\u9700\u6c42\u6267\u884c\u6709\u5f02\u8bae\uff0c\u7533\u8bf7\u5e73\u53f0\u4ecb\u5165'],
        ['B \u901a\u9053\u5de5\u5355','v2_tickets_b','v2_outsource_orders','OPC \u5bf9\u9a8c\u6536\u7ed3\u679c\u6709\u5f02\u8bae\uff0c\u7533\u8bf7\u4ed2\u88c1'],
    ],widths=[2.8*cm,3.2*cm,3.8*cm,5.2*cm]))
    story.append(SP(2))

    story.append(H2('3.9  \u6587\u4ef6\u5b58\u50a8\u6a21\u5757'))
    story.append(H3('3.9.1  \u4e0a\u4f20\u6d41\u7a0b'))
    for t in [
        '\u5ba2\u6237\u7aef\u53d1\u8d77 POST /api/storage/upload\uff08multipart/form-data\uff09\uff1b',
        '\u540e\u7aef multer \u63a5\u6536\u6587\u4ef6\uff0c\u6821\u9a8c MIME \u7c7b\u578b\u4e0e\u6269\u5c55\u540d\u767d\u540d\u5355\uff08\u53cc\u91cd\u6821\u9a8c\uff09\uff1b',
        '\u6587\u4ef6\u5199\u5165 GCS \u79c1\u6709\u6876\uff0c\u8def\u5f84\u683c\u5f0f\uff1auploads/{uuid}.{ext}\uff1b',
        '\u540e\u7aef\u8fd4\u56de\u5bf9\u8c61 Key\uff0c\u4e0d\u76f4\u63a5\u8fd4\u56de\u516c\u5f00 URL\uff1b',
        '\u524d\u7aef\u5c55\u793a\u65f6\u8c03\u7528 GET /api/storage/objects/{key}\uff0c\u540e\u7aef\u5b9e\u65f6\u751f\u6210\u65f6\u6548\u6027\u9884\u7b7e\u540d URL\uff0815 \u5206\u949f\uff09\u8fd4\u56de\u7ed9\u5ba2\u6237\u7aef\u3002',
    ]:
        story.append(B(t))
    story.append(SP())
    story.append(H3('3.9.2  \u652f\u6301\u7684\u6587\u4ef6\u7c7b\u578b'))
    story.append(tbl(['\u7c7b\u578b','MIME / \u6269\u5c55\u540d','\u5927\u5c0f\u9650\u5236'],[
        ['\u56fe\u7247','image/jpeg, image/png, image/gif, image/webp','10 MB'],
        ['\u6587\u6863','application/pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx','50 MB'],
        ['\u6587\u672c','.md, .txt','5 MB'],
        ['\u538b\u7f29\u5305','.zip, .rar, .7z, .tar, .gz','100 MB'],
        ['\u89c6\u9891','video/mp4, video/webm','500 MB'],
    ],widths=[2.5*cm,7.5*cm,5*cm]))
    story.append(PageBreak())

    # ===== Chapter 4: Database Design =====
    story.append(H1('4  \u6570\u636e\u5e93\u8bbe\u8ba1'))
    story.append(H2('4.1  \u6982\u8ff0'))
    story.append(P('\u7cfb\u7edf\u6570\u636e\u5e93\u4f7f\u7528 PostgreSQL 15\uff0c\u901a\u8fc7 Drizzle ORM \u7ba1\u7406 Schema \u4e0e\u8fc1\u79fb\u811a\u672c\u3002\u6570\u636e\u5e93\u5171\u8bbe\u8ba1 70+ \u5f20\u4e1a\u52a1\u8868\uff0c\u6309\u4e1a\u52a1\u57df\u5206\u7ec4\u5982\u4e0b\uff1a'))
    story.append(tbl(['\u4e1a\u52a1\u57df','\u4e3b\u8981\u6570\u636e\u8868','\u8868\u6570\u91cf'],[
        ['\u7528\u6237\u4e0e\u8ba4\u8bc1\u57df','users, opc_profiles, publisher_profiles, refresh_tokens, credit_levels, opc_track_certs','6'],
        ['\u9700\u6c42\u4e0e\u64ae\u5408\u57df','demands, bids, v2_client_demands, v2_outsource_demands, v2_tenders','5'],
        ['\u5408\u540c\u4e0e\u8ba2\u5355\u57df','orders, v2_outsource_orders, v2_contracts, v2_payment_plans','4'],
        ['\u4ea4\u4ed8\u7269\u57df','v2_deliverables_a, v2_deliverables_b','2'],
        ['\u5927\u8d5b\u4e0e\u9898\u5e93\u57df','contests, contest_tracks, contest_registrations, contest_questions, cat_categories','5'],
        ['AI \u667a\u80fd\u4f53\u57df','agent_configs, agent_config_versions, agent_task_types, skills, agent_task_skill_links','5'],
        ['\u5de5\u5355\u4e0e\u901a\u77e5\u57df','v2_tickets_a, v2_tickets_b, v2_ticket_messages, notifications','4'],
        ['\u793e\u533a\u4e0e\u5185\u5bb9\u57df','portfolios, portfolio_projects, posts, post_likes, courses','5'],
        ['\u7cfb\u7edf\u914d\u7f6e\u57df','site_settings, schema_migrations','2+'],
    ],widths=[3*cm,9.5*cm,2.5*cm]))
    story.append(SP(2))

    story.append(H2('4.2  \u6570\u636e\u8868\u8bbe\u8ba1'))

    counter = [1]
    def dtbl(tname, tdesc, cols):
        story.append(H3('4.2.%d  %s\uff08%s\uff09' % (counter[0], tdesc, tname)))
        counter[0] += 1
        story.append(tbl(
            ['\u5217\u540d','\u6570\u636e\u7c7b\u578b','\u7ea6\u675f','\u8bf4\u660e'],
            cols,
            widths=[3.5*cm,3.2*cm,2.8*cm,5.5*cm]
        ))
        story.append(SP())

    dtbl('users', '\u7528\u6237\u8868',[
        ['id','serial','PK','\u7528\u6237\u552f\u4e00 ID'],
        ['nickname','varchar(100)','NOT NULL','\u7528\u6237\u6635\u79f0'],
        ['email','varchar(200)','UNIQUE','\u6ce8\u518c\u90ae\u7b261'],
        ['passwordHash','text','','bcrypt \u54c8\u5e0c\u540e\u7684\u5bc6\u7801'],
        ['phone','varchar(20)','UNIQUE','\u624b\u673a\u53f7\uff08\u552f\u4e00\uff09'],
        ['avatar','text','','\u5934\u50cf\u6587\u4ef6 GCS Key'],
        ['role','user_role','DEFAULT opc','\u89d2\u8272\uff1aopc / publisher / admin'],
        ['status','user_status','DEFAULT active','\u72b6\u6001\uff1aactive / suspended / banned'],
        ['isSuperAdmin','boolean','DEFAULT false','\u662f\u5426\u8d85\u7ea7\u7ba1\u7406\u5458'],
        ['createdAt','timestamp','DEFAULT now()','\u6ce8\u518c\u65f6\u95f4'],
    ])

    dtbl('opc_profiles', 'OPC \u4e2a\u4eba\u8d44\u6599\u8868',[
        ['id','serial','PK','\u8d44\u6599 ID'],
        ['userId','integer','FK\u2192users.id','\u5173\u8054\u7528\u6237 ID'],
        ['level','opc_level','','OPC \u7b49\u7ea7\uff1anewbie/C/B/A'],
        ['bio','text','','\u4e2a\u4eba\u7b80\u4ecb'],
        ['skillTags','jsonb','','\u6280\u80fd\u6807\u7b7e\u6570\u7ec4 string[]'],
        ['industryTags','jsonb','','\u884c\u4e1a\u6807\u7b7e\u6570\u7ec4 string[]'],
        ['creditScore','real','DEFAULT 4.0','\u4fe1\u7528\u5206\uff080-5 \u661f\u8bc4\u5206\u5236\uff09'],
        ['totalOrders','integer','DEFAULT 0','\u5386\u53f2\u603b\u8ba2\u5355\u6570'],
        ['completionRate','real','DEFAULT 0','\u5b8c\u6210\u7387\uff080-1\uff09'],
        ['totalEarnings','real','DEFAULT 0','\u7d2f\u8ba1\u6536\u5165\uff08\u5143\uff09'],
        ['creditLevelId','integer','FK\u2192credit_levels.id','\u5f53\u524d\u4fe1\u7528\u7b49\u7ea7 ID'],
        ['creditPoints','integer','DEFAULT 0','\u7d2f\u8ba1\u4fe1\u7528\u79ef\u5206'],
    ])

    dtbl('publisher_profiles', '\u53d1\u5e03\u65b9\u8d44\u6599\u8868',[
        ['userId','integer','PK, FK\u2192users.id','\u5173\u8054\u7528\u6237 ID'],
        ['companyDesc','text','','\u516c\u53f8/\u673a\u6784\u63cf\u8ff0'],
        ['location','varchar(200)','','\u6240\u5728\u5730\u533a'],
        ['industry','varchar(200)','','\u6240\u5c5e\u884c\u4e1a'],
        ['creditCode','varchar(100)','','\u7edf\u4e00\u793e\u4f1a\u4fe1\u7528\u4ee3\u7801'],
        ['companyLogo','text','','\u516c\u53f8 Logo GCS Key'],
        ['taxId','varchar(100)','','\u7a0e\u52a1\u767b\u8bb0\u53f7'],
        ['bankName','varchar(100)','','\u5f00\u6237\u94f6\u884c\u540d\u79f0'],
        ['bankAccount','varchar(50)','','\u94f6\u884c\u8d26\u53f7'],
        ['updatedAt','timestamp','DEFAULT now()','\u6700\u540e\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('credit_levels', '\u4fe1\u7528\u7b49\u7ea7\u914d\u7f6e\u8868',[
        ['id','serial','PK','\u7b49\u7ea7 ID'],
        ['code','varchar(50)','UNIQUE','\u7b49\u7ea7\u7f16\u7801\uff08\u5982 C1, B2, A1\uff09'],
        ['name','varchar(100)','','\u7b49\u7ea7\u663e\u793a\u540d\u79f0'],
        ['minPoints','integer','','\u8fbe\u5230\u8be5\u7b49\u7ea7\u6240\u9700\u6700\u4f4e\u4fe1\u7528\u79ef\u5206'],
        ['color','varchar(50)','','\u524d\u7aef\u663e\u793a\u989c\u8272\uff08\u5341\u516d\u8fdb\u5236\uff09'],
        ['isActive','boolean','','\u662f\u5426\u542f\u7528'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
    ])

    dtbl('demands', 'V1 \u9700\u6c42\u4e3b\u8868',[
        ['id','serial','PK','\u9700\u6c42 ID'],
        ['demandNo','varchar(20)','UNIQUE','\u9700\u6c42\u7f16\u53f7\uff08\u5982 D20260001\uff09'],
        ['title','varchar(50)','','\u9700\u6c42\u6807\u9898'],
        ['description','text','','\u9700\u6c42\u8be6\u7ec6\u63cf\u8ff0\uff08Markdown\uff09'],
        ['skillTags','jsonb','','\u6280\u80fd\u6807\u7b7e string[]'],
        ['opcLevel','varchar(10)','DEFAULT any','\u8981\u6c42 OPC \u6700\u4f4e\u7b49\u7ea7'],
        ['budgetMin','real','','\u9884\u7b97\u4e0b\u9650\uff08\u5143\uff09'],
        ['budgetMax','real','','\u9884\u7b97\u4e0a\u9650\uff08\u5143\uff09'],
        ['deadline','date','','\u4ea4\u4ed8\u622a\u6b62\u65e5\u671f'],
        ['milestones','jsonb','','\u91cc\u7a0b\u7891\u5217\u8868\uff08JSON \u6570\u7ec4\uff09'],
        ['attachments','jsonb','','\u9644\u4ef6 GCS Key \u5217\u8868'],
        ['mode','demand_mode','','\u53d1\u5e03\u6a21\u5f0f\uff1aopen / directed'],
        ['status','demand_status','','\u5f53\u524d\u72b6\u6001\uff08\u89c1\u72b6\u6001\u673a\uff09'],
        ['isUrgent','boolean','DEFAULT false','\u662f\u5426\u7d27\u6025'],
        ['bidDeadline','timestamp','','\u6295\u6807\u622a\u6b62\u65f6\u95f4'],
        ['publisherId','integer','FK\u2192users.id','\u53d1\u5e03\u65b9\u7528\u6237 ID'],
        ['catCategoryId','integer','FK\u2192cat_categories.id','\u6240\u5c5e\u8d5b\u9053\u5206\u7c7b ID'],
        ['commissionRate','real','DEFAULT 0.10','\u5e73\u53f0\u62bd\u4f63\u6bd4\u4f8b'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u6700\u540e\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_client_demands', 'V2 \u7532\u65b9\u9700\u6c42\u8868',[
        ['id','serial','PK','ID'],
        ['demandNo','varchar(50)','UNIQUE','\u4e1a\u52a1\u7f16\u53f7'],
        ['publisherId','integer','FK\u2192users.id','\u53d1\u5e03\u65b9 ID'],
        ['title','varchar(200)','','\u9700\u6c42\u6807\u9898'],
        ['demandType','varchar(50)','','\u9700\u6c42\u7c7b\u578b'],
        ['isUrgent','boolean','','\u662f\u5426\u7d27\u6025'],
        ['budgetMin','real','','\u9884\u7b97\u4e0b\u9650'],
        ['budgetMax','real','','\u9884\u7b97\u4e0a\u9650'],
        ['hopeDeliveryDate','timestamp','','\u671f\u671b\u4ea4\u4ed8\u65e5\u671f'],
        ['status','v2_client_demand_status','','\u72b6\u6001\u679a\u4e3e'],
        ['warrantyEndDate','timestamp','','\u8d28\u4fdd\u622a\u6b62\u65e5\u671f'],
        ['closedReason','text','','\u5173\u95ed\u539f\u56e0'],
        ['closedBy','integer','FK\u2192users.id','\u5173\u95ed\u64cd\u4f5c\u4eba'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_outsource_demands', 'V2 \u5916\u5305\u9700\u6c42\u8868',[
        ['id','serial','PK','ID'],
        ['demandNo','varchar(50)','UNIQUE','\u4e1a\u52a1\u7f16\u53f7'],
        ['clientDemandId','integer','FK\u2192v2_client_demands.id','\u5173\u8054\u7532\u65b9\u9700\u6c42'],
        ['createdBy','integer','FK\u2192users.id','\u521b\u5efa\u4eba\uff08\u7ba1\u7406\u5458\uff09'],
        ['title','varchar(200)','','\u5916\u5305\u9700\u6c42\u6807\u9898'],
        ['mode','v2_outsource_demand_mode','','public / invited'],
        ['expectedPriceMin','real','','\u671f\u671b\u62a5\u4ef7\u4e0b\u9650'],
        ['expectedPriceMax','real','','\u671f\u671b\u62a5\u4ef7\u4e0a\u9650'],
        ['deadline','date','','\u622a\u6b62\u65e5\u671f'],
        ['milestones','jsonb','','\u91cc\u7a0b\u7891\u914d\u7f6e'],
        ['opcLevel','varchar(10)','','\u8981\u6c42 OPC \u7b49\u7ea7'],
        ['status','v2_outsource_demand_status','','\u72b6\u6001\u679a\u4e3e'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_tenders', 'V2 \u6295\u6807\u8bb0\u5f55\u8868',[
        ['id','serial','PK','ID'],
        ['outsourceDemandId','integer','FK\u2192v2_outsource_demands.id','\u5173\u8054\u5916\u5305\u9700\u6c42'],
        ['opcId','integer','FK\u2192users.id','\u6295\u6807 OPC \u7528\u6237 ID'],
        ['status','v2_tender_status','','\u72b6\u6001\uff1apending/selected/rejected/cancelled'],
        ['totalPrice','real','','\u603b\u62a5\u4ef7\uff08\u5143\uff09'],
        ['priceBreakdown','jsonb','','\u5206\u9879\u62a5\u4ef7\u660e\u7ec6'],
        ['quotedAt','timestamp','','\u63d0\u4ea4\u65f6\u95f4'],
        ['selectedBy','integer','FK\u2192users.id','\u786e\u8ba4\u9009\u6807\u64cd\u4f5c\u4eba'],
        ['selectedAt','timestamp','','\u9009\u6807\u65f6\u95f4'],
        ['cancelledReason','text','','\u53d6\u6d88\u539f\u56e0'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_outsource_orders', 'V2 \u5916\u5305\u8ba2\u5355\u8868',[
        ['id','serial','PK','ID'],
        ['orderNo','varchar(50)','UNIQUE','\u8ba2\u5355\u7f16\u53f7'],
        ['outsourceDemandId','integer','FK\u2192v2_outsource_demands.id','\u5173\u8054\u5916\u5305\u9700\u6c42'],
        ['tenderId','integer','FK\u2192v2_tenders.id','\u4e2d\u6807\u6295\u6807\u8bb0\u5f55'],
        ['opcId','integer','FK\u2192users.id','\u6267\u884c OPC'],
        ['status','v2_outsource_order_status','','\u8ba2\u5355\u72b6\u6001\u679a\u4e3e'],
        ['warrantyStartDate','timestamp','','\u8d28\u4fdd\u5f00\u59cb\u65e5\u671f'],
        ['warrantyEndDate','timestamp','','\u8d28\u4fdd\u7ed3\u675f\u65e5\u671f'],
        ['verifiedBy','integer','FK\u2192users.id','\u9a8c\u6536\u64cd\u4f5c\u4eba'],
        ['verifiedAt','timestamp','','\u9a8c\u6536\u65f6\u95f4'],
        ['cancelledReason','text','','\u53d6\u6d88\u539f\u56e0'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_contracts', 'V2 \u7535\u5b50\u5408\u540c\u8868',[
        ['id','serial','PK','ID'],
        ['contractNo','varchar(50)','UNIQUE','\u5408\u540c\u7f16\u53f7'],
        ['channel','v2_contract_channel','','\u901a\u9053\uff1aa / b'],
        ['clientDemandId','integer','FK','\u5173\u8054\u7532\u65b9\u9700\u6c42\uff08Channel A\uff09'],
        ['outsourceOrderId','integer','FK','\u5173\u8054\u5916\u5305\u8ba2\u5355\uff08Channel B\uff09'],
        ['status','v2_contract_status','','\u5408\u540c\u72b6\u6001\u679a\u4e3e'],
        ['content','text','','\u5408\u540c\u6b63\u6587\uff08Markdown\uff09'],
        ['signedFileUrl','text','','\u7b7e\u7f72\u540e PDF \u6587\u4ef6 GCS Key'],
        ['publisherConfirmedAt','timestamp','','\u53d1\u5e03\u65b9\u786e\u8ba4\u65f6\u95f4'],
        ['publisherRejectedReason','text','','\u53d1\u5e03\u65b9\u62d2\u7b7e\u539f\u56e0'],
        ['opcConfirmedAt','timestamp','','OPC \u786e\u8ba4\u65f6\u95f4'],
        ['signedAt','timestamp','','\u6700\u7ec8\u7b7e\u7f72\u5b8c\u6210\u65f6\u95f4'],
        ['invoiceType','varchar(20)','','\u53d1\u7968\u7c7b\u578b'],
        ['taxRate','numeric(5,2)','','\u7a0e\u7387\uff08%\uff09'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_payment_plans', 'V2 \u652f\u4ed8\u8ba1\u5212\u8868',[
        ['id','serial','PK','ID'],
        ['clientDemandId','integer','FK','\u5173\u8054\u7532\u65b9\u9700\u6c42'],
        ['contractId','integer','FK','\u5173\u8054\u5408\u540c'],
        ['itemNo','integer','','\u652f\u4ed8\u8282\u70b9\u5e8f\u53f7'],
        ['description','varchar(200)','','\u8282\u70b9\u8bf4\u660e'],
        ['amount','real','','\u5e94\u4ed8\u91d1\u989d\uff08\u5143\uff09'],
        ['dueDate','timestamp','','\u9884\u8ba1\u4ed8\u6b3e\u65e5\u671f'],
        ['status','v2_payment_plan_status','','\u72b6\u6001\u679a\u4e3e'],
        ['voucherUrl','text','','\u4ed8\u6b3e\u51ef\u8bc1 GCS Key'],
        ['reviewedBy','integer','FK\u2192users.id','\u5ba1\u6838\u64cd\u4f5c\u4eba'],
        ['reviewedAt','timestamp','','\u5ba1\u6838\u65f6\u95f4'],
        ['paidAt','timestamp','','\u786e\u8ba4\u5230\u8d26\u65f6\u95f4'],
        ['isLastItem','boolean','','\u662f\u5426\u4e3a\u6700\u540e\u4e00\u7b14\u6b3e\u9879'],
        ['paymentOrderNo','text','','\u652f\u4ed8\u6d41\u6c34\u53f7'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('v2_deliverables_a/b', 'V2 \u4ea4\u4ed8\u7269\u8868\uff08A/B \u4e24\u5f20\uff09',[
        ['id','serial','PK','ID'],
        ['clientDemandId','integer','FK\uff08\u4ec5\u8868A\uff09','\u5173\u8054\u7532\u65b9\u9700\u6c42'],
        ['outsourceOrderId','integer','FK\uff08\u4ec5\u8868B\uff09','\u5173\u8054\u5916\u5305\u8ba2\u5355'],
        ['title','varchar(200)','','\u4ea4\u4ed8\u7269\u6807\u9898'],
        ['url','text','','\u5728\u7ebf\u6f14\u793a\u94fe\u63a5\uff08\u53ef\u9009\uff09'],
        ['attachments','jsonb','','\u9644\u4ef6 GCS Key \u6570\u7ec4'],
        ['status','v2_deliverable_status','','\u72b6\u6001\uff1apending/approved/rejected'],
        ['submittedBy','integer','FK\u2192users.id','\u63d0\u4ea4\u4eba\uff08OPC\uff09'],
        ['approvedBy','integer','FK\u2192users.id','\u5ba1\u6838\u4eba'],
        ['submissionCount','integer','DEFAULT 1','\u63d0\u4ea4\u6b21\u6570\uff08\u542b\u91cd\u65b0\u63d0\u4ea4\uff09'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
    ])

    dtbl('contests', '\u5927\u8d5b\u6d3b\u52a8\u8868',[
        ['id','serial','PK','\u5927\u8d5b ID'],
        ['title','varchar(200)','','\u5927\u8d5b\u540d\u79f0'],
        ['details','text','','\u5927\u8d5b\u8be6\u60c5\uff08Markdown\uff09'],
        ['announcementAt','timestamp','','\u516c\u544a\u53d1\u5e03\u65f6\u95f4'],
        ['registrationAt','timestamp','','\u62a5\u540d\u5f00\u59cb\u65f6\u95f4'],
        ['registrationEndAt','timestamp','','\u62a5\u540d\u7ed3\u675f\u65f6\u95f4'],
        ['deadlineAt','timestamp','','\u7b54\u9898/\u63d0\u4ea4\u622a\u6b62\u65f6\u95f4'],
        ['status','contest_status','','draft / published / ended'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
        ['updatedAt','timestamp','DEFAULT now()','\u66f4\u65b0\u65f6\u95f4'],
    ])

    dtbl('contest_registrations', '\u5927\u8d5b\u62a5\u540d\u8bb0\u5f55\u8868',[
        ['id','serial','PK','ID'],
        ['contestId','integer','FK\u2192contests.id','\u5927\u8d5b ID'],
        ['trackId','integer','FK','\u8d5b\u9053 ID'],
        ['userId','integer','FK\u2192users.id','\u53c2\u8d5b\u7528\u6237'],
        ['status','contest_registration_status','','\u62a5\u540d\u72b6\u6001\u679a\u4e3e'],
        ['testSubmittedAt','timestamp','','\u6d4b\u8bc4\u63d0\u4ea4\u65f6\u95f4'],
        ['testGrade','contest_grade','','\u6d4b\u8bc4\u6210\u7ee9\uff1aA/B/C/fail'],
        ['assignmentSubmittedAt','timestamp','','\u4f5c\u54c1\u63d0\u4ea4\u65f6\u95f4'],
        ['assignmentGrade','contest_grade','','\u4f5c\u54c1\u6210\u7ee9\uff1aA/B/C/fail'],
        ['gradeNote','varchar(500)','','\u8bc4\u5206\u5907\u6ce8'],
        ['createdAt','timestamp','DEFAULT now()','\u62a5\u540d\u65f6\u95f4'],
    ])

    dtbl('cat_categories', '\u8d5b\u9053\u5206\u7c7b\u914d\u7f6e\u8868',[
        ['id','serial','PK','\u5206\u7c7b ID'],
        ['code','varchar(20)','UNIQUE','\u5206\u7c7b\u7f16\u7801'],
        ['name','varchar(50)','','\u5206\u7c7b\u540d\u79f0\uff08\u5982 UI\u8bbe\u8ba1\u3001\u4ea7\u54c1\u7b56\u5212\uff09'],
        ['description','text','','\u5206\u7c7b\u63cf\u8ff0'],
        ['docTemplate','text','','\u9700\u6c42\u6587\u6863\u6a21\u677f\uff08Markdown\uff09'],
        ['isActive','boolean','','\u662f\u5426\u542f\u7528'],
        ['sortOrder','integer','','\u6392\u5e8f\u6743\u91cd'],
    ])

    dtbl('agent_configs', 'AI \u667a\u80fd\u4f53\u914d\u7f6e\u8868',[
        ['id','serial','PK','\u914d\u7f6e ID'],
        ['name','varchar(100)','','\u667a\u80fd\u4f53\u540d\u79f0'],
        ['sceneKey','varchar(50)','UNIQUE','\u573a\u666f\u952e\uff08\u5982 demand-analysis\uff09'],
        ['systemPrompt','text','','\u7cfb\u7edf\u63d0\u793a\u8bcd\uff08System Prompt\uff09'],
        ['isEnabled','boolean','DEFAULT true','\u662f\u5426\u542f\u7528'],
        ['sortOrder','integer','','\u6392\u5e8f\u6743\u91cd'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
    ])

    dtbl('skills', 'AI Skill \u6269\u5c55\u5305\u8868',[
        ['id','serial','PK','Skill ID'],
        ['name','varchar(200)','','Skill \u540d\u79f0'],
        ['description','text','','\u529f\u80fd\u63cf\u8ff0'],
        ['sourceUrl','varchar(2000)','','GitHub \u6e90\u4ed3\u5e93 URL'],
        ['skillMd','text','','Skill \u5b9a\u4e49\u5185\u5bb9\uff08Markdown\uff09'],
        ['refFiles','jsonb','','\u5f15\u7528\u6587\u4ef6 map'],
        ['isActive','boolean','','\u662f\u5426\u6fc0\u6d3b'],
        ['createdAt','timestamp','DEFAULT now()','\u5b89\u88c5\u65f6\u95f4'],
    ])

    dtbl('notifications', '\u7ad9\u5185\u901a\u77e5\u8868',[
        ['id','serial','PK','\u901a\u77e5 ID'],
        ['userId','integer','FK\u2192users.id','\u63a5\u6536\u7528\u6237'],
        ['type','notification_type','','\u901a\u77e5\u7c7b\u578b\uff08\u679a\u4e3e\uff09'],
        ['title','varchar(200)','','\u901a\u77e5\u6807\u9898'],
        ['content','text','','\u901a\u77e5\u5185\u5bb9'],
        ['isRead','boolean','DEFAULT false','\u662f\u5426\u5df2\u8bfb'],
        ['relatedId','integer','','\u5173\u8054\u4e1a\u52a1\u5bf9\u8c61 ID'],
        ['relatedType','varchar(20)','','\u5173\u8054\u4e1a\u52a1\u7c7b\u578b'],
        ['createdAt','timestamp','DEFAULT now()','\u521b\u5efa\u65f6\u95f4'],
    ])

    story.append(PageBreak())

    # ===== Chapter 5: Interface Design =====
    story.append(H1('5  \u63a5\u53e3\u8bbe\u8ba1'))

    story.append(H2('5.1  \u63a5\u53e3\u89c4\u8303'))
    story.append(H3('5.1.1  \u57fa\u672c\u7ea6\u5b9a'))
    for t in [
        '\u6240\u6709 API \u4ee5 /api \u4e3a\u524d\u7f00\uff0c\u91c7\u7528\u6807\u51c6 RESTful \u8bbe\u8ba1\u98ce\u683c\uff1b',
        '\u8bf7\u6c42/\u54cd\u5e94\u5747\u4f7f\u7528 JSON \u683c\u5f0f\uff08Content-Type: application/json\uff09\uff1b',
        '\u6587\u4ef6\u4e0a\u4f20\u63a5\u53e3\u4f7f\u7528 multipart/form-data\uff1b',
        '\u6240\u6709\u65f6\u95f4\u5b57\u6bb5\u4ee5 ISO 8601 \u683c\u5f0f\u8868\u793a\uff08UTC \u65f6\u95f4\u6233\uff09\uff1b',
        '\u9519\u8bef\u54cd\u5e94\u7edf\u4e00\u683c\u5f0f\uff1a{ "error": "\u9519\u8bef\u63cf\u8ff0\u5b57\u7b26\u4e32" }\uff1b',
        '\u5217\u8868\u63a5\u53e3\u652f\u6301\u5206\u9875\uff1a?page=1&pageSize=20\uff0c\u54cd\u5e94\u683c\u5f0f\uff1a{ items: [...], total: N }\u3002',
    ]:
        story.append(B(t))
    story.append(SP())
    story.append(H3('5.1.2  \u9274\u6743\u89c4\u8303'))
    story.append(P('\u9700\u8981\u767b\u5f55\u7684\u63a5\u53e3\u987b\u5728\u8bf7\u6c42\u5934\u643a\u5e26 Access Token\uff1a'))
    story.append(C('Authorization: Bearer <access_token>'))
    story.append(SP(0.5))
    story.append(tbl(['\u4ee4\u724c\u7c7b\u578b','\u6709\u6548\u671f','\u5b58\u50a8\u4f4d\u7f6e','\u7528\u9014'],[
        ['Access Token','2 \u5c0f\u65f6','\u5185\u5b58\uff08\u524d\u7aef state\uff09','\u63a5\u53e3\u9274\u6743'],
        ['Refresh Token','30 \u5929','HttpOnly Cookie / \u6570\u636e\u5e93','\u5237\u65b0 Access Token'],
    ],widths=[3*cm,2.5*cm,5*cm,4.5*cm]))
    story.append(SP())
    story.append(H3('5.1.3  HTTP \u72b6\u6001\u7801\u7ea6\u5b9a'))
    story.append(tbl(['\u72b6\u6001\u7801','\u542b\u4e49','\u5178\u578b\u573a\u666f'],[
        ['200 OK','\u8bf7\u6c42\u6210\u529f','\u67e5\u8be2\u3001\u66f4\u65b0\u6210\u529f'],
        ['201 Created','\u521b\u5efa\u6210\u529f','POST \u521b\u5efa\u65b0\u8d44\u6e90'],
        ['400 Bad Request','\u8bf7\u6c42\u53c2\u6570\u9519\u8bef','Zod \u6821\u9a8c\u5931\u8d25\u3001\u53c2\u6570\u7f3a\u5931'],
        ['401 Unauthorized','\u672a\u767b\u5f55\u6216\u4ee4\u724c\u5931\u6548','\u7f3a\u5c11/\u8fc7\u671f Authorization \u5934'],
        ['403 Forbidden','\u6743\u9650\u4e0d\u8db3','\u89d2\u8272\u4e0d\u5339\u914d\u3001\u8d26\u53f7\u672a\u5ba1\u6838'],
        ['404 Not Found','\u8d44\u6e90\u4e0d\u5b58\u5728','\u67e5\u8be2\u4e0d\u5b58\u5728\u7684 ID'],
        ['409 Conflict','\u6570\u636e\u51b2\u7a81','\u90ae\u7b261/\u624b\u673a\u53f7\u5df2\u6ce8\u518c'],
        ['429 Too Many Requests','\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41','\u89e6\u53d1\u9650\u6d41\u89c4\u5219'],
        ['500 Internal Server Error','\u670d\u52a1\u7aef\u5f02\u5e38','\u672a\u6355\u83b7\u7684\u8fd0\u884c\u65f6\u9519\u8bef'],
    ],widths=[4*cm,3.5*cm,7.5*cm]))
    story.append(SP(2))

    story.append(H2('5.2  \u8ba4\u8bc1\u63a5\u53e3'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u9700\u8ba4\u8bc1','\u4e3b\u8981\u53c2\u6570','\u8fd4\u56de'],[
        ['POST','/api/auth/send-sms-code','\u5426','phone','{ success: true }'],
        ['POST','/api/auth/register','\u5426','nickname, email, password, role, phone, smsCode','{ accessToken, user }'],
        ['POST','/api/auth/login','\u5426','identifier, password, role','{ accessToken, user }'],
        ['POST','/api/auth/refresh','\u5426','refreshToken','{ accessToken }'],
        ['POST','/api/auth/logout','\u662f','-','{ success: true }'],
        ['POST','/api/auth/change-password','\u662f','oldPassword, newPassword','{ success: true }'],
        ['POST','/api/auth/forgot-password','\u5426','email','{ success: true }'],
    ],widths=[1.5*cm,5.5*cm,1.5*cm,4*cm,3.5*cm]))
    story.append(SP(2))

    story.append(H2('5.3  \u7528\u6237\u4e0e\u8d44\u6599\u63a5\u53e3'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u9700\u8ba4\u8bc1','\u8bf4\u660e'],[
        ['GET','/api/users/me','\u662f','\u83b7\u53d6\u5f53\u524d\u767b\u5f55\u7528\u6237\u5b8c\u6574\u4fe1\u606f'],
        ['GET','/api/users/:userId','\u662f','\u83b7\u53d6\u6307\u5b9a\u7528\u6237\u57fa\u672c\u4fe1\u606f'],
        ['GET','/api/users/:userId/opc-profile','\u662f','\u83b7\u53d6 OPC \u8be6\u7ec6\u8d44\u6599'],
        ['PUT','/api/users/:userId/opc-profile','\u662f','\u66f4\u65b0 OPC \u8d44\u6599\uff08\u4ec5\u672c\u4eba\uff09'],
        ['GET','/api/users/:userId/publisher-profile','\u662f','\u83b7\u53d6\u53d1\u5e03\u65b9\u673a\u6784\u8d44\u6599'],
        ['PATCH','/api/users/:userId/publisher-profile','\u662f','\u66f4\u65b0\u53d1\u5e03\u65b9\u8d44\u6599\uff08\u4ec5\u672c\u4eba\uff09'],
        ['GET','/api/portfolios','\u5426','\u4f5c\u54c1\u96c6\u5217\u8868\uff0c\u652f\u6301 keyword/catId/page \u5206\u9875'],
        ['POST','/api/portfolios','\u662f','\u521b\u5efa\u4f5c\u54c1\u96c6\uff08OPC \u4e13\u5c5e\uff09'],
        ['PUT','/api/portfolios/:id','\u662f','\u66f4\u65b0\u4f5c\u54c1\u96c6'],
        ['DELETE','/api/portfolios/:id','\u662f','\u5220\u9664\u4f5c\u54c1\u96c6'],
    ],widths=[1.5*cm,6.5*cm,1.5*cm,5.5*cm]))
    story.append(SP(2))

    story.append(H2('5.4  \u9700\u6c42\u63a5\u53e3\uff08V1\uff09'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u9700\u8ba4\u8bc1','\u8bf4\u660e'],[
        ['GET','/api/demands','\u5426','\u516c\u5f00\u9700\u6c42\u5217\u8868\uff0c\u652f\u6301 type/opcLevel/page \u7b5b\u9009'],
        ['GET','/api/demands/:id','\u5426','\u9700\u6c42\u8be6\u60c5'],
        ['POST','/api/demands','\u53d1\u5e03\u65b9','\u521b\u5efa\u9700\u6c42\u8349\u7a3f\uff0c\u8fd4\u56de demandNo'],
        ['PUT','/api/demands/:id','\u53d1\u5e03\u65b9','\u66f4\u65b0\u9700\u6c42\u5185\u5bb9\uff08\u4ec5\u8349\u7a3f\u6216\u9a73\u56de\u72b6\u6001\uff09'],
        ['POST','/api/demands/:id/submit','\u53d1\u5e03\u65b9','\u63d0\u4ea4\u5ba1\u6838'],
        ['POST','/api/demands/:id/cancel','\u53d1\u5e03\u65b9','\u64a4\u9500\u9700\u6c42'],
        ['POST','/api/bids','OPC','\u63d0\u4ea4\u6295\u6807\uff08\u6821\u9a8c\u7b49\u7ea7\u3001\u552f\u4e00\u6027\uff09'],
        ['GET','/api/bids','\u662f','\u6211\u7684\u6295\u6807\u5217\u8868\uff08OPC \u89c6\u89d2\uff09'],
        ['GET','/api/demands/:id/bids','\u53d1\u5e03\u65b9','\u6307\u5b9a\u9700\u6c42\u7684\u6240\u6709\u6295\u6807\u5217\u8868'],
        ['POST','/api/bids/:id/select','\u53d1\u5e03\u65b9','\u9009\u5b9a\u4e2d\u6807\uff0c\u89e6\u53d1\u5176\u4f59\u843d\u6807'],
    ],widths=[1.5*cm,5.5*cm,1.8*cm,6.2*cm]))
    story.append(SP(2))

    story.append(H2('5.5  V2 \u4e1a\u52a1\u6838\u5fc3\u63a5\u53e3'))
    story.append(H3('5.5.1  V2 \u7532\u65b9\u9700\u6c42'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u89d2\u8272','\u8bf4\u660e'],[
        ['GET','/api/v2/client-demands','\u53d1\u5e03\u65b9/\u7ba1\u7406\u5458','\u7532\u65b9\u9700\u6c42\u5217\u8868'],
        ['POST','/api/v2/client-demands','\u53d1\u5e03\u65b9','\u521b\u5efa\u7532\u65b9\u9700\u6c42'],
        ['GET','/api/v2/client-demands/:id','\u53d1\u5e03\u65b9/\u7ba1\u7406\u5458','\u9700\u6c42\u8be6\u60c5'],
        ['PATCH','/api/v2/client-demands/:id','\u53d1\u5e03\u65b9','\u66f4\u65b0\u9700\u6c42\u57fa\u672c\u4fe1\u606f'],
        ['PATCH','/api/v2/client-demands/:id/status','\u7ba1\u7406\u5458','\u6d41\u8f6c\u9700\u6c42\u72b6\u6001'],
    ],widths=[1.5*cm,6.5*cm,2.5*cm,4.5*cm]))
    story.append(SP())
    story.append(H3('5.5.2  V2 \u5916\u5305\u9700\u6c42\u4e0e\u6295\u6807'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u89d2\u8272','\u8bf4\u660e'],[
        ['GET','/api/v2/outsource-demands','OPC/\u7ba1\u7406\u5458','\u5916\u5305\u9700\u6c42\u5927\u5385\u5217\u8868'],
        ['POST','/api/v2/outsource-demands','\u7ba1\u7406\u5458','\u4ece\u7532\u65b9\u9700\u6c42\u6d3e\u751f\u5916\u5305\u9700\u6c42'],
        ['POST','/api/v2/tenders','OPC','\u63d0\u4ea4\u6295\u6807'],
        ['GET','/api/v2/tenders','OPC/\u7ba1\u7406\u5458','\u6295\u6807\u5217\u8868'],
        ['PATCH','/api/v2/tenders/:id/select','\u7ba1\u7406\u5458','\u786e\u8ba4\u4e2d\u6807\uff0c\u521b\u5efa\u8ba2\u5355'],
    ],widths=[1.5*cm,6.5*cm,2.5*cm,4.5*cm]))
    story.append(SP())
    story.append(H3('5.5.3  V2 \u5408\u540c\u3001\u652f\u4ed8\u4e0e\u4ea4\u4ed8\u7269'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u89d2\u8272','\u8bf4\u660e'],[
        ['GET','/api/v2/contracts','\u76f8\u5173\u65b9','\u5408\u540c\u5217\u8868'],
        ['POST','/api/v2/contracts/:id/confirm','\u53d1\u5e03\u65b9','\u53d1\u5e03\u65b9\u786e\u8ba4\u5408\u540c'],
        ['POST','/api/v2/contracts/:id/opc-confirm','OPC','OPC \u786e\u8ba4\u7b7e\u7f72'],
        ['POST','/api/v2/payment-plans/:id/upload-voucher','\u53d1\u5e03\u65b9','\u4e0a\u4f20\u4ed8\u6b3e\u51ef\u8bc1'],
        ['POST','/api/v2/payment-plans/:id/confirm','\u7ba1\u7406\u5458','\u786e\u8ba4\u5230\u8d26'],
        ['POST','/api/v2/deliverables-b','OPC','\u63d0\u4ea4\u4ea4\u4ed8\u7269\uff08\u652f\u6301\u591a\u6587\u4ef6\uff09'],
        ['PATCH','/api/v2/deliverables-b/:id/approve','\u7ba1\u7406\u5458','\u9a8c\u6536\u901a\u8fc7'],
        ['PATCH','/api/v2/deliverables-b/:id/reject','\u7ba1\u7406\u5458','\u9a8c\u6536\u4e0d\u901a\u8fc7'],
    ],widths=[1.5*cm,6.5*cm,2.5*cm,4.5*cm]))
    story.append(SP(2))

    story.append(H2('5.6  \u5927\u8d5b\u63a5\u53e3'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u89d2\u8272','\u8bf4\u660e'],[
        ['GET','/api/contests','\u516c\u5f00','\u5927\u8d5b\u5217\u8868\uff08\u5df2\u53d1\u5e03\uff09'],
        ['GET','/api/contests/:id','\u516c\u5f00','\u5927\u8d5b\u8be6\u60c5\u4e0e\u8d5b\u9053\u4fe1\u606f'],
        ['POST','/api/contests/:id/tracks/:trackId/register','OPC','\u5927\u8d5b\u62a5\u540d'],
        ['PUT','/api/contests/registrations/:id/test','OPC','\u63d0\u4ea4\u5728\u7ebf\u6d4b\u8bc4\u7b54\u5377'],
        ['PUT','/api/contests/registrations/:id/assignment','OPC','\u63d0\u4ea4\u5927\u4f5c\u4e1a/\u5b9e\u64cd\u4f5c\u54c1'],
        ['GET','/api/admin/contests','\u7ba1\u7406\u5458','\u5927\u8d5b\u7ba1\u7406\u5217\u8868'],
        ['POST','/api/admin/contests','\u7ba1\u7406\u5458','\u521b\u5efa\u5927\u8d5b'],
        ['PATCH','/api/admin/contests/:id/publish','\u7ba1\u7406\u5458','\u53d1\u5e03\u5927\u8d5b'],
        ['PATCH','/api/admin/contests/registrations/:id','\u7ba1\u7406\u5458','\u5f55\u5165/\u4fee\u6539\u6210\u7ee9'],
    ],widths=[1.5*cm,6*cm,2.5*cm,5*cm]))
    story.append(SP(2))

    story.append(H2('5.7  AI \u667a\u80fd\u4f53\u63a5\u53e3'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u8bf4\u660e'],[
        ['POST','/api/agent/demand-analysis/chat','\u53d1\u9001\u6d88\u606f\u7ed9 AI \u667a\u80fd\u4f53\uff0c\u652f\u6301 demandId \u5173\u8054\u9700\u6c42\u4e0a\u4e0b\u6587'],
        ['GET','/api/agent/demand-analysis/history/:id','\u83b7\u53d6\u6307\u5b9a\u9700\u6c42\u5173\u8054\u7684 AI \u5bf9\u8bdd\u5386\u53f2\u8bb0\u5f55'],
        ['POST','/api/agent/demand-analysis/bind-demand','\u5c06\u5f53\u524d\u5bf9\u8bdd\u4f1a\u8bdd\u7ed1\u5b9a\u5230\u5177\u4f53\u9700\u6c42 ID'],
        ['GET','/api/admin/agent-configs','\u7ba1\u7406\u5458\uff1a\u83b7\u53d6\u6240\u6709\u667a\u80fd\u4f53\u914d\u7f6e\u5217\u8868'],
        ['POST','/api/admin/skills','\u7ba1\u7406\u5458\uff1a\u4ece GitHub URL \u5b89\u88c5 Skill'],
        ['PATCH','/api/admin/skills/:id','\u7ba1\u7406\u5458\uff1a\u66f4\u65b0 Skill \u5b9a\u4e49'],
        ['DELETE','/api/admin/skills/:id','\u7ba1\u7406\u5458\uff1a\u5220\u9664 Skill'],
    ],widths=[1.5*cm,6.5*cm,7*cm]))
    story.append(SP(2))

    story.append(H2('5.8  \u7ba1\u7406\u5458\u63a5\u53e3'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u8bf4\u660e'],[
        ['GET','/api/admin/stats','\u4eea\u8868\u76d8\u6838\u5fc3\u7edf\u8ba1\u6570\u636e\uff08\u7528\u6237\u6570\u3001\u8ba2\u5355\u6570\u3001\u4ea4\u6613\u989d\u7b49\uff09'],
        ['GET','/api/admin/users','\u7528\u6237\u7ba1\u7406\u5217\u8868\uff08\u652f\u6301 role/status/keyword \u7b5b\u9009\uff09'],
        ['PATCH','/api/admin/users/:id','\u7528\u6237\u64cd\u4f5c\uff1aban/unban/setLevel'],
        ['GET','/api/admin/finance','\u8d22\u52a1\u6d41\u6c34\u6c47\u603b\uff08\u603b\u6536\u5165\u3001\u7ed3\u7b97\u3001\u5f85\u7ed3\u7b97\uff09'],
        ['GET','/api/admin/ecosystem','OPC \u4eba\u624d\u751f\u6001\u6c60\uff08\u652f\u6301\u4fe1\u7528\u7b49\u7ea7\u3001\u8d5b\u9053\u8fc7\u6ee4\uff09'],
        ['GET','/api/admin/site-settings','\u8bfb\u53d6\u5e73\u53f0\u5168\u5c40\u914d\u7f6e'],
        ['PUT','/api/admin/site-settings','\u66f4\u65b0\u5e73\u53f0\u5168\u5c40\u914d\u7f6e'],
        ['GET','/api/admin/credit-levels','\u4fe1\u7528\u7b49\u7ea7\u914d\u7f6e\u5217\u8868'],
        ['POST','/api/admin/credit-levels','\u521b\u5efa\u4fe1\u7528\u7b49\u7ea7'],
        ['PUT','/api/admin/credit-levels/:id','\u66f4\u65b0\u4fe1\u7528\u7b49\u7ea7\u914d\u7f6e'],
    ],widths=[1.5*cm,5.5*cm,8*cm]))
    story.append(SP(2))

    story.append(H2('5.9  \u6587\u4ef6\u5b58\u50a8\u4e0e\u901a\u77e5\u63a5\u53e3'))
    story.append(tbl(['\u65b9\u6cd5','\u8def\u5f84','\u8bf4\u660e'],[
        ['POST','/api/storage/upload','\u4e0a\u4f20\u6587\u4ef6\uff08multipart/form-data\uff09\uff0c\u8fd4\u56de GCS \u5bf9\u8c61 Key'],
        ['GET','/api/storage/objects/:key','\u83b7\u53d6\u6587\u4ef6\u8bbf\u95ee URL\uff08\u65f6\u6548\u6027\u9884\u7b7e\u540d URL\uff0c\u6709\u6548 15 \u5206\u949f\uff09'],
        ['GET','/api/notifications','\u5f53\u524d\u7528\u6237\u901a\u77e5\u5217\u8868\uff08\u652f\u6301 isRead \u8fc7\u6ee4\uff09'],
        ['POST','/api/notifications/read-all','\u5168\u90e8\u6807\u8bb0\u5df2\u8bfb'],
        ['POST','/api/notifications/:id/read','\u5355\u6761\u6807\u8bb0\u5df2\u8bfb'],
        ['GET','/api/posts','\u793e\u533a\u52a8\u6001\u5217\u8868'],
        ['POST','/api/posts','\u53d1\u5e03\u52a8\u6001\uff08OPC \u4e13\u5c5e\uff09'],
        ['GET','/api/courses','\u5b66\u4e60\u4e2d\u5fc3\u8bfe\u7a0b\u5217\u8868'],
        ['GET','/api/health','\u670d\u52a1\u5065\u5eb7\u68c0\u67e5\uff08\u65e0\u9700\u8ba4\u8bc1\uff09'],
    ],widths=[1.5*cm,5.5*cm,8*cm]))
    story.append(PageBreak())

    # ===== Chapter 6: Security =====
    story.append(H1('6  \u5b89\u5168\u8bbe\u8ba1'))

    story.append(H2('6.1  \u8eab\u4efd\u8ba4\u8bc1\u5b89\u5168'))
    story.append(tbl(['\u5b89\u5168\u63aa\u65bd','\u5b9e\u73b0\u65b9\u5f0f','\u9632\u62a4\u76ee\u6807'],[
        ['\u5bc6\u7801\u54c8\u5e0c\u5b58\u50a8','bcrypt\uff08cost=10\uff09\uff0c\u6bcf\u6b21\u54c8\u5e0c\u542b\u968f\u673a\u76d0\u503c','\u9632\u6570\u636e\u5e93\u6cc4\u9732\u540e\u5bc6\u7801\u88ab\u7834\u89e3'],
        ['JWT \u53cc\u4ee4\u724c','Access Token\uff082h\uff09+ Refresh Token\uff0830d\uff09','\u77ed\u671f\u4ee4\u724c\u51cf\u5c11\u88ab\u76d7\u98ce\u9669'],
        ['\u767b\u5f55\u9650\u6d41','express-rate-limit\uff1a\u5355 IP 15 \u5206\u949f\u5185\u6700\u591a 10 \u6b21','\u9632\u66b4\u529b\u7834\u89e3'],
        ['\u77ed\u4fe1\u9a8c\u8bc1\u7801','6 \u4f4d\u6570\u5b57\uff0c60 \u79d2\u6709\u6548\u671f\uff0c\u6bcf\u53f7\u6bcf\u5c0f\u65f6\u9650 5 \u6b21','\u6ce8\u518c\u4e8c\u6b21\u9a8c\u8bc1'],
        ['\u670d\u52a1\u7aef\u4ee4\u724c\u64a4\u9500','Refresh Token \u5b58\u50a8\u4e8e\u6570\u636e\u5e93\uff0c\u53ef\u4e3b\u52a8\u5220\u9664','\u652f\u6301\u5f3a\u5236\u4e0b\u7ebf\uff08\u6539\u5bc6\u3001\u5c01\u53f7\uff09'],
    ],widths=[3.5*cm,5.5*cm,6*cm]))
    story.append(SP(2))

    story.append(H2('6.2  \u4f20\u8f93\u5b89\u5168'))
    story.append(tbl(['\u5b89\u5168\u63aa\u65bd','\u5b9e\u73b0\u65b9\u5f0f','\u9632\u62a4\u76ee\u6807'],[
        ['\u5168\u7ad9 HTTPS','mTLS \u53cc\u5411\u8ba4\u8bc1\uff0cHTTP \u5f3a\u5236\u91cd\u5b9a\u5411\u81f3 HTTPS','\u9632\u4e2d\u95f4\u4eba\u653b\u51fb'],
        ['HSTS','Strict-Transport-Security \u54cd\u5e94\u5934\uff08max-age=31536000\uff09','\u9632 SSL \u964d\u7ea7\u653b\u51fb'],
        ['CORS \u914d\u7f6e','\u767d\u540d\u5355\u5141\u8bb8\u6765\u6e90\uff0c\u9650\u5236\u975e\u6388\u6743\u8de8\u57df\u8bf7\u6c42','\u9632\u975e\u6388\u6743\u8de8\u57df\u8bbf\u95ee'],
        ['\u5b89\u5168\u54cd\u5e94\u5934','helmet \u4e2d\u95f4\u4ef6\uff1aX-Frame-Options\u3001X-Content-Type-Options \u7b49','\u9632\u70b9\u51fb\u52ab\u6301\u3001MIME \u5631\u63a2'],
        ['CSP','Content-Security-Policy \u9650\u5236\u8d44\u6e90\u6765\u6e90','\u9632 XSS \u6ce8\u5165\u5916\u90e8\u811a\u672c'],
    ],widths=[3.5*cm,5.5*cm,6*cm]))
    story.append(SP(2))

    story.append(H2('6.3  \u6570\u636e\u8bbf\u95ee\u5b89\u5168'))
    story.append(tbl(['\u5b89\u5168\u63aa\u65bd','\u5b9e\u73b0\u65b9\u5f0f','\u9632\u62a4\u76ee\u6807'],[
        ['\u53c2\u6570\u5316\u67e5\u8be2','Drizzle ORM \u5168\u9762\u4f7f\u7528\u53c2\u6570\u5316\u67e5\u8be2\uff0c\u7981\u6b62\u5b57\u7b26\u4e32\u62fc\u63a5 SQL','\u9632 SQL \u6ce8\u5165'],
        ['\u6700\u5c0f\u6743\u9650\u539f\u5219','\u6570\u636e\u5e93\u7528\u6237\u4ec5\u62e5\u6709\u4e1a\u52a1\u5fc5\u8981\u7684 SELECT/INSERT/UPDATE/DELETE \u6743\u9650','\u964d\u4f4e\u6cc4\u9732\u5f71\u54cd\u8303\u56f4'],
        ['\u6570\u636e\u8fc7\u6ee4','\u4e1a\u52a1\u63a5\u53e3\u4e25\u683c\u6309 userId \u8fc7\u6ee4\u6570\u636e\uff0c\u7981\u6b62\u8d8a\u6743\u8bbf\u95ee\u4ed6\u4eba\u6570\u636e','\u9632\u6c34\u5e73\u8d8a\u6743'],
        ['\u6743\u9650\u5206\u5c42\u6821\u9a8c','JWT \u6709\u6548\u6027 \u2192 \u89d2\u8272\u6821\u9a8c \u2192 \u8d26\u53f7\u72b6\u6001 \u2192 \u4e1a\u52a1\u6240\u6709\u6743\uff0c\u56db\u5c42\u9012\u8fdb','\u9632\u5782\u76f4\u8d8a\u6743'],
        ['\u654f\u611f\u5b57\u6bb5\u5c4f\u853d','\u7528\u6237\u5bc6\u7801\u54c8\u5e0c\u3001\u94f6\u884c\u5361\u53f7\u7b49\u5b57\u6bb5\u4e0d\u5728 API \u54cd\u5e94\u4e2d\u8fd4\u56de','\u9632\u654f\u611f\u4fe1\u606f\u6cc4\u9732'],
    ],widths=[3.5*cm,5.5*cm,6*cm]))
    story.append(SP(2))

    story.append(H2('6.4  \u6587\u4ef6\u5b89\u5168'))
    story.append(tbl(['\u5b89\u5168\u63aa\u65bd','\u5b9e\u73b0\u65b9\u5f0f','\u9632\u62a4\u76ee\u6807'],[
        ['MIME \u53cc\u91cd\u6821\u9a8c','\u6821\u9a8c Content-Type \u5934 + \u6587\u4ef6\u6269\u5c55\u540d\u767d\u540d\u5355\uff08\u4e24\u8005\u5747\u9700\u5339\u914d\uff09','\u9632\u6076\u610f\u6587\u4ef6\u4f2a\u88c5\u4e0a\u4f20'],
        ['\u5927\u5c0f\u9650\u5236','\u6309\u6587\u4ef6\u7c7b\u578b\u8bbe\u5b9a\u4e0a\u9650\uff08\u56fe\u750710MB\u3001\u6587\u686350MB\u3001\u89c6\u9891500MB\uff09','\u9632\u8d44\u6e90\u8017\u5c3d\u653b\u51fb'],
        ['\u79c1\u6709\u6876\u5b58\u50a8','GCS \u6876\u8bbe\u4e3a\u79c1\u6709\uff0c\u4e0d\u5bf9\u5916\u516c\u5f00','\u9632\u672a\u6388\u6743\u76f4\u63a5\u8bbf\u95ee\u6587\u4ef6'],
        ['\u9884\u7b7e\u540d URL','\u8bbf\u95ee\u6587\u4ef6\u987b\u7ecf\u540e\u7aef\u751f\u6210\u65f6\u6548\u6027 URL\uff0115 \u5206\u949f\u6709\u6548\uff09','\u9632 URL \u6cc4\u9732\u540e\u957f\u671f\u88ab\u8bbf\u95ee'],
        ['\u8def\u5f84\u968f\u673a\u5316','\u4e0a\u4f20\u8def\u5f84\u542b UUID\uff1auploads/{uuid}.{ext}','\u9632\u6587\u4ef6\u540d\u679a\u4e3e\u653b\u51fb'],
    ],widths=[3.5*cm,5.5*cm,6*cm]))
    story.append(SP(2))

    story.append(H2('6.5  \u64cd\u4f5c\u5ba1\u8ba1'))
    story.append(P('\u7cfb\u7edf\u5bf9\u4ee5\u4e0b\u5173\u952e\u64cd\u4f5c\u8fdb\u884c\u65e5\u5fd7\u8bb0\u5f55\uff0c\u901a\u8fc7 Pino \u4ee5\u7ed3\u6784\u5316 JSON \u683c\u5f0f\u8f93\u51fa\uff0c\u4fdd\u7559\u65f6\u95f4\u4e0d\u4f4e\u4e8e 180 \u5929\uff1a'))
    for t in [
        '\u7ba1\u7406\u5458\u8d26\u53f7\u64cd\u4f5c\uff1a\u7528\u6237\u5ba1\u6838\uff08\u901a\u8fc7/\u9a73\u56de\uff09\u3001\u8d26\u53f7\u5c01\u7981/\u89e3\u5c01\u3001\u7b49\u7ea7\u8c03\u6574\uff1b',
        '\u8d22\u52a1\u64cd\u4f5c\uff1a\u4ed8\u6b3e\u786e\u8ba4\u3001\u6b3e\u9879\u91ca\u653e\u3001\u7ed3\u7b97\u5ba1\u6279\u6253\u6b3e\uff1b',
        '\u7cfb\u7edf\u914d\u7f6e\u53d8\u66f4\uff1a\u5e73\u53f0\u53c2\u6570\u4fee\u6539\u3001\u4fe1\u7528\u7b49\u7ea7\u89c4\u5219\u8c03\u6574\uff1b',
        '\u5f02\u5e38\u767b\u5f55\uff1a\u540c\u4e00 IP \u591a\u6b21\u767b\u5f55\u5931\u8d25\u3001\u5f02\u5e38\u65f6\u95f4\u6bb5\u767b\u5f55\u7b49\u3002',
    ]:
        story.append(B(t))
    story.append(PageBreak())

    # ===== Chapter 7: Key Algorithms =====
    story.append(H1('7  \u5173\u952e\u7b97\u6cd5\u4e0e\u6d41\u7a0b'))

    story.append(H2('7.1  JWT \u53cc\u4ee4\u724c\u9274\u6743\u6d41\u7a0b'))
    story.append(tbl(['\u6b65\u9aa4','\u64cd\u4f5c','\u8bf4\u660e'],[
        ['1. \u767b\u5f55','\u5ba2\u6237\u7aef POST /api/auth/login','\u670d\u52a1\u7aef\u9a8c\u8bc1\u5bc6\u7801\uff0c\u9881\u53d1 accessToken\uff08JWT, 2h\uff09\u548c refreshToken\uff08UUID, \u5b58\u5165 DB, 30d\uff09'],
        ['2. \u8bf7\u6c42','\u5ba2\u6237\u7aef\u643a\u5e26 Authorization: Bearer <token>','\u670d\u52a1\u7aef requireAuth \u4e2d\u95f4\u4ef6\u9a8c\u8bc1 JWT \u7b7e\u540d\u4e0e\u8fc7\u671f\u65f6\u95f4\uff0c\u89e3\u6790 userId \u6ce8\u5165 req.user'],
        ['3. \u4ee4\u724c\u8fc7\u671f','\u5ba2\u6237\u7aef\u6536\u5230 401 Unauthorized','\u81ea\u52a8\u89e6\u53d1 POST /api/auth/refresh\uff0c\u643a\u5e26 refreshToken'],
        ['4. \u5237\u65b0','\u670d\u52a1\u7aef\u67e5\u8be2 DB \u9a8c\u8bc1 refreshToken \u6709\u6548\u6027','\u6709\u6548\u5219\u9881\u53d1\u65b0 accessToken\uff1brefreshToken \u8fc7\u671f\u6216\u5df2\u64a4\u9500\u5219\u8981\u6c42\u91cd\u65b0\u767b\u5f55'],
        ['5. \u767b\u51fa','\u5ba2\u6237\u7aef POST /api/auth/logout','\u670d\u52a1\u7aef\u4ece DB \u5220\u9664\u5bf9\u5e94 refreshToken\uff0c\u4ee4\u724c\u7acb\u5373\u5931\u6548'],
        ['6. \u5f3a\u5236\u4e0b\u7ebf','\u7ba1\u7406\u5458\u5c01\u7981\u6216\u7528\u6237\u4fee\u6539\u5bc6\u7801','\u670d\u52a1\u7aef\u5220\u9664\u8be5\u7528\u6237\u6240\u6709 refreshToken\uff0c\u5df2\u53d1\u653e\u7684 accessToken \u5728 2h \u5185\u81ea\u7136\u5931\u6548'],
    ],widths=[2*cm,4.5*cm,8.5*cm]))
    story.append(SP())
    story.append(P('JWT Payload \u7ed3\u6784\uff1a'))
    story.append(C('{ "userId": number, "role": "opc"|"publisher"|"admin", "iat": number, "exp": number }'))
    story.append(SP(2))

    story.append(H2('7.2  \u4e1a\u52a1\u7f16\u53f7\u751f\u6210\u7b97\u6cd5'))
    story.append(tbl(['\u5bf9\u8c61','\u7f16\u53f7\u683c\u5f0f','\u793a\u4f8b','\u8bf4\u660e'],[
        ['V1 \u9700\u6c42','D + YYYYMMDD + 4\u4f4d\u5e8f\u53f7','D202607230001','\u6309\u65e5\u671f\u5206\u6bb5\uff0c\u6bcf\u65e5\u4ece 0001 \u5f00\u59cb\u9012\u589e'],
        ['V2 \u7532\u65b9\u9700\u6c42','CD + \u65f6\u95f4\u6233\u6beb\u79d2\u540e6\u4f4d','CD260723001234','\u65f6\u95f4\u6233\u786e\u4fdd\u552f\u4e00\u6027'],
        ['V2 \u8ba2\u5355','ORD + YYYYMMDD + 6\u4f4d\u968f\u673a','ORD20260723A1B2C3','\u542b\u968f\u673a\u5b57\u7b26\u4e32\u9632\u78b0\u649e'],
        ['V2 \u5408\u540c','CON + \u65f6\u95f4\u6233 + 3\u4f4d\u968f\u673a','CON1753234567890123','\u7eb3\u79d2\u7ea7\u65f6\u95f4\u6233'],
    ],widths=[2.5*cm,4*cm,4.5*cm,4*cm]))
    story.append(SP(2))

    story.append(H2('7.3  \u6587\u4ef6\u4e0a\u4f20\u4e0e\u8bbf\u95ee\u6d41\u7a0b'))
    story.append(tbl(['\u6b65\u9aa4','\u64cd\u4f5c\u65b9','\u52a8\u4f5c'],[
        ['1','\u5ba2\u6237\u7aef','\u9009\u62e9\u6587\u4ef6\uff0c\u53d1\u8d77 POST /api/storage/upload\uff08multipart/form-data\uff09'],
        ['2','\u540e\u7aef','multer \u63a5\u6536\u5185\u5b58\u6d41\uff0c\u6821\u9a8c MIME \u7c7b\u578b\u4e0e\u6587\u4ef6\u6269\u5c55\u540d\u767d\u540d\u5355'],
        ['3','\u540e\u7aef','\u751f\u6210 UUID \u4f5c\u4e3a\u6587\u4ef6\u540d\uff1auploads/{uuid}.{ext}'],
        ['4','\u540e\u7aef','\u8c03\u7528 GCS SDK \u5c06\u6587\u4ef6\u6d41\u5199\u5165\u79c1\u6709\u6876'],
        ['5','\u540e\u7aef','\u8fd4\u56de { key: "uploads/xxx.pdf" }\uff08\u4e0d\u542b\u516c\u5f00 URL\uff09'],
        ['6','\u5ba2\u6237\u7aef','\u5c06 key \u5b58\u50a8\u4e8e\u8868\u5355\u5b57\u6bb5\uff08\u5982 attachments JSONB \u6570\u7ec4\uff09\u63d0\u4ea4\u4e1a\u52a1\u63a5\u53e3'],
        ['7','\u5ba2\u6237\u7aef','\u5c55\u793a\u65f6\u8c03\u7528 GET /api/storage/objects/{key}'],
        ['8','\u540e\u7aef','\u751f\u6210\u65f6\u6548\u6027\u9884\u7b7e\u540d URL\uff08GCS SignedURL\uff0c\u6709\u6548\u671f 15 \u5206\u949f\uff09\uff0c\u8fd4\u56de\u7ed9\u5ba2\u6237\u7aef'],
        ['9','\u5ba2\u6237\u7aef','\u4f7f\u7528\u9884\u7b7e\u540d URL \u76f4\u63a5\u8bbf\u95ee GCS \u6587\u4ef6\uff08\u7ed5\u8fc7\u540e\u7aef\uff0c\u51cf\u5c11\u5e26\u5bbd\u538b\u529b\uff09'],
    ],widths=[0.8*cm,2*cm,12.2*cm]))
    story.append(SP(2))

    story.append(H2('7.4  \u6570\u636e\u5e93\u8fc1\u79fb\u673a\u5236'))
    story.append(tbl(['\u6b65\u9aa4','\u64cd\u4f5c'],[
        ['1. \u8fc1\u79fb\u8bb0\u5f55\u8868', 'schema_migrations \u8868\u8bb0\u5f55\u5df2\u6267\u884c\u7684\u8fc1\u79fb ID'],
        ['2. once() \u5c01\u88c5', '\u6bcf\u6761\u8fc1\u79fb\u7528 once(id, async()=>{...}) \u5305\u88f9\uff0c\u6267\u884c\u524d\u68c0\u67e5 id \u662f\u5426\u5df2\u5728 schema_migrations \u4e2d'],
        ['3. \u9996\u6b21\u6267\u884c', 'ID \u4e0d\u5b58\u5728\u5219\u6267\u884c\u8fc1\u79fb SQL\uff0c\u6267\u884c\u6210\u529f\u540e\u5c06 ID \u5199\u5165 schema_migrations'],
        ['4. \u5e42\u7b49\u4fdd\u62a4', 'ID \u5df2\u5b58\u5728\u5219\u8df3\u8fc7\uff0c\u65e0\u8bba\u670d\u52a1\u91cd\u542f\u591a\u5c11\u6b21\u5747\u53ea\u6267\u884c\u4e00\u6b21'],
        ['5. \u5386\u53f2\u9884\u79cd', '\u9996\u6b21\u90e8\u7f72\u65f6\u81ea\u52a8\u68c0\u6d4b\u5e76\u9884\u5199\u6240\u6709\u5386\u53f2\u8fc1\u79fb ID\uff0c\u9632\u6b62\u8001\u6570\u636e\u5e93\u91cd\u590d\u6267\u884c\u65e7\u8fc1\u79fb'],
    ],widths=[3.5*cm,11.5*cm]))
    story.append(SP(2))

    story.append(H2('7.5  AI \u667a\u80fd\u4f53 ReAct \u5faa\u73af\u7b97\u6cd5'))
    story.append(tbl(['\u9636\u6bb5','\u64cd\u4f5c','\u8bf4\u660e'],[
        ['\u9884\u5904\u7406','\u52a0\u8f7d Skill \u5b9a\u4e49','\u4ece\u6570\u636e\u5e93\u67e5\u8be2 agent_task_skill_links\uff0c\u83b7\u53d6\u5f53\u524d\u4efb\u52a1\u7c7b\u578b\u5bf9\u5e94\u7684 Skill \u5185\u5bb9\uff0c\u6ce8\u5165 System Prompt'],
        ['\u9884\u5904\u7406','\u6062\u590d\u5386\u53f2\u4e0a\u4e0b\u6587','\u4ece historyMessages \u53c2\u6570\u4e2d\u89e3\u6790\u5df2\u6709\u5bf9\u8bdd\u8bb0\u5f55\uff0c\u91cd\u5efa accumulated{} \u7d2f\u52a0\u5668\u72b6\u6001'],
        ['\u63a8\u7406','Reason','\u8c03\u7528 LLM\uff0c\u4f20\u5165 System Prompt + \u5bf9\u8bdd\u5386\u53f2 + \u7528\u6237\u6d88\u606f\uff0cLLM \u8f93\u51fa\u63a8\u7406\u8fc7\u7a0b\u4e0e\u5de5\u5177\u8c03\u7528\u610f\u56fe'],
        ['\u884c\u52a8','Action\uff08\u5de5\u5177\u8c03\u7528\uff09','\u89e3\u6790 LLM \u7684 tool_use \u54cd\u5e94\uff0c\u6267\u884c\u5bf9\u5e94\u5de5\u5177\uff08validate_timeline / generate_summary / get_platform_skills \u7b49\uff09'],
        ['\u89c2\u5bdf','Observation','\u5c06\u5de5\u5177\u6267\u884c\u7ed3\u679c\u4f5c\u4e3a tool_result \u6d88\u606f\u8fd4\u56de LLM'],
        ['\u5faa\u73af','\u91cd\u590d Reason\u2192Action','LLM \u6839\u636e\u5de5\u5177\u7ed3\u679c\u7ee7\u7eed\u63a8\u7406\uff0c\u76f4\u81f3\u751f\u6210\u6700\u7ec8\u56de\u590d\uff08stop_reason = end_turn\uff09'],
        ['\u8f93\u51fa','\u6d41\u5f0f\u54cd\u5e94','\u901a\u8fc7 Server-Sent Events\uff08SSE\uff09\u5c06 LLM \u751f\u6210\u5185\u5bb9\u5b9e\u65f6\u63a8\u9001\u7ed9\u524d\u7aef'],
    ],widths=[2*cm,3.5*cm,9.5*cm]))
    story.append(SP(2))

    # Footer
    story.append(HR())
    story.append(H2('\u7248\u672c\u4fee\u8ba2\u8bb0\u5f55'))
    story.append(tbl(['\u7248\u672c\u53f7','\u65e5\u671f','\u4fee\u8ba2\u5185\u5bb9'],[
        ['V1.0', today, '\u521d\u59cb\u7248\u672c\uff0c\u8f6f\u4ef6\u8457\u4f5c\u6743\u7533\u8bf7'],
    ],widths=[2.5*cm,3.5*cm,9*cm]))
    story.append(SP(2))
    story.append(Paragraph('\u672c\u6587\u6863\u4f9d\u636e GB/T 8567-2006 \u7f16\u5236\uff0c\u4f5c\u4e3a\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0\u8f6f\u4ef6\u8457\u4f5c\u6743\u7533\u8bf7\u6280\u672f\u6750\u6599\u3002', S['foot']))

    doc = SimpleDocTemplate(OUT, pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=2.2*cm, bottomMargin=2.0*cm,
        title='\u63a5\u5355\u5427 OPC\u64ae\u5408\u4ea4\u6613\u5e73\u53f0 \u8f6f\u4ef6\u8bbe\u8ba1\u8bf4\u660e\u4e66',
        author='\u63a5\u5355\u5427\u5e73\u53f0',
        subject='\u8f6f\u4ef6\u8457\u4f5c\u6743\u7533\u8bf7\u6750\u6599')
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    sz = os.path.getsize(OUT)
    print('\u2705 PDF\uff1a%s' % OUT)
    print('   \u5927\u5c0f\uff1a%.1f KB / %.2f MB' % (sz/1024, sz/1024/1024))

if __name__ == '__main__':
    build()
