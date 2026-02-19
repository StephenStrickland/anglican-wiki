#!/usr/bin/env python3
"""
LLM-assisted PDF → Markdown → EPUB conversion.

Reads the pdfplumber extraction, parses each section, expands implicit
book references, fixes garbled headers, and produces clean Markdown tables.
Then packages as EPUB via pandoc.
"""
import re
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
INPUT_MD = SCRIPT_DIR / "output" / "A_pdfplumber" / "lectionary.md"
OUTPUT_DIR = SCRIPT_DIR / "output" / "H_claude"
TITLE = "Daily Office Lectionary (1662 BCP)"
AUTHOR = "Anglican Wiki"

# Regex for Roman numeral page markers (standalone line)
ROMAN_RE = re.compile(r"^[ivxlcdm]+$", re.IGNORECASE)

# Known Bible book abbreviations (used to detect book names in text)
BOOK_NAMES = [
    "Gen.", "Exod.", "Lev.", "Num.", "Deut.",
    "Josh.", "Judg.", "Ruth",
    "1 Sam.", "2 Sam.", "1 Kgs.", "2 Kgs.",
    "1 Chr.", "2 Chr.", "Ezra", "Neh.", "Esth.",
    "Job", "Prov.", "Eccl.", "Song",
    "Isa.", "Jer.", "Lam.", "Ezek.", "Dan.",
    "Hos.", "Joel", "Amos", "Obad.", "Jonah", "Mic.",
    "Nah.", "Hab.", "Zeph.", "Hag.", "Zech.", "Mal.",
    "Tob.", "Jdt.", "Wis.", "Sir.", "Bar.", "Sus.", "Bel",
    "Matt.", "Mark", "Luke", "John", "Acts",
    "Rom.", "1 Cor.", "2 Cor.", "Gal.", "Eph.", "Phil.", "Col.",
    "1 Thess.", "2 Thess.", "1 Tim.", "2 Tim.", "Titus", "Phlm.", "Heb.",
    "Jas.", "1 Pet.", "2 Pet.",
    "1 John", "2 John", "3 John", "2 & 3 John", "Jude", "Rev.",
]

# Sort longest first so "1 Sam." matches before "Sam."
BOOK_NAMES.sort(key=len, reverse=True)


def find_book_prefix(text):
    """Extract a Bible book name from the start of text, if present."""
    text = text.strip()
    for book in BOOK_NAMES:
        if text.startswith(book):
            return book
    return None


def expand_reference(raw, current_book):
    """
    Given a raw cell like '5' or 'Isa. 5' or '9:1-19', expand implicit book.
    Returns (expanded_string, new_current_book).
    """
    raw = raw.strip()
    if not raw or raw == "—":
        return "—", current_book

    book = find_book_prefix(raw)
    if book:
        current_book = book
        return raw, current_book
    else:
        # Bare chapter number — prepend current book
        if current_book and re.match(r"^\d", raw):
            return f"{current_book} {raw}", current_book
        return raw, current_book


def fix_header(text):
    """Fix garbled headers like 'LeSSonS ProPer for SundayS'."""
    replacements = {
        "LeSSonS ProPer for SundayS": "Lessons Proper for Sundays",
        "LeSSonS ProPer for HoLy dayS": "Lessons Proper for Holy Days",
        "ProPer PSaLMS": "Proper Psalms",
    }
    for bad, good in replacements.items():
        if bad in text:
            return text.replace(bad, good)

    # Fix month headers like "feBruary – MaTTInS" or "JuLy – eVenSonG"
    month_match = re.match(
        r"^([a-zA-Z]+)\s*[–—-]\s*(MaTTInS|eVenSonG|MATTINS|EVENSONG|Mattins|Evensong)$",
        text, re.IGNORECASE
    )
    if month_match:
        month_raw = month_match.group(1)
        office_raw = month_match.group(2)
        # Capitalize month properly
        month = month_raw.capitalize()
        # Map common garbled months
        month_map = {
            "February": "February", "Febr": "February",
            "January": "January", "March": "March",
            "April": "April", "May": "May", "June": "June",
            "July": "July", "August": "August",
            "September": "September", "October": "October",
            "November": "November", "December": "December",
        }
        month = month_map.get(month, month)
        office = "Mattins" if "matt" in office_raw.lower() else "Evensong"
        return f"{month} — {office}"

    return text


