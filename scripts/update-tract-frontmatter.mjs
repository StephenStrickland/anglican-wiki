import { readFileSync, writeFileSync } from "fs";
import { globSync } from "fs";

// Gather all tract files
const files = [
  ...globSync("src/content/docs/tracts/tract*.md"),
  ...globSync("src/content/docs/tracts/tract*/index.md"),
];

// Non-numbered files to skip
const skipFiles = ["index.md", "advertisement.md", "americanintro.md"];

let updated = 0;

for (const file of files) {
  const basename = file.split("/").pop();

  // Skip non-tract files
  if (skipFiles.includes(basename)) {
    // But allow index.md inside tractN/ directories
    if (basename === "index.md" && /tract\d+/.test(file)) {
      // proceed
    } else {
      continue;
    }
  }

  const content = readFileSync(file, "utf-8");

  // Split frontmatter from body
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    console.log(`SKIP (no frontmatter): ${file}`);
    continue;
  }

  const frontmatter = match[1];
  const body = match[2];

  // Extract tract number from filename
  const numMatch = file.match(/tract(\d+)/);
  if (!numMatch) {
    console.log(`SKIP (no tract number): ${file}`);
    continue;
  }
  const tractNum = parseInt(numMatch[1], 10);

  // Special case: tract 2 — only fix sidebar.order
  if (tractNum === 2) {
    const newFrontmatter = frontmatter.replace(
      /^(\s*order:\s*)2\s*$/m,
      "$14"
    );
    if (newFrontmatter !== frontmatter) {
      writeFileSync(file, `---\n${newFrontmatter}\n---\n${body}`);
      console.log(`UPDATED (order only): ${file}`);
      updated++;
    } else {
      console.log(`SKIP (tract 2 already correct): ${file}`);
    }
    continue;
  }

  // Extract short title from sidebar.label
  const labelMatch = frontmatter.match(
    /label:\s*["']#\d+\s*-\s*(.*?)(?:\.{3})?["']/
  );
  if (!labelMatch) {
    console.log(`SKIP (no label match): ${file}`);
    continue;
  }
  const shortTitle = labelMatch[1].trim();

  const newTitleValue = `"Tract ${tractNum}: ${shortTitle}"`;
  const newLabelValue = `"Tract ${tractNum}: ${shortTitle}"`;

  // Replace title line
  let newFrontmatter = frontmatter.replace(
    /^title:\s*.+$/m,
    `title: ${newTitleValue}`
  );

  // Replace sidebar.label line
  newFrontmatter = newFrontmatter.replace(
    /^(\s*label:\s*).+$/m,
    `$1${newLabelValue}`
  );

  if (newFrontmatter !== frontmatter) {
    writeFileSync(file, `---\n${newFrontmatter}\n---\n${body}`);
    console.log(`UPDATED: ${file} → Tract ${tractNum}: ${shortTitle}`);
    updated++;
  } else {
    console.log(`SKIP (no changes): ${file}`);
  }
}

console.log(`\nDone. Updated ${updated} files.`);
