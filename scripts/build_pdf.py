#!/usr/bin/env python3
"""Convert UnderstandMe.md to UnderstandMe.pdf using fpdf2."""

import re
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
MD_FILE = ROOT / "UnderstandMe.md"
PDF_FILE = ROOT / "UnderstandMe.pdf"

PURPLE = (108, 63, 197)
DARK_BLUE = (45, 45, 94)
DARK_TEXT = (26, 26, 46)
GRAY = (100, 100, 100)
LIGHT_BG = (240, 240, 245)
CODE_BG = (30, 30, 46)
CODE_FG = (205, 214, 244)
TABLE_HEADER_BG = PURPLE
TABLE_HEADER_FG = (255, 255, 255)
TABLE_ALT_BG = (248, 248, 252)
MERMAID_BG = (240, 240, 248)
MERMAID_BORDER = PURPLE


class DocPDF(FPDF):
    def __init__(self):
        super().__init__("P", "mm", "A4")
        self.set_auto_page_break(auto=True, margin=25)
        self.set_left_margin(18)
        self.set_right_margin(18)

    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 7)
            self.set_text_color(170, 170, 170)
            self.cell(0, 5, "Phoenix Trade Bot -- Technical Documentation", align="C")
            self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"{self.page_no()} / {{nb}}", align="C")


def strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            text = text[end + 3:].lstrip("\n")
    return text


def strip_style(text: str) -> str:
    return re.sub(r"<style>.*?</style>", "", text, flags=re.DOTALL)


def strip_html_divs(text: str) -> str:
    text = re.sub(r'<div[^>]*class="cover"[^>]*>', "", text)
    text = re.sub(r'<div[^>]*class="page-break"[^>]*>\s*</div>', "<<<PAGE_BREAK>>>", text)
    text = text.replace("</div>", "")
    return text