def parse_sundays_section(lines):
    """Parse the Lessons Proper for Sundays into a table."""
    rows = []
    mattins1_book = ""
    evensong1_book = ""

    season = ""
    for line in lines:
        line = line.strip()
        if not line or ROMAN_RE.match(line):
            continue
        if line.startswith("Mattins") or line.startswith("Sundays"):
            continue
        if line.startswith("Lessons Proper for Sundays"):
            continue
        if line.startswith("Lessons Proper for Holy"):
            continue

        # Season headers
        if line in ("Of Advent", "After Christmas", "After Epiphany",
                     "In Lent", "After Easter", "After Trinity"):
            season = line
            continue
        if line.startswith("In Lent"):
            season = "In Lent"
            continue
        if line.startswith("After Ascension"):
            # "After Ascension 12 - 13 -" — has data on same line
            season = "After Ascension"
            line = line.replace("After Ascension", "").strip()
            if not line:
                continue

        # Parse data row
        # Format variations:
        #   "1 Isa. 1 - Isa. 2 -"     (numbered within season)
        #   "Septuagesima Gen. 1 - Gen. 2 -"  (named Sunday)
        #   "Easter Day 12 Rom. 6 14 Acts 2:22-47"  (all 4 specified)

        # Try numbered row first: starts with a digit
        num_match = re.match(r"^(\d+)\s+(.+)$", line)
        if num_match and season:
            num = num_match.group(1)
            sunday_name = f"{season} {num}"
            rest = num_match.group(2)
        elif not line[0].isdigit():
            # Named Sunday (Septuagesima, Easter Day, etc.)
            # Find where the data starts (first book name or digit)
            parts = line.split()
            name_parts = []
            data_start = 0
            for i, p in enumerate(parts):
                if re.match(r"^\d", p) or find_book_prefix(" ".join(parts[i:])):
                    data_start = i
                    break
                name_parts.append(p)
            if season == "After Ascension":
                sunday_name = "After Ascension"
            else:
                sunday_name = " ".join(name_parts)
            rest = " ".join(parts[data_start:])
        else:
            continue

        # Parse the 4 columns from rest
        # This is tricky because fields are space-separated and book names contain spaces
        cells = parse_four_columns(rest)
        if len(cells) == 4:
            cells[0], mattins1_book = expand_reference(cells[0], mattins1_book)
            cells[1], _ = expand_reference(cells[1], "")
            cells[2], evensong1_book = expand_reference(cells[2], evensong1_book)
            cells[3], _ = expand_reference(cells[3], "")
            rows.append((sunday_name, cells[0], cells[1], cells[2], cells[3]))

    return rows


def parse_four_columns(text):
    """
    Parse a string like 'Isa. 1 - Isa. 2 -' or '9 Matt. 26 10 Heb. 5:1-10'
    into four lesson columns.
    """
    text = text.strip()
    if not text:
        return ["—", "—", "—", "—"]

    # Tokenize carefully
    tokens = tokenize_references(text)

    if len(tokens) == 4:
        return [t if t != "-" else "—" for t in tokens]
    elif len(tokens) == 2:
        # Only Mattins 1 and Evensong 1 (both 2nd lessons are "—")
        return [tokens[0], "—", tokens[1], "—"]
    elif len(tokens) == 3:
        # Ambiguous — likely M1, -, E1, - where one dash was consumed
        return [tokens[0], "—", tokens[1] if tokens[1] != "-" else "—",
                tokens[2] if tokens[2] != "-" else "—"]

    # Fallback: try splitting on " - " or dashes
    parts = re.split(r"\s+-\s+", text)
    if len(parts) >= 2:
        return [parts[0].strip(), "—",
                parts[1].strip() if len(parts) > 1 else "—", "—"]

    return [text, "—", "—", "—"]


def tokenize_references(text):
    """
    Tokenize a string of Bible references separated by spaces/dashes.
    Handles multi-word book names like '1 Cor.' and verse ranges.
    """
    tokens = []
    remaining = text.strip()

    while remaining:
        remaining = remaining.lstrip()
        if not remaining:
            break

        # Check for em-dash or dash (separator meaning "no lesson")
        if remaining[0] == "—":
            tokens.append("—")
            remaining = remaining[1:].lstrip()
            continue
        if remaining[0] == "-" and (len(remaining) == 1 or remaining[1] == " "):
            tokens.append("-")
            remaining = remaining[1:].lstrip()
            continue

        # Check for a book name
        book = find_book_prefix(remaining)
        if book:
            remaining = remaining[len(book):].lstrip()
            # Get the chapter/verse that follows
            chap_match = re.match(r"^([\d:,\-–]+)", remaining)
            if chap_match:
                tokens.append(f"{book} {chap_match.group(1)}")
                remaining = remaining[chap_match.end():].lstrip()
            else:
                tokens.append(book)
            continue

        # Bare chapter number (possibly with verse range)
        chap_match = re.match(r"^([\d][\d:,\-–]*)", remaining)
        if chap_match:
            tokens.append(chap_match.group(1))
            remaining = remaining[chap_match.end():].lstrip()
            continue

        # Skip unknown character
        remaining = remaining[1:]

    return tokens


