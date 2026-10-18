from pathlib import Path
import re
import textwrap
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, Image
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
import math

root = Path(__file__).resolve().parents[1]
output = root / 'output/pdf'
output.mkdir(parents=True, exist_ok=True)
font = 'C:/Windows/Fonts/arial.ttf' if Path('C:/Windows/Fonts/arial.ttf').exists() else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font_bold = 'C:/Windows/Fonts/arialbd.ttf' if Path('C:/Windows/Fonts/arialbd.ttf').exists() else '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('ArialVN', font))
pdfmetrics.registerFont(TTFont('ArialVNBold', font_bold))
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyVN', fontName='ArialVN', fontSize=10, leading=13, spaceAfter=5))
styles.add(ParagraphStyle(name='HeadingVN', fontName='ArialVNBold', fontSize=21, leading=27, textColor=colors.HexColor('#164e63'), spaceAfter=16))
styles.add(ParagraphStyle(name='SubVN', fontName='ArialVNBold', fontSize=12, leading=17, spaceBefore=12, spaceAfter=8, keepWithNext=True))
styles.add(ParagraphStyle(name='CellVN', fontName='ArialVN', fontSize=8, leading=11))
styles.add(ParagraphStyle(name='CodeVN', fontName='ArialVN', fontSize=7, leading=10, backColor=colors.HexColor('#f1f5f9'), borderPadding=5, spaceAfter=9))
chapters = [
 ('Giới thiệu đề tài và phạm vi', 'REPORT_INTRO.md'),
 ('Phân tích hiện trạng và yêu cầu', 'PROJECT_AUDIT.md'),
 ('Kiến trúc và công nghệ sử dụng', 'ARCHITECTURE.md'),
 ('Thiết kế dữ liệu và migration', 'DATABASE.md'),
 ('Thiết kế API và phân quyền', 'API.md'),
 ('Giao diện và hướng dẫn sử dụng', 'USER_GUIDE.md'),
 ('Docker, Nginx và HTTPS', 'DEPLOYMENT.md'),
 ('Monitoring và logging tập trung', 'OBSERVABILITY.md'),
 ('Security hardening', 'SECURITY_CHECKLIST.md'),
 ('Backup, restore và vận hành', 'BACKUP_RESTORE.md'),
 ('Thiết kế kiểm thử', 'TESTING.md'),
 ('Kết quả thực nghiệm và giới hạn', 'TEST_RESULTS.md'),
 ('Kết luận và hướng phát triển', 'REPORT_CONCLUSION.md')
]
def plain(text):
    text = re.sub(r'\[([^]]+)\]\(([^)]+)\)', r'\1 (\2)', text)
    return escape(text.replace('**', '').replace('`', '').replace('–', '-').replace('—', '-').replace('‑', '-'))

story = []
draft = ['# Bản thảo báo cáo đồ án Club Management', '', 'Ngày 2026-10-19. Bản thảo có bằng chứng Windows; không phải biên bản nghiệm thu Ubuntu.', '']
for number, (title, file) in enumerate(chapters, 1):
    if number > 1:
        story.append(PageBreak())
    story.append(Paragraph(f'{number:02d} / {escape(title)}', styles['HeadingVN']))
    source = (root / 'docs' / file).read_text(encoding='utf-8')
    draft += ['## ' + str(number) + '. ' + title, '', source, '']
    lines = source.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith('```'):
            is_mermaid = line == '```mermaid'
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block += textwrap.wrap(lines[i], 100, replace_whitespace=False, drop_whitespace=False) or ['']
                i += 1
            if is_mermaid:
                drawing = Drawing(495,260)
                nodes = [(0,205,'Trình duyệt'),(170,205,'Nginx club.local'),(340,205,'Express backend'),(0,115,'Grafana'),(170,115,'Prometheus'),(340,115,'MySQL 8.4'),(0,25,'Loki'),(170,25,'Alloy / Club logs'),(340,25,'Host + exporters')]
                for x,y,label in nodes:
                    drawing.add(Rect(x,y,135,40,rx=5,ry=5,fillColor=colors.HexColor('#e0f2fe'),strokeColor=colors.HexColor('#164e63')))
                    drawing.add(String(x+67.5,y+16,label,textAnchor='middle',fontName='ArialVN',fontSize=10,fillColor=colors.HexColor('#164e63')))
                for x1,y1,x2,y2 in [(135,225,170,225),(305,225,340,225),(407,205,407,155),(135,135,170,135),(67,115,67,65),(170,45,135,45),(237,155,370,205),(305,115,370,65)]:
                    drawing.add(Line(x1,y1,x2,y2,strokeColor=colors.HexColor('#64748b')))
                    angle=math.atan2(y2-y1,x2-x1)
                    points=[x2,y2,x2-7*math.cos(angle-.4),y2-7*math.sin(angle-.4),x2-7*math.cos(angle+.4),y2-7*math.sin(angle+.4)]
                    drawing.add(Polygon(points,fillColor=colors.HexColor('#64748b'),strokeColor=None))
                story.append(drawing)
            else:
                story.append(Preformatted('\n'.join(block), styles['CodeVN']))
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [cell.strip() for cell in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[: -]+', cell) for cell in cells):
                    rows.append([Paragraph(plain(cell), styles['CellVN']) for cell in cells])
                i += 1
            if rows:
                columns = max(len(row) for row in rows)
                rows = [row + [''] * (columns - len(row)) for row in rows]
                table = Table(rows, colWidths=[495 / columns] * columns, repeatRows=1, hAlign='LEFT')
                table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e0f2fe')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#cbd5e1')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
                story += [table, Spacer(1,10)]
            continue
        elif line.startswith('#'):
            if not line.startswith('# '):
                story.append(Paragraph(plain(line.lstrip('# ')), styles['SubVN']))
        else:
            paragraph = [line]
            while i + 1 < len(lines) and lines[i+1].strip() and not lines[i+1].lstrip().startswith(('#','```','|','- ')):
                i += 1
                paragraph.append(lines[i].strip())
            story.append(Paragraph(plain(' '.join(paragraph)), styles['BodyVN']))
        i += 1
for title, file, width, height in [('Minh chứng desktop từ Chromium trên Windows','e2e-desktop.png',495,310),('Minh chứng mobile từ Chromium trên Windows','e2e-mobile.png',270,585)]:
    image = root / 'artifacts' / file
    if image.exists():
        story += [PageBreak(), Paragraph(title, styles['HeadingVN']), Paragraph('Dữ liệu test được tạo trên MySQL cách ly. Không phải ảnh production hoặc minh chứng Ubuntu.', styles['BodyVN']), Image(str(image),width=width,height=height,kind='proportional')]
(root/'docs/REPORT_DRAFT.md').write_text('\n'.join(draft).rstrip()+'\n',encoding='utf-8')
def footer(canvas, doc):
    canvas.setFont('ArialVN',8)
    canvas.setFillColor(colors.HexColor('#64748b'))
    canvas.drawString(50,25,'CLUB MANAGEMENT | BẢN THẢO | 2026-10-19')
    canvas.drawRightString(A4[0]-50,25,str(doc.page))
    canvas.line(50,40,A4[0]-50,40)
doc=SimpleDocTemplate(str(output/'Club_Management_Report_Draft.pdf'),pagesize=A4,rightMargin=50,leftMargin=50,topMargin=50,bottomMargin=55,title='Club Management - Bản thảo báo cáo đồ án',author='Club Management')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print('Report PDF generated')
