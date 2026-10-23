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

from reportlab.lib.enums import TA_CENTER

cover_title = ParagraphStyle(
    name="CoverTitleVN",
    parent=styles["HeadingVN"],
    alignment=TA_CENTER,
    fontSize=20,
    leading=28,
    spaceAfter=18
)

cover_center = ParagraphStyle(
    name="CoverCenterVN",
    parent=styles["BodyVN"],
    alignment=TA_CENTER,
    fontSize=12,
    leading=20,
    spaceAfter=10
)

cover_bold = ParagraphStyle(
    name="CoverBoldVN",
    parent=cover_center,
    fontName="ArialVNBold"
)

story.append(Spacer(1, 35))
story.append(Paragraph(
    "TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG THÁI NGUYÊN",
    cover_bold
))
story.append(Paragraph(
    "KHOA CÔNG NGHỆ THÔNG TIN",
    cover_bold
))
story.append(Spacer(1, 85))
story.append(Paragraph("BÁO CÁO ĐỒ ÁN", cover_title))
story.append(Paragraph(
    "TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG PHẦN MỀM",
    cover_bold
))
story.append(Spacer(1, 30))
story.append(Paragraph(
    "ĐỀ TÀI: HỆ THỐNG QUẢN LÝ CÂU LẠC BỘ",
    cover_title
))
story.append(Paragraph(
    "CLUB MANAGEMENT",
    cover_bold
))
story.append(Spacer(1, 60))
story.append(Paragraph(
    "Sinh viên thực hiện: Nguyễn Văn Kiên",
    cover_center
))
story.append(Paragraph(
    "Mã số sinh viên: DTC245200238",
    cover_center
))
story.append(Paragraph(
    "Lớp: CNTT K23B",
    cover_center
))
story.append(Paragraph(
    "Giảng viên hướng dẫn: ................................",
    cover_center
))
story.append(Spacer(1, 75))
story.append(Paragraph("Thái Nguyên, năm 2026", cover_center))
story.append(PageBreak())

draft = ['# Báo cáo đồ án Club Management', '', 'Báo cáo tổng hợp kết quả phát triển, kiểm thử và triển khai Ubuntu. Các bằng chứng lịch sử Windows được phân biệt với kết quả vận hành Ubuntu.', '']
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
                nodes = [(0,205,'Trình duyệt'),(170,205,'Nginx club.local'),(340,205,'Express backend'),(0,115,'Grafana'),(170,115,'Prometheus'),(340,115,'MySQL 8.4'),(0,25,'Loki'),(170,25,'Promtail / Club logs'),(340,25,'Host + exporters')]
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

story.append(PageBreak())
story.append(Paragraph(
    "14 / Kết quả triển khai thực tế trên Ubuntu",
    styles["HeadingVN"]
))

ubuntu_evidence = [
    (
        "Môi trường triển khai",
        "Ứng dụng Club Management vận hành trên máy ảo Ubuntu VMware. "
        "Backend Express, MySQL và phpMyAdmin được duy trì trong Docker. "
        "Host Nginx phục vụ club.local. Không thay đổi dịch vụ demo.local."
    ),
    (
        "Prometheus",
        "Đã kiểm chứng 6/6 monitoring targets ở trạng thái UP. "
        "Prometheus được truy cập qua loopback tại 127.0.0.1:9090."
    ),
    (
        "Grafana",
        "Grafana phiên bản 12.2.0 trả HTTP 200 tại 127.0.0.1:3001. "
        "Dashboard Club Management có 12 panels, sử dụng Prometheus và Loki."
    ),
    (
        "Loki và Promtail",
        "Loki phiên bản 3.5.0 trả HTTP 200 tại endpoint /ready, "
        "với cấu hình retention 72 giờ. Promtail phiên bản 3.5.0 "
        "thu thập log Backend và log Nginx dành riêng cho Club Management."
    ),
    (
        "Kiểm chứng LogQL",
        "Truy vấn service=backend trả về 10 dòng log trong lần kiểm tra. "
        "Truy vấn service=nginx, stream=access trả về 5 dòng log. "
        "Các kết quả này phản ánh thời điểm kiểm chứng, không phải cam kết "
        "số lượng log cố định."
    ),
    (
        "Thu thập log Backend",
        "Dịch vụ systemd club-log-forwarder.service đã được kiểm chứng active. "
        "Log Backend được chuyển đến /var/log/club/backend/backend.log. "
        "Có cấu hình logrotate và quản lý quyền truy cập file log."
    ),
    (
        "GitHub",
        "Commit ae7c1bb - feat(ops): complete Loki Promtail logging deployment "
        "đã được push thành công lên nhánh main của repository "
        "Kenz2603/club-management. Working tree sạch sau khi push."
    ),
    (
        "Giới hạn nghiệm thu",
        "Các kết quả trên là bằng chứng vận hành Ubuntu đã kiểm tra. "
        "Không mặc định đánh dấu PASS cho HTTPS, firewall, kiểm tra CVE, "
        "backup/restore dữ liệu thật hoặc những hạng mục chưa có "
        "biên bản kiểm chứng riêng."
    )
]