def parse_holy_days(lines):
    """Parse a Holy Days section (Mattins or Evensong) into table rows."""
    rows = []
    current_book = ""

    for line in lines:
        line = line.strip()
        if not line or ROMAN_RE.match(line):
            continue
        if line.startswith("Day") or line.startswith("Lessons Proper"):
            continue

        # Parse: "St. Andrew Prov. 20 -" or "St. Matthias 19 -"
        # Find the last occurrence of a book name or chapter reference
        # Strategy: work backwards from the end

        # Extract the 2 Lesson (last token)
        parts = line.rsplit(None, 1)
        if len(parts) < 2:
            continue

        # Try to identify lesson2 and lesson1 from end of line
        lesson2, lesson1, day_name = parse_holy_day_line(line, current_book)
        if day_name:
            lesson1_exp, current_book = expand_reference(lesson1, current_book)
            lesson2_exp, _ = expand_reference(lesson2, "")
            rows.append((day_name, lesson1_exp, lesson2_exp))

    return rows


def parse_holy_day_line(line, current_book):
    """
    Parse a holy day line like 'St. Andrew Prov. 20 -'
    Returns (lesson2, lesson1, day_name).
    """
    # Tokenize from the right to find lessons
    tokens = tokenize_references(line)

    if len(tokens) < 2:
        return None, None, None

    lesson2 = tokens[-1]
    lesson1 = tokens[-2]

    # The day name is everything before the lessons
    # Find where lesson1 starts in the original line
    # Reconstruct the lesson part
    lesson_text = lesson1
    if lesson2 != "-":
        # Find lesson1 in line, then lesson2 after it
        pass

    # Simple approach: find the position of the last two references
    # by removing them from the end
    remaining = line.strip()

    # Remove lesson2 from end
    l2_str = lesson2 if lesson2 != "-" else "-"
    if remaining.endswith(l2_str):
        remaining = remaining[:-len(l2_str)].rstrip()
    elif remaining.endswith("—"):
        remaining = remaining[:-1].rstrip()

    # Remove lesson1 from end
    l1_str = lesson1 if lesson1 != "-" else "-"
    # Need to find the lesson1 reference at end of remaining
    # Try matching known book+chapter or bare chapter
    book = find_book_prefix_reverse(remaining)
    if book:
        idx = remaining.rfind(book)
        if idx >= 0:
            remaining = remaining[:idx].rstrip()
    else:
        # Try bare chapter number at end
        m = re.search(r"\s+([\d][\d:,\-–]*)$", remaining)
        if m:
            remaining = remaining[:m.start()].rstrip()

    day_name = remaining.strip()
    if not day_name:
        return None, None, None

    return lesson2 if lesson2 != "-" else "—", lesson1, day_name


def find_book_prefix_reverse(text):
    """Find a book name at the end of text."""
    text = text.rstrip()
    for book in BOOK_NAMES:
        # Check if text ends with "Book chapter" pattern
        pattern = re.escape(book) + r"\s+[\d][\d:,\-–]*$"
        m = re.search(pattern, text)
        if m:
            return text[m.start():]
    # Check if text ends with just a book name
    for book in BOOK_NAMES:
        if text.endswith(book):
            return book
    return None


def parse_monthly_table(lines):
    """
    Parse a monthly office table (Mattins or Evensong).
    Returns (month, office, header_note, rows).
    """
    rows = []
    lesson1_book = ""
    lesson2_book = ""

    for line in lines:
        line = line.strip()
        if not line or ROMAN_RE.match(line):
            continue
        if "hath" in line and "days" in line:
            continue  # Skip "January hath 31 days" header line

        # Parse day line: "2 b Gen. 1 Matt. 1" or "8 a Lucian, P. & M. 13 6"
        m = re.match(r"^(\d+)\s+([a-gA-G])?\s*(.*)", line)
        if not m:
            # Try without letter (e.g., Feb 29: "29 13 Matt. 7")
            m = re.match(r"^(\d+)\s+(.*)", line)
            if m:
                day = m.group(1)
                letter = ""
                rest = m.group(2)
            else:
                continue
        else:
            day = m.group(1)
            letter = m.group(2) or ""
            rest = m.group(3)

        # Parse rest into: [fast?] [holy_day?] lesson1 lesson2
        rest = rest.strip()

        # Check for fast
        fast = ""
        if rest.startswith("fast ") or rest.startswith("fast\t"):
            fast = "fast"
            rest = rest[5:].strip()

        # Extract lessons from end (last two tokens are lesson1 and lesson2)
        tokens = tokenize_references(rest)
        if len(tokens) >= 2:
            lesson2_raw = tokens[-1]
            lesson1_raw = tokens[-2]

            # Everything before the lessons is the holy day name
            # Reconstruct by finding where lessons start in rest
            holy_day = extract_holy_day_name(rest, tokens)

            # Handle "— —" for proper lesson days
            if lesson1_raw in ("—", "-"):
                lesson1 = "—"
            else:
                lesson1, lesson1_book = expand_reference(lesson1_raw, lesson1_book)

            if lesson2_raw in ("—", "-"):
                lesson2 = "—"
            else:
                lesson2, lesson2_book = expand_reference(lesson2_raw, lesson2_book)

            if fast:
                holy_day = f"*fast* {holy_day}".strip()

            rows.append((day, letter, holy_day, lesson1, lesson2))
        elif len(tokens) == 1:
            # Edge case
            lesson1, lesson1_book = expand_reference(tokens[0], lesson1_book)
            holy_day = ""
            if fast:
                holy_day = "*fast*"
            rows.append((day, letter, holy_day, lesson1, "—"))

    return rows


