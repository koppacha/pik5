from pathlib import Path
import re, html
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
base=Path(__file__).resolve().parents[2]
font='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
pdfmetrics.registerFont(TTFont('Japanese',font))
pdfmetrics.registerFont(TTFont('JapaneseBold',font))
pdfmetrics.registerFontFamily('Japanese',normal='Japanese',bold='JapaneseBold',italic='Japanese',boldItalic='JapaneseBold')
styles={
    'body':ParagraphStyle('body',fontName='Japanese',fontSize=10,leading=16.5,spaceAfter=8,wordWrap='CJK'),
    'h1':ParagraphStyle('h1',fontName='Japanese',fontSize=20,leading=28,spaceAfter=16,textColor=colors.HexColor('#163047'),wordWrap='CJK',keepWithNext=True),
    'h2':ParagraphStyle('h2',fontName='Japanese',fontSize=14,leading=21,spaceBefore=16,spaceAfter=10,textColor=colors.HexColor('#163047'),wordWrap='CJK',keepWithNext=True),
    'h3':ParagraphStyle('h3',fontName='Japanese',fontSize=11.5,leading=18,spaceBefore=10,spaceAfter=7,textColor=colors.HexColor('#163047'),wordWrap='CJK',keepWithNext=True),
    'cell':ParagraphStyle('cell',fontName='Japanese',fontSize=9,leading=14,wordWrap='CJK'),
    'header':ParagraphStyle('header',fontName='Japanese',fontSize=9,leading=14,textColor=colors.white,wordWrap='CJK'),
}
def inline(t):
    t=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',t)
    t=html.escape(t)
    t=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
    return re.sub(r'`([^`]+)`',r'\1',t)
lines=(base.parents[1]/'keyword/tricks-manual.md').read_text().splitlines()
story=[]; i=0
width=A4[0]-84
while i<len(lines):
    line=lines[i]
    if not line.strip(): i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            raw=[c.strip() for c in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?',c) for c in raw): rows.append(raw)
            i+=1
        count=len(rows[0]);assert all(len(row)==count for row in rows)
        proportions={2:[.30,.70],3:[.40,.30,.30],4:[.40,.15,.23,.22]}.get(count,[1/count]*count)
        table=Table([[Paragraph(inline(c),styles['header' if idx==0 else 'cell']) for c in row] for idx,row in enumerate(rows)],colWidths=[width*s for s in proportions],repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#29475f')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f0f4f7'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#29475f')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#c9d3dc')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        story.extend([table,Spacer(1,9)]);continue
    m=re.match(r'^(#{1,3}) (.+)',line)
    if m:story.append(Paragraph(inline(m[2]),styles['h'+str(len(m[1]))]))
    else:story.append(KeepTogether([Paragraph(inline(line),styles['body'])]))
    i+=1
def furniture(canvas,doc):
    canvas.saveState();canvas.setFont('Japanese',8);canvas.setFillColor(colors.HexColor('#536779'))
    canvas.drawString(42,A4[1]-27,'トリックテイキング制  |  ユーザーマニュアル')
    canvas.drawRightString(A4[0]-42,25,str(doc.page))
    canvas.restoreState()
output=base/'output/pdf/tricks-manual-20261007.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
doc=SimpleDocTemplate(str(output),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=48,bottomMargin=42,title='トリックテイキング制 ユーザーマニュアル',author='PIK5',pageCompression=1)
doc.build(story,onFirstPage=furniture,onLaterPages=furniture)
print(str(output))