for heading, body in ubuntu_evidence:
    story.append(Paragraph(heading, styles["SubVN"]))
    story.append(Paragraph(body, styles["BodyVN"]))

for title, file, width, height in [('Minh chứng desktop từ Chromium trên Windows','e2e-desktop.png',495,310),('Minh chứng mobile từ Chromium trên Windows','e2e-mobile.png',270,585)]:
    image = root / 'artifacts' / file
    if image.exists():
        story += [PageBreak(), Paragraph(title, styles['HeadingVN']), Paragraph('Dữ liệu test được tạo trên MySQL cách ly. Không phải ảnh production hoặc minh chứng Ubuntu.', styles['BodyVN']), Image(str(image),width=width,height=height,kind='proportional')]
draft += [
    '## 14. Kết quả triển khai thực tế trên Ubuntu',
    '',
    'Hệ thống đã được kiểm chứng trên Ubuntu VMware.',
    '',
    '- Prometheus: 6/6 targets UP.',
    '- Grafana 12.2.0: HTTP 200, dashboard 12 panels.',
    '- Loki 3.5.0: /ready HTTP 200, retention 72 giờ.',
    '- Promtail 3.5.0: thu thập log Backend và Nginx.',
    '- LogQL: truy vấn Backend và Nginx có dữ liệu thực tế.',
    '- Backend log forwarder: systemd active.',
    '- GitHub: commit ae7c1bb đã push lên main.',
    '',
    '### Phân biệt thiết kế và triển khai',
    '',
    'Tài liệu lịch sử mô tả Alloy là phương án thu thập log.',
    'Môi trường Ubuntu đã triển khai thực tế sử dụng Promtail.',
    'Promtail đã hết vòng đời hỗ trợ; cần lập kế hoạch chuyển sang Alloy.',
    '',
    '### Các nội dung chưa nghiệm thu',
    '',
    'Chưa đánh dấu PASS cho HTTPS, firewall, kiểm tra CVE và',
    'backup/restore dữ liệu production khi chưa có bằng chứng riêng.',
    ''
]
(root/'docs/REPORT_FINAL.md').write_text(
    '\n'.join(draft).rstrip()+'\n',
    encoding='utf-8'
)
def footer(canvas, doc):
    canvas.setFont('ArialVN',8)
    canvas.setFillColor(colors.HexColor('#64748b'))
    canvas.drawString(50,25,'CLUB MANAGEMENT | BÁO CÁO ĐỒ ÁN | 2026')
    canvas.drawRightString(A4[0]-50,25,str(doc.page))
    canvas.line(50,40,A4[0]-50,40)
doc=SimpleDocTemplate(str(output/'Club_Management_Report_Final.pdf'),pagesize=A4,rightMargin=50,leftMargin=50,topMargin=50,bottomMargin=55,title='Club Management - Báo cáo đồ án chính thức',author='Club Management')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print('Report PDF generated')