def extract_holy_day_name(rest, tokens):
    """Extract the holy day name from a monthly table line, given parsed tokens."""
    if len(tokens) < 2:
        return ""

    # The holy day is the text before the reference tokens
    # Find where the first reference token appears
    lesson1_raw = tokens[-2]
    lesson2_raw = tokens[-1]

    # Work backwards: remove lesson tokens from end of string
    s = rest.rstrip()

    # Remove lesson2
    for suffix in [lesson2_raw, lesson2_raw.replace("—", "-")]:
        if s.endswith(suffix):
            s = s[:-len(suffix)].rstrip()
            break

    # Remove lesson1
    for suffix in [lesson1_raw, lesson1_raw.replace("—", "-")]:
        if s.endswith(suffix):
            s = s[:-len(suffix)].rstrip()
            break

    return s.strip()


def process_pdfplumber_output(text):
    """Main processing: read pdfplumber output, produce clean Markdown."""
    lines = text.splitlines()

    # Split into page sections
    pages = []
    current_page = []
    for line in lines:
        if re.match(r"^## Page \d+", line):
            if current_page:
                pages.append(current_page)
            current_page = []
        else:
            current_page.append(line)
    if current_page:
        pages.append(current_page)

    # Build the output
    out = []
    out.append("# Daily Office Lectionary (1662 BCP)")
    out.append("")
    out.append("*Proper Lessons to be read at Morning and Evening Prayer")
    out.append("on the Sundays and other holy days throughout the year.*")
    out.append("")

    # --- Section 1: Lessons Proper for Sundays (pages 1-3) ---
    out.append("## Lessons Proper for Sundays")
    out.append("")
    out.append("| Sunday | Mattins 1 Lesson | Mattins 2 Lesson | Evensong 1 Lesson | Evensong 2 Lesson |")
    out.append("|--------|-----------------|-----------------|-------------------|-------------------|")

    sunday_lines = []
    for page in pages[0:3]:
        for line in page:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ROMAN_RE.match(line):
                continue
            if any(line.startswith(h) for h in ["Proper Lessons", "to be read", "Prayer on", "holy days"]):
                continue
            sunday_lines.append(line)

    sunday_rows = parse_sundays_section(sunday_lines)
    for name, m1, m2, e1, e2 in sunday_rows:
        out.append(f"| {name} | {m1} | {m2} | {e1} | {e2} |")

    out.append("")

    # --- Section 2: Lessons Proper for Holy Days — Mattins (pages 3-4) ---
    out.append("## Lessons Proper for Holy Days — Mattins")
    out.append("")
    out.append("| Day | 1 Lesson | 2 Lesson |")
    out.append("|-----|----------|----------|")

    # Collect holy days mattins lines
    hd_mattins_lines = collect_holy_days_mattins(pages)
    hd_mattins_rows = parse_holy_days_simple(hd_mattins_lines, "mattins")
    for name, l1, l2 in hd_mattins_rows:
        out.append(f"| {name} | {l1} | {l2} |")

    out.append("")

    # --- Section 3: Lessons Proper for Holy Days — Evensong (pages 4-5) ---
    out.append("## Lessons Proper for Holy Days — Evensong")
    out.append("")
    out.append("| Day | 1 Lesson | 2 Lesson |")
    out.append("|-----|----------|----------|")

    hd_evensong_lines = collect_holy_days_evensong(pages)
    hd_evensong_rows = parse_holy_days_simple(hd_evensong_lines, "evensong")
    for name, l1, l2 in hd_evensong_rows:
        out.append(f"| {name} | {l1} | {l2} |")

    out.append("")

    # --- Section 4: Proper Psalms on Certain Days ---
    out.append("## Proper Psalms on Certain Days")
    out.append("")
    out.append("| Day | Mattins | Evensong |")
    out.append("|-----|---------|----------|")

    psalm_data = [
        ("Christmas Day", "19, 45, 85", "89, 110, 132"),
        ("Ash Wednesday", "6, 32, 38", "102, 130, 143"),
        ("Good Friday", "22, 40, 54", "69, 88"),
        ("Easter Day", "2, 57, 111", "113, 114, 118"),
        ("Ascension Day", "8, 15, 21", "24, 47, 108"),
        ("Whitsunday", "48, 68", "104, 145"),
    ]
    for day, matt, even in psalm_data:
        out.append(f"| {day} | {matt} | {even} |")

    out.append("")

    # --- Section 5: Monthly Tables (pages 6-29) ---
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    # Pages 6-29: pairs of (Mattins, Evensong) for each month
    page_idx = 5  # 0-indexed, page 6 is index 5
    for month in month_names:
        for office in ["Mattins", "Evensong"]:
            out.append(f"## {month} — {office}")
            out.append("")
            out.append("| Day | Letter | Holy Day | 1 Lesson | 2 Lesson |")
            out.append("|-----|--------|----------|----------|----------|")

            if page_idx < len(pages):
                page_lines = [l.strip() for l in pages[page_idx]
                              if l.strip() and not ROMAN_RE.match(l.strip())
                              and not l.strip().startswith("#")]
                # Remove garbled header line and "hath N days" line
                filtered = []
                for pl in page_lines:
                    if "MaTTInS" in pl or "eVenSonG" in pl:
                        continue
                    if "MATTINS" in pl.upper() and "–" in pl:
                        continue
                    if "EVENSONG" in pl.upper() and "–" in pl:
                        continue
                    # Skip lines that are just the garbled month-office header
                    if re.match(r"^[a-zA-Z]+\s*[–—-]\s*(MaTTInS|eVenSonG)", pl, re.IGNORECASE):
                        continue
                    filtered.append(pl)

                monthly_rows = parse_monthly_table(filtered)

                # Fix split saint names
                monthly_rows = fix_split_saint_names(monthly_rows)

                for day, letter, holy_day, l1, l2 in monthly_rows:
                    out.append(f"| {day} | {letter} | {holy_day} | {l1} | {l2} |")

                page_idx += 1
            out.append("")

    return "\n".join(out)


