#!/usr/bin/env python3
"""
PDF → EPUB Conversion Experiment
=================================
Runs multiple extraction/packaging approaches against a liturgical PDF
and produces Markdown + EPUB for each so results can be compared in a PR.
Usage:
    python experiments/pdf-to-epub/run_experiment.py
    python experiments/pdf-to-epub/run_experiment.py --only A
    python experiments/pdf-to-epub/run_experiment.py --pdf path/to/other.pdf
"""
import argparse
import os
import shutil
import subprocess
import sys
import textwrap
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEFAULT_PDF = "public/assets/1662/1662-daily-office-lectionary-ivp.pdf"
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR / "output"
TITLE = "Daily Office Lectionary (1662 BCP)"
AUTHOR = "Anglican Wiki"
# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)
    return p
def write_text(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    print(f"  ✓ wrote {path.relative_to(SCRIPT_DIR)}")
def md_to_epub_via_pandoc(md_path: Path, epub_path: Path, title: str = TITLE):
    """Convert a Markdown file to EPUB using pandoc."""
    cmd = [
        "pandoc", str(md_path),
        "-o", str(epub_path),
        "--metadata", f"title={title}",
        "--metadata", f"author={AUTHOR}",
        "--toc",
        "--toc-depth=2",
        "--epub-chapter-level=1",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ⚠ pandoc error: {result.stderr.strip()}")
        return False
    print(f"  ✓ wrote {epub_path.relative_to(SCRIPT_DIR)}")
    return True
def html_to_epub_via_pandoc(html_path: Path, epub_path: Path, title: str = TITLE):
    """Convert an HTML file to EPUB using pandoc."""
    cmd = [
        "pandoc", str(html_path),
        "-f", "html",
        "-o", str(epub_path),
        "--metadata", f"title={title}",
        "--metadata", f"author={AUTHOR}",
        "--toc",
        "--toc-depth=2",
        "--epub-chapter-level=1",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ⚠ pandoc error: {result.stderr.strip()}")
        return False
    print(f"  ✓ wrote {epub_path.relative_to(SCRIPT_DIR)}")
    return True
def build_epub_manually(xhtml_content: str, epub_path: Path, title: str = TITLE):
    """
    Build a valid EPUB 3 file from scratch using zipfile.
    This gives full control over the XHTML/CSS — no pandoc involved.
    """
    book_id = str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    # Liturgical CSS
    css = textwrap.dedent("""\
        body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; margin: 1em; }
        h1, h2, h3 { font-family: Georgia, serif; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #999; padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: bold; }
        .rubric { color: #c00; font-style: italic; }
        .response { font-weight: bold; }
        pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 0.95em; }
    """)
    container_xml = '<?xml version="1.0" encoding="UTF-8"?>\n' \
        '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' \
        '  <rootfiles>\n' \
        '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' \
        '  </rootfiles>\n' \
        '</container>'
    content_opf = textwrap.dedent(f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:identifier id="BookId">urn:uuid:{book_id}</dc:identifier>
            <dc:title>{title}</dc:title>
            <dc:creator>{AUTHOR}</dc:creator>
            <dc:language>en</dc:language>
            <meta property="dcterms:modified">{now}</meta>
          </metadata>
          <manifest>
            <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
            <item id="style" href="style.css" media-type="text/css"/>
            <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          </manifest>
          <spine>
            <itemref idref="content"/>
          </spine>
        </package>
    """)
    nav_xhtml = textwrap.dedent(f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <head><title>{title}</title></head>
        <body>
          <nav epub:type="toc">
            <h1>Table of Contents</h1>
            <ol><li><a href="content.xhtml">{title}</a></li></ol>
          </nav>
        </body>
        </html>
    """)
    content_xhtml = textwrap.dedent(f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <title>{title}</title>
          <link rel="stylesheet" type="text/css" href="style.css"/>
        </head>
        <body>
        {xhtml_content}
        </body>
        </html>
    """)
    with zipfile.ZipFile(epub_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # mimetype must be first and uncompressed
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr("META-INF/container.xml", container_xml)
        zf.writestr("OEBPS/content.opf", content_opf)
        zf.writestr("OEBPS/nav.xhtml", nav_xhtml)
        zf.writestr("OEBPS/style.css", css)
        zf.writestr("OEBPS/content.xhtml", content_xhtml)
    print(f"  ✓ wrote {epub_path.relative_to(SCRIPT_DIR)} (manual EPUB3)")
    return True
def snippet(text: str, lines: int = 20) -> str:
    """First N lines for the comparison report."""
    return "\n".join(text.splitlines()[:lines])
# ---------------------------------------------------------------------------
# Approach A: pdfplumber
# ---------------------------------------------------------------------------
def approach_a_pdfplumber(pdf_path: Path, out: Path):
    """
    pdfplumber excels at table extraction. We extract text page-by-page,
    detect tables separately, and render them as Markdown tables.
    """
    import pdfplumber
    ensure_dir(out)
    sections = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            page_lines = [f"\n## Page {i + 1}\n"]
            # Try table extraction first
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    if not table or not table[0]:
                        continue
                    # Build Markdown table
                    header = table[0]
                    md_table = "| " + " | ".join(str(c or "") for c in header) + " |\n"
                    md_table += "| " + " | ".join("---" for _ in header) + " |\n"
                    for row in table[1:]:
                        md_table += "| " + " | ".join(str(c or "") for c in row) + " |\n"
                    page_lines.append(md_table)
            else:
                # Fall back to plain text
                text = page.extract_text()
                if text:
                    page_lines.append(text)
            sections.append("\n".join(page_lines))
    md_content = f"# {TITLE}\n\n" + "\n".join(sections)
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    md_to_epub_via_pandoc(md_path, out / "lectionary.epub")
    return md_content
# ---------------------------------------------------------------------------
# Approach B: pdfminer.six with LAParams
# ---------------------------------------------------------------------------
def approach_b_pdfminer(pdf_path: Path, out: Path):
    """
    pdfminer.six gives low-level access to character positions and font info.
    We use LAParams to control layout analysis — useful for detecting columns
    and preserving reading order in lectionary tables.
    """
    from pdfminer.high_level import extract_text
    from pdfminer.layout import LAParams
    ensure_dir(out)
    # Tuned params: boxes_flow=None lets pdfminer auto-detect columns
    laparams = LAParams(
        line_margin=0.5,
        word_margin=0.1,
        char_margin=2.0,
        boxes_flow=0.5,
        detect_vertical=False,
    )
    text = extract_text(str(pdf_path), laparams=laparams)
    md_content = f"# {TITLE}\n\n```\n{text}\n```\n"
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    md_to_epub_via_pandoc(md_path, out / "lectionary.epub")
    return md_content
# ---------------------------------------------------------------------------
# Approach C: pypdfium2
# ---------------------------------------------------------------------------
def approach_c_pypdfium2(pdf_path: Path, out: Path):
    """
    pypdfium2 wraps Chrome's PDFium engine. Fast, accurate glyph mapping,
    good Unicode support. Extracts plain text per page.
    """
    import pypdfium2 as pdfium
    ensure_dir(out)
    pdf = pdfium.PdfDocument(str(pdf_path))
    sections = []
    for i in range(len(pdf)):
        page = pdf[i]
        textpage = page.get_textpage()
        text = textpage.get_text_range()
        sections.append(f"## Page {i + 1}\n\n{text}")
        textpage.close()
        page.close()
    pdf.close()
    md_content = f"# {TITLE}\n\n" + "\n\n".join(sections)
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    md_to_epub_via_pandoc(md_path, out / "lectionary.epub")
    return md_content
# ---------------------------------------------------------------------------
# Approach D: pdftotext -layout (poppler)
# ---------------------------------------------------------------------------
def approach_d_pdftotext(pdf_path: Path, out: Path):
    """
    poppler's pdftotext with -layout flag preserves spatial positioning.
    Good baseline for fixed-layout documents like lectionaries.
    We wrap the output in a code fence to preserve whitespace in Markdown.
    """
    ensure_dir(out)
    # Layout mode
    result = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        capture_output=True, text=True,
    )
    layout_text = result.stdout
    # Also grab raw mode for comparison
    result_raw = subprocess.run(
        ["pdftotext", str(pdf_path), "-"],
        capture_output=True, text=True,
    )
    raw_text = result_raw.stdout
    md_content = f"# {TITLE}\n\n"
    md_content += "## Layout-Preserved Extraction\n\n"
    md_content += f"```\n{layout_text}\n```\n\n"
    md_content += "## Raw Text Extraction\n\n"
    md_content += raw_text
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    # For the EPUB, use the raw text (code fences don't render well)
    epub_md = f"# {TITLE}\n\n{raw_text}"
    epub_md_path = out / "_epub_source.md"
    write_text(epub_md_path, epub_md)
    md_to_epub_via_pandoc(epub_md_path, out / "lectionary.epub")
    return md_content
# ---------------------------------------------------------------------------
# Approach E: pandoc direct (PDF → EPUB)
# ---------------------------------------------------------------------------
def approach_e_pandoc_direct(pdf_path: Path, out: Path):
    """
    Pandoc baseline: pdftotext extracts text, then pandoc converts to EPUB
    in a single pipeline. This is the simplest two-step approach.
    (Note: pandoc ≥3.x no longer accepts PDF as direct input.)
    """
    ensure_dir(out)
    # Step 1: extract text via pdftotext
    result = subprocess.run(
        ["pdftotext", str(pdf_path), "-"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  ⚠ pdftotext error: {result.stderr.strip()}")
        return ""
    raw_text = result.stdout
    # Write intermediate markdown
    md_content = f"# {TITLE}\n\n{raw_text}"
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    # Step 2: pandoc markdown → EPUB
    epub_path = out / "lectionary.epub"
    md_to_epub_via_pandoc(md_path, epub_path)
    return md_content
# ---------------------------------------------------------------------------
# Approach F: pdfminer.six → HTML (with font info) → manual EPUB
# ---------------------------------------------------------------------------
def approach_f_pdfminer_html(pdf_path: Path, out: Path):
    """
    pdfminer can output HTML that preserves font names, sizes, and colours
    as inline styles. We post-process this to detect rubrics (typically red
    or italic) and convert to semantic XHTML, then package as EPUB manually.
    This gives the most control over liturgical formatting.
    """
    from pdfminer.high_level import extract_text_to_fp
    from pdfminer.layout import LAParams
    from io import BytesIO
    from bs4 import BeautifulSoup
    from markdownify import markdownify
    ensure_dir(out)
    laparams = LAParams(boxes_flow=0.5)
    output = BytesIO()
    with open(pdf_path, "rb") as f:
        extract_text_to_fp(
            f, output,
            laparams=laparams,
            output_type="html",
            codec="utf-8",
        )
    raw_html = output.getvalue().decode("utf-8")
    # Write the raw HTML for inspection
    html_path = out / "lectionary.html"
    write_text(html_path, raw_html)
    # Post-process: detect rubrics by colour/italic
    soup = BeautifulSoup(raw_html, "lxml")
    # pdfminer uses <span style="..."> — look for red text or italic
    for span in soup.find_all("span", style=True):
        style = span.get("style", "")
        # Red text → rubric class
        if "color:" in style:
            import re
            color_match = re.search(r"color:\s*#([0-9a-fA-F]{6})", style)
            if color_match:
                r_val = int(color_match.group(1)[:2], 16)
                g_val = int(color_match.group(1)[2:4], 16)
                b_val = int(color_match.group(1)[4:6], 16)
                # If red-ish (r > 150, g < 100, b < 100)
                if r_val > 150 and g_val < 100 and b_val < 100:
                    span["class"] = span.get("class", []) + ["rubric"]
    xhtml_body = str(soup.body) if soup.body else str(soup)
    # Build manual EPUB with liturgical CSS
    build_epub_manually(xhtml_body, out / "lectionary.epub")
    # Also produce Markdown via markdownify
    md_content = f"# {TITLE}\n\n" + markdownify(raw_html, heading_style="ATX")
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    return md_content
# ---------------------------------------------------------------------------
# Optional Approach G: PyMuPDF (if installed)
# ---------------------------------------------------------------------------
def approach_g_pymupdf(pdf_path: Path, out: Path):
    """
    PyMuPDF (fitz) is often the best single library for PDF extraction.
    It preserves font info, can extract as HTML/XHTML, handles tables,
    and is very fast. Only runs if pymupdf is installed.
    """
    import fitz  # pymupdf
    ensure_dir(out)
    doc = fitz.open(str(pdf_path))
    sections = []
    html_sections = []
    for i, page in enumerate(doc):
        # Text extraction with layout preservation
        text = page.get_text("text")
        sections.append(f"## Page {i + 1}\n\n{text}")
        # HTML extraction (preserves fonts/colors)
        html = page.get_text("html")
        html_sections.append(html)
    doc.close()
    md_content = f"# {TITLE}\n\n" + "\n\n".join(sections)
    md_path = out / "lectionary.md"
    write_text(md_path, md_content)
    md_to_epub_via_pandoc(md_path, out / "lectionary.epub")
    # Also save the HTML version
    full_html = "<html><body>" + "\n".join(html_sections) + "</body></html>"
    html_path = out / "lectionary.html"
    write_text(html_path, full_html)
    # Build a manual EPUB from the HTML too
    build_epub_manually(
        "\n".join(html_sections),
        out / "lectionary_html.epub",
    )
    return md_content
# ---------------------------------------------------------------------------
# Comparison Report
# ---------------------------------------------------------------------------
def generate_comparison(results: dict):
    """Generate a comparison.md showing first-N-lines from each approach."""
    lines = [
        f"# Conversion Experiment Results\n",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n",
        f"Source PDF: `{DEFAULT_PDF}`\n\n",
        "## Quick Comparison\n\n",
        "Below are the first 30 lines of Markdown output from each approach.\n",
        "Open the full files or EPUBs for detailed review.\n\n",
    ]
    for name, md_content in sorted(results.items()):
        lines.append(f"### {name}\n\n")
        if md_content:
            preview = snippet(md_content, 30)
            lines.append(f"```\n{preview}\n```\n\n")
        else:
            lines.append("*(no Markdown output — check EPUB directly)*\n\n")
    # File size table
    lines.append("## Output File Sizes\n\n")
    lines.append("| Approach | Markdown | EPUB |\n")
    lines.append("|----------|----------|------|\n")
    for name in sorted(results.keys()):
        folder = OUTPUT_DIR / name
        md_size = epub_size = "—"
        md_file = folder / "lectionary.md"
        epub_file = folder / "lectionary.epub"
        if md_file.exists():
            md_size = f"{md_file.stat().st_size / 1024:.1f} KB"
        if epub_file.exists():
            epub_size = f"{epub_file.stat().st_size / 1024:.1f} KB"
        lines.append(f"| {name} | {md_size} | {epub_size} |\n")
    report = "".join(lines)
    report_path = OUTPUT_DIR / "comparison.md"
    write_text(report_path, report)
    return report_path
# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
APPROACHES = {
    "A_pdfplumber": approach_a_pdfplumber,
    "B_pdfminer": approach_b_pdfminer,
    "C_pypdfium2": approach_c_pypdfium2,
    "D_pdftotext": approach_d_pdftotext,
    "E_pandoc_direct": approach_e_pandoc_direct,
    "F_pdfminer_html": approach_f_pdfminer_html,
}
# Conditionally add PyMuPDF
try:
    import fitz
    APPROACHES["G_pymupdf"] = approach_g_pymupdf
    print("ℹ PyMuPDF detected — adding approach G")
except ImportError:
    print("ℹ PyMuPDF not installed — skipping approach G (pip install pymupdf)")
def main():
    parser = argparse.ArgumentParser(description="PDF→EPUB conversion experiment")
    parser.add_argument(
        "--pdf", default=DEFAULT_PDF,
        help=f"Path to source PDF (default: {DEFAULT_PDF})",
    )
    parser.add_argument(
        "--only", default=None,
        help="Run only one approach, e.g. --only A",
    )
    parser.add_argument(
        "--clean", action="store_true",
        help="Remove output/ before running",
    )
    args = parser.parse_args()
    pdf_path = Path(args.pdf).resolve()
    if not pdf_path.exists():
        print(f"✗ PDF not found: {pdf_path}")
        sys.exit(1)
    if args.clean and OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
        print("Cleaned output/")
    ensure_dir(OUTPUT_DIR)
    # Filter approaches
    to_run = APPROACHES
    if args.only:
        matches = {k: v for k, v in APPROACHES.items() if k.startswith(args.only)}
        if not matches:
            print(f"✗ No approach matching '{args.only}'. Available: {', '.join(APPROACHES)}")
            sys.exit(1)
        to_run = matches
    results = {}
    for name, fn in to_run.items():
        print(f"\n{'='*60}")
        print(f"Running: {name}")
        print(f"{'='*60}")
        out = OUTPUT_DIR / name
        try:
            md_content = fn(pdf_path, out)
            results[name] = md_content or ""
            print(f"  ✓ {name} complete")
        except Exception as e:
            print(f"  ✗ {name} FAILED: {e}")
            import traceback
            traceback.print_exc()
            results[name] = ""
    # Generate comparison
    print(f"\n{'='*60}")
    print("Generating comparison report...")
    print(f"{'='*60}")
    report_path = generate_comparison(results)
    print(f"\n✓ Done! Review outputs in {OUTPUT_DIR.relative_to(SCRIPT_DIR)}/")
    print(f"  Comparison: {report_path.relative_to(SCRIPT_DIR)}")
if __name__ == "__main__":
    main()
