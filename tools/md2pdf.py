# -*- coding: utf-8 -*-
"""Render a simple Markdown plan (headings, paragraphs, bullets, pipe tables) to PDF."""
import re, sys, math
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, CondPageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

# Usage: pip install reportlab   then   python tools/md2pdf.py Ummah_One_Plan.md Ummah_One_Plan.pdf
SRC, OUT = sys.argv[1], sys.argv[2]
import os
# Font search: Windows Segoe UI first, then DejaVu Sans (Linux/Mac). Both cover Turkish/Bosnian letters.
FONT_SETS = [
    ("C:/Windows/Fonts/", ["segoeui.ttf", "segoeuib.ttf", "segoeuii.ttf", "segoeuiz.ttf"]),
    ("/usr/share/fonts/truetype/dejavu/", ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf", "DejaVuSans-BoldOblique.ttf"]),
    ("/Library/Fonts/", ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf", "DejaVuSans-BoldOblique.ttf"]),
    ("/System/Library/Fonts/Supplemental/", ["Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf", "Arial Bold Italic.ttf"]),  # macOS
]
for folder, files in FONT_SETS:
    if all(os.path.exists(folder + f) for f in files):
        for n, f in zip(["S", "S-B", "S-I", "S-BI"], files):
            pdfmetrics.registerFont(TTFont(n, folder + f))
        break
else:
    sys.exit("No Unicode font found. Install DejaVu Sans or edit FONT_SETS in md2pdf.py.")
addMapping("S", 0, 0, "S"); addMapping("S", 1, 0, "S-B"); addMapping("S", 0, 1, "S-I"); addMapping("S", 1, 1, "S-BI")

AC = colors.HexColor("#0E4D45"); GOLD = colors.HexColor("#B08A3E"); INK = colors.HexColor("#141414")
INK2 = colors.HexColor("#52514e"); RULE = colors.HexColor("#D9DEDC"); ZEB = colors.HexColor("#F6F8F7")
W, H = A4; LM = RM = 42; CW = W - LM - RM
st = {
    "title": ParagraphStyle("t", fontName="S-B", fontSize=20, leading=24, textColor=colors.white),
    "sub": ParagraphStyle("sb", fontName="S", fontSize=9.5, leading=12, textColor=colors.white),
    "h2": ParagraphStyle("h2", fontName="S-B", fontSize=12, leading=15, textColor=AC, spaceBefore=8, spaceAfter=4),
    "p": ParagraphStyle("p", fontName="S", fontSize=9, leading=12.2, textColor=INK, spaceAfter=4),
    "li": ParagraphStyle("li", fontName="S", fontSize=9, leading=12, textColor=INK, leftIndent=11, bulletIndent=1, spaceAfter=1.5),
    "c": ParagraphStyle("c", fontName="S", fontSize=8, leading=10.2, textColor=INK),
    "ch": ParagraphStyle("ch", fontName="S-B", fontSize=8, leading=10.2, textColor=colors.white),
}


def inline(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", t)
    return t


def make_table(rows):
    ncol = len(rows[0])
    # column widths proportional to sqrt of longest text, with a floor
    lens = [max(len(r[i]) if i < len(r) else 0 for r in rows) for i in range(ncol)]
    wts = [max(math.sqrt(l), 2.2) for l in lens]
    widths = [CW * w / sum(wts) for w in wts]
    data = [[Paragraph(inline(c), st["ch"] if ri == 0 else st["c"]) for c in r] for ri, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    s = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
         ("BACKGROUND", (0, 0), (-1, 0), AC),
         ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
         ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    for i in range(2, len(rows), 2):
        s.append(("BACKGROUND", (0, i), (-1, i), ZEB))
    t.setStyle(TableStyle(s))
    return t


lines = open(SRC, encoding="utf-8").read().splitlines()
story, i, title_done = [], 0, False
while i < len(lines):
    ln = lines[i].rstrip()
    if ln.startswith("# ") and not title_done:
        sub = ""
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j < len(lines) and not lines[j].startswith(("#", "|", "-")):
            sub, i = lines[j].strip(), j
        band = Table([[[Paragraph(inline(ln[2:]), st["title"]), Spacer(1, 3), Paragraph(inline(sub), st["sub"])]]],
                     colWidths=[CW])
        band.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), AC), ("LINEBELOW", (0, 0), (-1, -1), 3, GOLD),
                                  ("LEFTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 11),
                                  ("BOTTOMPADDING", (0, 0), (-1, -1), 11)]))
        story += [band, Spacer(1, 6)]
        title_done = True
    elif ln.startswith("## "):
        story += [CondPageBreak(70), Paragraph(inline(ln[3:]), st["h2"])]
    elif ln.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                rows.append(cells)
            i += 1
        story += [make_table(rows), Spacer(1, 5)]
        continue
    elif ln.startswith("- "):
        story.append(Paragraph(inline(ln[2:]), st["li"], bulletText="•"))
    elif ln.strip():
        story.append(Paragraph(inline(ln), st["p"]))
    i += 1


def footer(c, d):
    c.saveState(); c.setFont("S", 7.5); c.setFillColor(INK2)
    c.drawString(LM, 22, "Ummah One · Plan generated from prompt.md")
    c.drawRightString(W - RM, 22, f"Page {d.page}"); c.restoreState()


SimpleDocTemplate(OUT, pagesize=A4, leftMargin=LM, rightMargin=RM, topMargin=36, bottomMargin=36,
                  title="Ummah One — AI Guide Product Plan").build(story, onFirstPage=footer, onLaterPages=footer)
print("built")