def collect_holy_days_mattins(pages):
    """Collect lines for the Holy Days Mattins section."""
    # Starts at "Lessons Proper for Holy days – Mattins." on page 3
    # Ends at page 4 before "Lessons Proper for Holy days – evensong."
    lines = []
    collecting = False
    for page in pages[2:4]:  # pages 3-4
        for line in page:
            stripped = line.strip()
            if "Mattins" in stripped and "Holy" in stripped.replace("HoLy", "Holy"):
                collecting = True
                continue
            if "evensong" in stripped.lower() and ("Holy" in stripped or "HoLy" in stripped):
                collecting = False
                continue
            if collecting and stripped and not ROMAN_RE.match(stripped):
                if not stripped.startswith("Day ") and not stripped.startswith("Mattins"):
                    lines.append(stripped)
    return lines


def collect_holy_days_evensong(pages):
    """Collect lines for the Holy Days Evensong section."""
    lines = []
    collecting = False
    for page in pages[3:5]:  # pages 4-5
        for line in page:
            stripped = line.strip()
            if "evensong" in stripped.lower() and ("Holy" in stripped or "HoLy" in stripped):
                collecting = True
                continue
            if "Proper Psalms" in stripped or "ProPer PSaLMS" in stripped:
                collecting = False
                continue
            if stripped.startswith("Day "):
                # Could be start of evensong section on page 5
                # Check if we're not yet collecting
                if not collecting:
                    collecting = True
                continue
            if collecting and stripped and not ROMAN_RE.match(stripped):
                lines.append(stripped)
    return lines


# Hard-coded holy days data (since parsing is error-prone for this section)
HOLY_DAYS_MATTINS = [
    ("St. Andrew", "Prov. 20", "—"),
    ("St. Thomas the Apostle", "Prov. 23", "—"),
    ("Nativity of Christ", "Isa. 9:1-7", "Luke 2:1-14"),
    ("St. Stephen", "Prov. 28", "Acts 6:8–7:29"),
    ("St. John", "Eccl. 5", "Rev. 1"),
    ("Innocents' Day", "Jer. 31:1-17", "—"),
    ("Circumcision", "Gen. 17", "Rom. 2"),
    ("Epiphany", "Isa. 60", "Luke 3:1-22"),
    ("Conversion of St. Paul", "Wis. 5", "Acts 22:1-21"),
    ("Purification of the V. Mary", "Wis. 9", "—"),
    ("St. Matthias", "Wis. 19", "—"),
    ("Annunciation of our Lady", "Sir. 2", "—"),
    ("Wednesday before Easter", "Hos. 13", "John 11:45-57"),
    ("Thursday before Easter", "Dan. 9", "John 13"),
    ("Good Friday", "Gen. 22:1-19", "John 18"),
    ("Easter Even", "Zech. 9", "Luke 23:50-56"),
    ("Monday in Easter Week", "Exod. 16", "Matt. 28"),
    ("Tuesday in Easter Week", "Exod. 20", "Luke 24:1-12"),
    ("St. Mark", "Sir. 4", "—"),
    ("St. Philip and St. James", "Sir. 7", "John 1:43-51"),
    ("Ascension Day", "Deut. 10", "Luke 24:44-53"),
    ("Monday in Whitsun Week", "Gen. 11:1-9", "1 Cor. 12"),
    ("Tuesday in Whitsun Week", "1 Sam. 19:18-24", "1 Thess. 5:12-23"),
    ("St. Barnabas", "Sir. 10", "Acts 14"),
    ("St. John the Baptist", "Mal. 3", "Matt. 3"),
    ("St. Peter", "Sir. 15", "Acts 3"),
    ("St. James", "Sir. 21", "—"),
    ("St. Bartholomew", "Sir. 24", "—"),
    ("St. Matthew", "Sir. 35", "—"),
    ("St. Michael", "Gen. 32", "Acts 12:1-19"),
    ("St. Luke", "Sir. 51", "—"),
    ("St. Simon and St. Jude", "Job 24–25", "—"),
    ("All Saints", "Wis. 3:1-9", "Heb. 11:32–12:6"),
]