def parse_md(text: str):
    """Parse markdown into a list of blocks."""
    text = strip_frontmatter(text)
    text = strip_style(text)
    text = strip_html_divs(text)

    blocks = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        if line.strip() == "<<<PAGE_BREAK>>>":
            blocks.append(("pagebreak", ""))
            i += 1
            continue

        if line.strip().startswith("```mermaid"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            blocks.append(("mermaid", "\n".join(code_lines)))
            continue

        if line.strip().startswith("```"):
            lang = line.strip()[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            blocks.append(("code", "\n".join(code_lines)))
            continue

        if line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
            i += 1
            continue

        if line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
            i += 1
            continue

        if line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
            i += 1
            continue

        if line.startswith("#### "):
            blocks.append(("h4", line[5:].strip()))
            i += 1
            continue

        if line.strip().startswith("|") and i + 1 < len(lines) and "|---" in lines[i + 1]:
            table_lines = [line]
            i += 1
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            blocks.append(("table", table_lines))
            continue

        if line.strip() == "---":
            blocks.append(("hr", ""))
            i += 1
            continue

        if line.strip().startswith("- **") or line.strip().startswith("- "):
            list_items = []
            while i < len(lines) and (lines[i].strip().startswith("- ") or lines[i].strip().startswith("* ")):
                list_items.append(lines[i].strip()[2:])
                i += 1
            blocks.append(("list", list_items))
            continue

        if line.strip().startswith("> "):
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith("> "):
                quote_lines.append(lines[i].strip()[2:])
                i += 1
            blocks.append(("quote", "\n".join(quote_lines)))
            continue

        if line.strip():
            para_lines = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not lines[i].startswith("#") and not lines[i].startswith("```") and not lines[i].startswith("|") and not lines[i].startswith("- ") and not lines[i].strip() == "---" and "<<<PAGE_BREAK>>>" not in lines[i]:
                para_lines.append(lines[i])
                i += 1
            blocks.append(("para", " ".join(l.strip() for l in para_lines)))
            continue

        i += 1

    return blocks


def clean_text(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    replacements = {
        "\u2013": "-", "\u2014": "--", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u2022": "-", "\u2026": "...",
        "\u2192": "->", "\u2190": "<-", "\u2194": "<->",
        "\u00a0": " ", "\u200b": "",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    try:
        text.encode("latin-1")
    except UnicodeEncodeError:
        text = text.encode("latin-1", errors="replace").decode("latin-1")
    return text


def render_pdf(blocks):
    pdf = DocPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    usable_w = pdf.w - pdf.l_margin - pdf.r_margin

    # Cover page
    pdf.ln(60)
    pdf.set_font("Helvetica", "B", 36)
    pdf.set_text_color(*PURPLE)
    pdf.cell(0, 18, "Phoenix Trade Bot", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 16)
    pdf.set_text_color(*GRAY)
    pdf.cell(0, 10, "Comprehensive Technical Documentation", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.cell(0, 8, "Version 2.0  |  February 2026", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(12)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, "Enterprise-Grade Automated Trading Platform", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 7, "Discord Signal Ingestion | NLP Parsing | Broker Execution | Real-Time Monitoring", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)
    pdf.set_draw_color(*PURPLE)
    pdf.set_line_width(0.5)
    x_center = pdf.w / 2
    pdf.line(x_center - 40, pdf.get_y(), x_center + 40, pdf.get_y())
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(0, 5,
        "This document covers the complete architecture, feature set, "
        "component internals, and end-to-end process flows of the Phoenix Trade Bot platform.",
        align="C")

    skip_cover = True

    for btype, content in blocks:
        if skip_cover:
            if btype == "h1" and "Table of Contents" in content:
                skip_cover = False
                pdf.add_page()
            elif btype == "h1" and content.startswith("1."):
                skip_cover = False
                pdf.add_page()
            else:
                continue

        if btype == "pagebreak":
            pdf.add_page()
            continue

        if btype == "h1":
            if pdf.get_y() > 50:
                pdf.add_page()
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 20)
            pdf.set_text_color(*PURPLE)
            pdf.multi_cell(0, 9, clean_text(content))
            pdf.set_draw_color(*PURPLE)
            pdf.set_line_width(0.8)
            pdf.line(pdf.l_margin, pdf.get_y() + 1, pdf.l_margin + usable_w, pdf.get_y() + 1)
            pdf.ln(5)
            continue

        if btype == "h2":
            if pdf.get_y() > 240:
                pdf.add_page()
            pdf.ln(6)
            pdf.set_font("Helvetica", "B", 15)
            pdf.set_text_color(*DARK_BLUE)
            pdf.multi_cell(0, 7, clean_text(content))
            pdf.set_draw_color(220, 220, 220)
            pdf.set_line_width(0.3)
            pdf.line(pdf.l_margin, pdf.get_y() + 1, pdf.l_margin + usable_w, pdf.get_y() + 1)
            pdf.ln(4)
            continue

        if btype == "h3":
            if pdf.get_y() > 250:
                pdf.add_page()
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(68, 68, 68)
            pdf.multi_cell(0, 6, clean_text(content))
            pdf.ln(2)
            continue

        if btype == "h4":
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(85, 85, 85)
            pdf.multi_cell(0, 6, clean_text(content))
            pdf.ln(1)
            continue

        if btype == "para":
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*DARK_TEXT)
            pdf.multi_cell(0, 5, clean_text(content))
            pdf.ln(2)
            continue

        if btype == "list":
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*DARK_TEXT)
            for item in content:
                cleaned = clean_text(item)
                x = pdf.l_margin
                pdf.set_x(x + 4)
                pdf.cell(4, 5, "-")
                pdf.set_x(x + 10)
                pdf.multi_cell(usable_w - 12, 5, cleaned)
                pdf.ln(1)
            pdf.ln(2)
            continue

        if btype == "quote":
            pdf.set_draw_color(*PURPLE)
            pdf.set_line_width(1)
            y_start = pdf.get_y()
            pdf.set_x(pdf.l_margin + 6)
            pdf.set_font("Helvetica", "I", 10)
            pdf.set_text_color(85, 85, 85)
            pdf.multi_cell(usable_w - 8, 5, clean_text(content))
            y_end = pdf.get_y()
            pdf.line(pdf.l_margin + 2, y_start, pdf.l_margin + 2, y_end)
            pdf.ln(3)
            continue

        if btype == "code":
            pdf.ln(2)
            pdf.set_fill_color(*CODE_BG)
            pdf.set_font("Courier", "", 8)
            pdf.set_text_color(*CODE_FG)
            code_text = clean_text(content)
            code_lines = code_text.split("\n")
            for cl in code_lines:
                if pdf.get_y() > 270:
                    pdf.add_page()
                    pdf.set_fill_color(*CODE_BG)
                    pdf.set_font("Courier", "", 8)
                    pdf.set_text_color(*CODE_FG)
                safe = cl[:120] if len(cl) > 120 else cl
                pdf.cell(usable_w, 4, f"  {safe}", fill=True, new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*DARK_TEXT)
            pdf.ln(3)
            continue

        if btype == "mermaid":
            pdf.ln(2)
            pdf.set_fill_color(*MERMAID_BG)
            pdf.set_draw_color(*MERMAID_BORDER)
            pdf.set_line_width(0.5)

            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*PURPLE)
            y0 = pdf.get_y()
            pdf.rect(pdf.l_margin, y0, usable_w, 6, style="DF")
            pdf.set_xy(pdf.l_margin + 4, y0)
            pdf.cell(0, 6, "Diagram (Mermaid)")

            pdf.set_font("Courier", "", 7.5)
            pdf.set_text_color(60, 60, 80)
            diagram_lines = content.strip().split("\n")
            pdf.set_y(y0 + 6)
            for dl in diagram_lines:
                if pdf.get_y() > 270:
                    pdf.add_page()
                    pdf.set_fill_color(*MERMAID_BG)
                    pdf.set_font("Courier", "", 7.5)
                    pdf.set_text_color(60, 60, 80)
                safe = dl[:130] if len(dl) > 130 else dl
                pdf.set_x(pdf.l_margin)
                pdf.cell(usable_w, 3.8, f"  {safe}", fill=True, new_x="LMARGIN", new_y="NEXT")

            y_end = pdf.get_y()
            pdf.rect(pdf.l_margin, y0, usable_w, y_end - y0, style="D")
            pdf.set_text_color(*DARK_TEXT)
            pdf.ln(4)
            continue

        if btype == "table":
            rows = []
            for tl in content:
                cells = [c.strip() for c in tl.strip().strip("|").split("|")]
                rows.append(cells)
            if len(rows) < 2:
                continue
            header = rows[0]
            separator_idx = 1
            data_rows = rows[separator_idx + 1:]

            num_cols = len(header)
            if num_cols == 0:
                continue

            col_w = usable_w / num_cols

            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_fill_color(*TABLE_HEADER_BG)
            pdf.set_text_color(*TABLE_HEADER_FG)
            for ci, h in enumerate(header):
                w = col_w
                pdf.cell(w, 6, clean_text(h)[:30], border=1, fill=True)
            pdf.ln()

            pdf.set_font("Helvetica", "", 8)
            for ri, row in enumerate(data_rows):
                if pdf.get_y() > 265:
                    pdf.add_page()
                    pdf.set_font("Helvetica", "B", 8.5)
                    pdf.set_fill_color(*TABLE_HEADER_BG)
                    pdf.set_text_color(*TABLE_HEADER_FG)
                    for h in header:
                        pdf.cell(col_w, 6, clean_text(h)[:30], border=1, fill=True)
                    pdf.ln()
                    pdf.set_font("Helvetica", "", 8)

                if ri % 2 == 1:
                    pdf.set_fill_color(*TABLE_ALT_BG)
                    fill = True
                else:
                    pdf.set_fill_color(255, 255, 255)
                    fill = True

                pdf.set_text_color(*DARK_TEXT)
                for ci in range(num_cols):
                    val = clean_text(row[ci]) if ci < len(row) else ""
                    pdf.cell(col_w, 5.5, val[:40], border=1, fill=fill)
                pdf.ln()

            pdf.ln(3)
            continue

        if btype == "hr":
            pdf.ln(3)
            pdf.set_draw_color(200, 200, 200)
            pdf.set_line_width(0.3)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + usable_w, pdf.get_y())
            pdf.ln(3)
            continue

    pdf.output(str(PDF_FILE))
    size_mb = PDF_FILE.stat().st_size / (1024 * 1024)
    print(f"PDF generated: {PDF_FILE} ({size_mb:.1f} MB, {pdf.page_no()} pages)")


def main():
    raw = MD_FILE.read_text(encoding="utf-8")
    blocks = parse_md(raw)
    print(f"Parsed {len(blocks)} blocks from {MD_FILE.name}")
    render_pdf(blocks)


if __name__ == "__main__":
    main()
