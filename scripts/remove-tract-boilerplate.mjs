import { readFileSync, writeFileSync } from "fs";
import { globSync } from "fs";

const dryRun = process.argv.includes("--dry-run");

// Gather all tract files
const files = [
  ...globSync("src/content/docs/tracts/tract*.md"),
  ...globSync("src/content/docs/tracts/tract*/*.md"),
  ...globSync("src/content/docs/tracts/advertisement.md"),
];

// Deduplicate
const unique = [...new Set(files)].sort();

// Already-clean files (hand-edited)
const skipPaths = [
  "tract1.md",
  "tract2.md",
  "tract3.md",
  "tract4.md",
  "tract5.md",
  "tract6.md",
  "tract7.md",
  "tract8.md",
  "tract9.md",
  "tract88/index.md",
];

function shouldSkip(file) {
  return skipPaths.some((s) => file.endsWith(s));
}

// Is line all-caps text (title line)? Must be mostly uppercase letters.
function isAllCapsTitle(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return false;
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  return upperCount >= 3 && upperCount / letters.length >= 0.6;
}

// Is this a boilerplate line that should be removed?
// This is only used within the boilerplate section (before we see clear content).
function isBoilerplateLine(line) {
  const trimmed = line.trim();

  if (trimmed === "") return true;
  if (trimmed === "Tracts for the Times") return true;
  if (/^TRACT NO\.\s/i.test(trimmed)) return true;
  if (/^\\?\[Number\s+\d+\\?\]$/.test(trimmed)) return true;
  if (trimmed === "---") return true;
  if (isAllCapsTitle(trimmed)) return true;
  if (/^(?:\()?No\.\s+[IVXLCDM\d]+/i.test(trimmed)) return true;
  if (/^by\s+[A-Z]/.test(trimmed)) return true;
  if (trimmed === "BY") return true;
  if (/^\*BY\s/.test(trimmed)) return true;
  if (/^\*\((?:Continued|Concluded)\.?\)\*$/.test(trimmed)) return true;
  if (/^\d{4}$/.test(trimmed)) return true;
  if (/^\\?\[Reprinted from/.test(trimmed)) return true;
  if (/^transcribed by\s/i.test(trimmed)) return true;
  if (/^AD\s+\d{4}$/.test(trimmed)) return true;
  if (/^\\?\[pp\s?\d/.test(trimmed)) return true;
  if (trimmed === "I have set watchmen upon thy walls, O Jerusalem;") return true;
  if (trimmed === "Which shall never hold their peace day nor night.") return true;
  // "(*By Author Name*)" style attribution
  if (/^\(\*By\s/.test(trimmed)) return true;
  // "BY A LAYMAN" (without asterisks)
  if (/^BY\s+A\s+/i.test(trimmed)) return true;
  // "OR," as standalone title continuation
  if (trimmed === "OR,") return true;

  return false;
}

// After a --- separator, only these specific patterns should cause the script
// to keep consuming (i.e., treating the --- as internal to boilerplate).
// General all-caps titles are NOT included here because after a --- they are
// more likely to be content headings (e.g. "SERMON I.", "CHURCH DISCIPLINE.").
function isSpecificBoilerplateAfterSeparator(line) {
  const trimmed = line.trim();
  if (trimmed === "") return true;
  if (/^\\?\[Number\s+\d+\\?\]$/.test(trimmed)) return true;
  if (/^by\s+[A-Z]/.test(trimmed)) return true;
  if (trimmed === "BY") return true;
  if (/^\*BY\s/.test(trimmed)) return true;
  if (/^BY\s+A\s+/i.test(trimmed)) return true;
  if (/^\*\((?:Continued|Concluded)\.?\)\*$/.test(trimmed)) return true;
  if (/^\(\*By\s/.test(trimmed)) return true;
  return false;
}

// Detect lines that are definitely real content and should never be removed.
function isDefiniteContent(line) {
  const trimmed = line.trim();
  if (trimmed === "") return false;

  // Blockquote — always real content
  if (trimmed.startsWith(">")) return true;

  // Numbered list item (like "1. " or "1\. ")
  if (/^\d+\\?\.\s/.test(trimmed)) return true;

  // Markdown heading
  if (/^#{1,6}\s/.test(trimmed)) return true;

  // HTML tags
  if (/^</.test(trimmed)) return true;

  // Section markers
  if (/^§/.test(trimmed)) return true;

  // A long line that is NOT all-caps is definitely content
  if (trimmed.length > 60 && !isAllCapsTitle(trimmed)) return true;

  // Mixed-case text longer than 20 chars that doesn't match boilerplate
  if (
    /^[A-Z]/.test(trimmed) &&
    trimmed.length > 20 &&
    !isAllCapsTitle(trimmed) &&
    !isBoilerplateLine(trimmed)
  ) {
    return true;
  }

  return false;
}

let cleaned = 0;
let skipped = 0;
let alreadyClean = 0;

for (const file of unique) {
  if (shouldSkip(file)) {
    if (dryRun) console.log(`SKIP (already clean): ${file}`);
    skipped++;
    continue;
  }

  if (file.endsWith("index.md") && !file.includes("tract")) {
    skipped++;
    continue;
  }
  if (file.endsWith("americanintro.md")) {
    skipped++;
    continue;
  }

  const content = readFileSync(file, "utf-8");

  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    console.log(`SKIP (no frontmatter): ${file}`);
    skipped++;
    continue;
  }

  const frontmatter = match[1];
  const body = match[2];

  if (
    !body.includes("Tracts for the Times") &&
    !body.includes("TRACT NO.")
  ) {
    if (dryRun) console.log(`SKIP (no boilerplate found): ${file}`);
    alreadyClean++;
    continue;
  }

  const lines = body.split("\n");

  // Strategy: scan forward removing boilerplate lines. When we hit a ---
  // separator, look ahead: if what follows (after blank lines) is more
  // boilerplate, keep consuming. If what follows is real content, stop.
  // This handles files like tract29/30 that have multiple --- separators
  // within the boilerplate section.
  let contentStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Check for definite content first (blockquotes, long mixed-case, etc.)
    if (isDefiniteContent(lines[i])) {
      contentStartIndex = i;
      break;
    }

    // --- separator: look ahead to decide if boilerplate continues
    if (trimmed === "---") {
      // Find next non-blank line
      let nextNonBlank = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== "") {
          nextNonBlank = j;
          break;
        }
      }
      if (nextNonBlank === -1) {
        contentStartIndex = lines.length;
        break;
      }
      // If the next non-blank line is definite content, stop AFTER this ---
      if (isDefiniteContent(lines[nextNonBlank])) {
        contentStartIndex = nextNonBlank;
        break;
      }
      // After a ---, only continue consuming if the next line is a SPECIFIC
      // boilerplate marker (not a general all-caps title, which could be
      // content like "SERMON I." or section headings).
      if (isSpecificBoilerplateAfterSeparator(lines[nextNonBlank])) {
        continue;
      }
      // Otherwise, treat --- as the end of boilerplate
      contentStartIndex = nextNonBlank;
      break;
    }

    // Check if it's a boilerplate line
    if (isBoilerplateLine(lines[i])) {
      continue;
    }

    // Unknown line — stop here, keep it
    contentStartIndex = i;
    break;
  }

  // If we consumed everything (unlikely), set to end
  if (contentStartIndex === 0 && lines.length > 0 && lines[0].trim() === "") {
    // Edge case: the loop might not have set contentStartIndex if the first
    // non-blank line was boilerplate but the loop ended without finding content.
    // Fall through to the removal logic — the "only blank lines" check below
    // will catch if nothing meaningful was removed.
  }

  const removedLines = lines.slice(0, contentStartIndex);
  const keptLines = lines.slice(contentStartIndex);

  // Trim leading blank lines from kept content
  while (keptLines.length > 0 && keptLines[0].trim() === "") {
    keptLines.shift();
  }

  if (removedLines.every((l) => l.trim() === "")) {
    if (dryRun) console.log(`SKIP (only blank lines before content): ${file}`);
    alreadyClean++;
    continue;
  }

  const newBody = "\n" + keptLines.join("\n");
  const newContent = `---\n${frontmatter}\n---\n${newBody}`;

  if (dryRun) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`WOULD CLEAN: ${file}`);
    console.log(`REMOVING (${removedLines.length} lines):`);
    for (const line of removedLines) {
      console.log(`  - ${JSON.stringify(line)}`);
    }
    console.log(`FIRST KEPT LINE: ${JSON.stringify(keptLines[0] || "(empty)")}`);
  } else {
    writeFileSync(file, newContent);
    console.log(`CLEANED: ${file}`);
  }

  cleaned++;
}

console.log(
  `\nDone. ${dryRun ? "Would clean" : "Cleaned"}: ${cleaned}, Skipped: ${skipped}, Already clean: ${alreadyClean}`
);