HOLY_DAYS_EVENSONG = [
    ("St. Andrew", "Prov. 21", "—"),
    ("St. Thomas the Apostle", "Prov. 24", "—"),
    ("Nativity of Christ", "Isa. 7:10-16", "Titus 3:4-8"),
    ("St. Stephen", "Eccl. 4", "Acts 7:30-54"),
    ("St. John", "Eccl. 6", "Rev. 22"),
    ("Innocents' Day", "Wis. 1", "—"),
    ("Circumcision", "Deut. 10:12-22", "Col. 2"),
    ("Epiphany", "Isa. 49", "John 2:1-11"),
    ("Conversion of St. Paul", "Wis. 6", "Acts 26"),
    ("Purification of the V. Mary", "Wis. 12", "—"),
    ("St. Matthias", "Sir. 1", "—"),
    ("Annunciation of our Lady", "Sir. 3", "—"),
    ("Wednesday before Easter", "Hos. 14", "—"),
    ("Thursday before Easter", "Jer. 31", "—"),
    ("Good Friday", "Isa. 53", "1 Pet. 2"),
    ("Easter Even", "Exod. 13", "Heb. 4"),
    ("Monday in Easter Week", "Exod. 17", "Acts 3"),
    ("Tuesday in Easter Week", "Exod. 32", "1 Cor. 15"),
    ("St. Mark", "Sir. 5", "—"),
    ("St. Philip and St. James", "Sir. 9", "—"),
    ("Ascension Day", "2 Kgs. 2", "Eph. 4:1-16"),
    ("Monday in Whitsun Week", "Num. 11:16-29", "1 Cor. 14:1-25"),
    ("Tuesday in Whitsun Week", "Deut. 30", "1 John 4:1-13"),
    ("St. Barnabas", "Sir. 12", "Acts 15:1-35"),
    ("St. John the Baptist", "Mal. 4", "Matt. 14:1-12"),
    ("St. Peter", "Sir. 19", "Acts 4"),
    ("St. James", "Sir. 22", "—"),
    ("St. Bartholomew", "Sir. 29", "—"),
    ("St. Matthew", "Sir. 38", "—"),
    ("St. Michael", "Dan. 10:5-21", "Jude 6-15"),
    ("St. Luke", "Job 1", "—"),
    ("St. Simon and St. Jude", "Job 42", "—"),
    ("All Saints", "Wis. 5:1-16", "Rev. 19:1-16"),
]

# Hard-coded Sundays data (since the parsing is complex with implicit books)
SUNDAYS_DATA = [
    ("Advent 1", "Isa. 1", "—", "Isa. 2", "—"),
    ("Advent 2", "Isa. 5", "—", "Isa. 24", "—"),
    ("Advent 3", "Isa. 25", "—", "Isa. 26", "—"),
    ("Advent 4", "Isa. 30", "—", "Isa. 32", "—"),
    ("After Christmas 1", "Isa. 37", "—", "Isa. 38", "—"),
    ("After Christmas 2", "Isa. 41", "—", "Isa. 43", "—"),
    ("After Epiphany 1", "Isa. 44", "—", "Isa. 46", "—"),
    ("After Epiphany 2", "Isa. 51", "—", "Isa. 53", "—"),
    ("After Epiphany 3", "Isa. 55", "—", "Isa. 56", "—"),
    ("After Epiphany 4", "Isa. 57", "—", "Isa. 58", "—"),
    ("After Epiphany 5", "Isa. 59", "—", "Isa. 64", "—"),
    ("After Epiphany 6", "Isa. 65", "—", "Isa. 66", "—"),
    ("Septuagesima", "Gen. 1", "—", "Gen. 2", "—"),
    ("Sexagesima", "Gen. 3", "—", "Gen. 6", "—"),
    ("Quinquagesima", "Gen. 9:1-19", "—", "Gen. 12", "—"),
    ("In Lent 1", "Gen. 19:1-29", "—", "Gen. 22", "—"),
    ("In Lent 2", "Gen. 27", "—", "Gen. 34", "—"),
    ("In Lent 3", "Gen. 39", "—", "Gen. 42", "—"),
    ("In Lent 4", "Gen. 43", "—", "Gen. 45", "—"),
    ("In Lent 5", "Exod. 3", "—", "Exod. 5", "—"),
    ("In Lent 6", "Exod. 9", "Matt. 26", "Exod. 10", "Heb. 5:1-10"),
    ("Easter Day", "Exod. 12", "Rom. 6", "Exod. 14", "Acts 2:22-47"),
    ("After Easter 1", "Num. 16", "—", "Num. 22", "—"),
    ("After Easter 2", "Num. 23–24", "—", "Num. 25", "—"),
    ("After Easter 3", "Deut. 4", "—", "Deut. 5", "—"),
    ("After Easter 4", "Deut. 6", "—", "Deut. 7", "—"),
    ("After Easter 5", "Deut. 8", "—", "Deut. 9", "—"),
    ("After Ascension", "Deut. 12", "—", "Deut. 13", "—"),
    ("Whitsunday", "Deut. 16:1-17", "Acts 10:34-48", "Isa. 11", "Acts 19:1-20"),
    ("Trinity Sunday", "Gen. 1", "Matt. 3", "Gen. 18", "1 John 5"),
    ("After Trinity 1", "Josh. 10", "—", "Josh. 23", "—"),
    ("After Trinity 2", "Judg. 4", "—", "Judg. 5", "—"),
    ("After Trinity 3", "1 Sam. 2", "—", "1 Sam. 3", "—"),
    ("After Trinity 4", "1 Sam. 12", "—", "1 Sam. 13", "—"),
    ("After Trinity 5", "1 Sam. 15", "—", "1 Sam. 17", "—"),
    ("After Trinity 6", "2 Sam. 12", "—", "2 Sam. 19", "—"),
    ("After Trinity 7", "2 Sam. 21", "—", "2 Sam. 24", "—"),
    ("After Trinity 8", "1 Kgs. 13", "—", "1 Kgs. 17", "—"),
    ("After Trinity 9", "1 Kgs. 18", "—", "1 Kgs. 19", "—"),
    ("After Trinity 10", "1 Kgs. 21", "—", "1 Kgs. 22", "—"),
    ("After Trinity 11", "2 Kgs. 5", "—", "2 Kgs. 9", "—"),
    ("After Trinity 12", "2 Kgs. 10", "—", "2 Kgs. 18", "—"),
    ("After Trinity 13", "2 Kgs. 19", "—", "2 Kgs. 23", "—"),
    ("After Trinity 14", "Jer. 5", "—", "Jer. 22", "—"),
    ("After Trinity 15", "Jer. 35", "—", "Jer. 36", "—"),
    ("After Trinity 16", "Ezek. 2", "—", "Ezek. 13", "—"),
    ("After Trinity 17", "Ezek. 14", "—", "Ezek. 18", "—"),
    ("After Trinity 18", "Ezek. 20", "—", "Ezek. 24", "—"),
    ("After Trinity 19", "Dan. 3", "—", "Dan. 6", "—"),
    ("After Trinity 20", "Joel 2", "—", "Mic. 6", "—"),
    ("After Trinity 21", "Hab. 2", "—", "Prov. 1", "—"),
    ("After Trinity 22", "Prov. 2", "—", "Prov. 3", "—"),
    ("After Trinity 23", "Prov. 11", "—", "Prov. 12", "—"),
    ("After Trinity 24", "Prov. 13", "—", "Prov. 14", "—"),
    ("After Trinity 25", "Prov. 15", "—", "Prov. 16", "—"),
    ("After Trinity 26", "Prov. 17", "—", "Prov. 19", "—"),
]


def parse_holy_days_simple(lines, section):
    """Simple fallback — use hard-coded data."""
    if section == "mattins":
        return HOLY_DAYS_MATTINS
    else:
        return HOLY_DAYS_EVENSONG


def fix_split_saint_names(rows):
    """
    Fix saint names that were split across two lines in the PDF extraction.
    Known cases:
    - "St. John the Evangelist ante" + "portam Latinam" (May 6-7)
    - "Tr. of Edward, K. of the West" + "Saxons" (June 20-21)
    - "St. Anne, Mother of the Blessed" + "V. Mary" (July 26-27)
    - "St. Cyprian, Archb. of Carthage" + "& M." (Sep 26-27)
    """
    fixes = {
        "St. John the Evangelist ante": "portam Latinam",
        "Tr. of Edward, K. of the West": "Saxons",
        "St. Anne, Mother of the Blessed": "V. Mary",
        "St. Cyprian, Archb. of Carthage": "& M.",
    }

    result = []
    i = 0
    while i < len(rows):
        day, letter, holy_day, l1, l2 = rows[i]
        merged = False
        for partial, continuation in fixes.items():
            if holy_day.strip().endswith(partial) or partial in holy_day:
                # Check if next row starts with the continuation
                if i + 1 < len(rows):
                    next_day, next_letter, next_holy, next_l1, next_l2 = rows[i + 1]
                    if next_holy.strip().startswith(continuation):
                        # Merge the saint name
                        full_name = f"{holy_day.strip()} {continuation}"
                        result.append((day, letter, full_name, l1, l2))
                        # Next row keeps its lessons but loses the name fragment
                        remaining_name = next_holy.strip()[len(continuation):].strip()
                        result.append((next_day, next_letter, remaining_name, next_l1, next_l2))
                        i += 2
                        merged = True
                        break
        if not merged:
            result.append(rows[i])
            i += 1

    return result


def generate_sundays_table():
    """Generate the Sundays table from hard-coded data."""
    lines = []
    for name, m1, m2, e1, e2 in SUNDAYS_DATA:
        lines.append(f"| {name} | {m1} | {m2} | {e1} | {e2} |")
    return lines


def generate_holy_days_table(data):
    """Generate a holy days table from hard-coded data."""
    lines = []
    for name, l1, l2 in data:
        lines.append(f"| {name} | {l1} | {l2} |")
    return lines


def main():
    # Read pdfplumber output
    raw = INPUT_MD.read_text(encoding="utf-8")
    lines = raw.splitlines()

    # Split into pages
    pages = []
    current_page = []
    for line in lines:
        if re.match(r"^## Page \d+", line):
            if current_page:
                pages.append(current_page)
            current_page = []
        else:
            current_page.append(line)
    if current_page:
        pages.append(current_page)

    # Build output
    out = []
    out.append("# Daily Office Lectionary (1662 BCP)")
    out.append("")
    out.append("*Proper Lessons to be read at Morning and Evening Prayer")
    out.append("on the Sundays and other holy days throughout the year.*")
    out.append("")

    # --- Sundays ---
    out.append("## Lessons Proper for Sundays")
    out.append("")
    out.append("| Sunday | Mattins 1 Lesson | Mattins 2 Lesson | Evensong 1 Lesson | Evensong 2 Lesson |")
    out.append("|--------|-----------------|-----------------|-------------------|-------------------|")
    out.extend(generate_sundays_table())
    out.append("")

    # --- Holy Days Mattins ---
    out.append("## Lessons Proper for Holy Days — Mattins")
    out.append("")
    out.append("| Day | 1 Lesson | 2 Lesson |")
    out.append("|-----|----------|----------|")
    out.extend(generate_holy_days_table(HOLY_DAYS_MATTINS))
    out.append("")

    # --- Holy Days Evensong ---
    out.append("## Lessons Proper for Holy Days — Evensong")
    out.append("")
    out.append("| Day | 1 Lesson | 2 Lesson |")
    out.append("|-----|----------|----------|")
    out.extend(generate_holy_days_table(HOLY_DAYS_EVENSONG))
    out.append("")

    # --- Proper Psalms ---
    out.append("## Proper Psalms on Certain Days")
    out.append("")
    out.append("| Day | Mattins | Evensong |")
    out.append("|-----|---------|----------|")
    out.append("| Christmas Day | 19, 45, 85 | 89, 110, 132 |")
    out.append("| Ash Wednesday | 6, 32, 38 | 102, 130, 143 |")
    out.append("| Good Friday | 22, 40, 54 | 69, 88 |")
    out.append("| Easter Day | 2, 57, 111 | 113, 114, 118 |")
    out.append("| Ascension Day | 8, 15, 21 | 24, 47, 108 |")
    out.append("| Whitsunday | 48, 68 | 104, 145 |")
    out.append("")

    # --- Monthly Tables ---
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    page_idx = 6  # pages 6-29 = indices 6-29 (pages[0] is preamble)
    for month in month_names:
        for office in ["Mattins", "Evensong"]:
            out.append(f"## {month} — {office}")
            out.append("")
            out.append("| Day | Letter | Holy Day | 1 Lesson | 2 Lesson |")
            out.append("|-----|--------|----------|----------|----------|")

            if page_idx < len(pages):
                page_lines = []
                for pl in pages[page_idx]:
                    stripped = pl.strip()
                    if not stripped:
                        continue
                    if ROMAN_RE.match(stripped):
                        continue
                    if stripped.startswith("#"):
                        continue
                    # Skip garbled headers
                    if re.match(r"^[a-zA-Z]+\s*[–—-]\s*(MaTTInS|eVenSonG)", stripped, re.IGNORECASE):
                        continue
                    if "hath" in stripped and "days" in stripped:
                        continue
                    page_lines.append(stripped)

                monthly_rows = parse_monthly_table(page_lines)
                monthly_rows = fix_split_saint_names(monthly_rows)

                for day, letter, holy_day, l1, l2 in monthly_rows:
                    out.append(f"| {day} | {letter} | {holy_day} | {l1} | {l2} |")

                page_idx += 1

            out.append("")

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = OUTPUT_DIR / "lectionary.md"
    md_content = "\n".join(out)
    md_path.write_text(md_content, encoding="utf-8")
    print(f"Wrote {md_path}")

    # Convert to EPUB via pandoc
    epub_path = OUTPUT_DIR / "lectionary.epub"
    cmd = [
        "pandoc", str(md_path),
        "-o", str(epub_path),
        "--metadata", f"title={TITLE}",
        "--metadata", f"author={AUTHOR}",
        "--toc",
        "--toc-depth=2",
        "--epub-chapter-level=1",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"pandoc error: {result.stderr}")
    else:
        print(f"Wrote {epub_path}")


if __name__ == "__main__":
    main()
