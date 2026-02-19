import { readFileSync, writeFileSync } from "fs";
import { globSync } from "fs";

// Authoritative tract data from Wikipedia "Tracts for the Times" table.
// Only tracts that need changes are listed here.
// Fields: title (after "Tract N: "), subtitle (optional), author (optional override), sidebarLabel (optional override)
const tractData = {
  3: {
    title: "Thoughts respectfully addressed to the Clergy on alterations in the Liturgy. The Burial Service. The Principle of Unity.",
  },
  4: {
    title: "Adherence to the Apostolical Succession the Safest Course. On Alterations in the Prayer-book.",
  },
  6: {
    title: "The Present Obligation of Primitive Practice. A Sin of the Church.",
  },
  9: {
    author: "Hurrell Froude",
  },
  10: {
    title: "Heads of a Week-day lecture, delivered to a country congregation in -------shire.",
  },
  11: {
    title: "The Visible Church",
    subtitle: "In Letters to a Friend.",
  },
  12: {
    title: "Bishops, Priests, and Deacons. Richard Nelson. No. 1",
  },
  15: {
    author: "William Palmer, completed by Newman",
  },
  18: {
    title: "Thoughts on the Benefits of the System of Fasting Enjoined by Our Church",
  },
  19: {
    title: "On arguing concerning the Apostolical Succession. On Reluctance to confess the Apostolical Succession.",
  },
  22: {
    title: "The Athanasian Creed. Richard Nelson. No. II.",
  },
  25: {
    title: "The Great Necessity and Advantage of Public Prayer",
    subtitle: null, // remove subtitle
  },
  27: {
    title: "The History of Popish Transubstantiation",
  },
  28: {
    title: "The same, concluded.",
    subtitle: null, // remove subtitle
  },
  29: {
    title: "Christian Liberty; Or, Why Should We Belong to the Church of England?",
    subtitle: "By a Layman.",
  },
  32: {
    title: "On the Standing Ordinances of Religion",
  },
  40: {
    title: "Baptism. Richard Nelson III.",
  },
  43: {
    title: "Length of the Public Service. Richard Nelson. No. IV.",
  },
  44: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. II, Monday.",
  },
  46: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. III, Tuesday.",
  },
  48: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. IV, Wednesday.",
  },
  50: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. IV, Wednesday (continued).",
  },
  52: {
    title: "Sermons for Saints' Days and Holidays. No. 1, St. Matthias.",
  },
  53: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. V, Thursday.",
  },
  54: {
    title: "Sermons for Saints' Days and Holidays. No. 2, The Annunciation of the Blessed Virgin Mary.",
  },
  55: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. V, Thursday (continued)",
  },
  56: {
    title: "Holy Days observed in the English Church",
  },
  57: {
    title: "Sermons on Saints' Days. No. 3, St Mark's Day.",
  },
  58: {
    title: "On the Church as viewed by Faith and by the World",
  },
  59: {
    title: "The position of the Church of Christ in England, relatively to the State and the Nation.",
    author: "Hurrell Froude",
  },
  60: {
    title: "Sermons for Saints' Days and Holidays. No. 4. St. Philip and St. James.",
  },
  61: {
    title: "The Catholic Church a Witness against Illiberality",
  },
  62: {
    title: "Bishop Wilson's Meditations on his Sacred Office. No. V, Thursday (continued)",
  },
  63: {
    title: "The Antiquity of the existing Liturgies",
    author: "Hurrell Froude",
  },
  66: {
    title: "On the Benefits of the System of Fasting Prescribed by Our Church. Supplement to Tract XVIII",
  },
  71: {
    title: "On the Controversy with the Romanists (No. I, Against Romanism)",
  },
  72: {
    title: "Archbishop Ussher on Prayers for the Dead (No. II, Against Romanism)",
  },
  73: {
    title: "On the Introduction of Rationalistic Principles into Religion",
  },
  74: {
    title: "Catena Patrum No. I. Testimony of Writers in the later English Church to the Doctrine of the Apostolical Succession",
  },
  75: {
    title: "On the Roman Breviary as embodying the substance of the Devotional Services of the Church Catholic",
  },
  76: {
    title: "Catena Patrum No. II. Testimony of Writers in the later English Church to the Doctrine of Baptismal Regeneration",
  },
  78: {
    title: "Catena Patrum. No. III. Testimony of Writers in the later English Church to the duty of maintaining, Quod semper, quod ubique, quod ab omnibus traditum est.",
    author: "Henry Edward Manning and Charles Marriott",
  },
  79: {
    title: "On Purgatory (Against Romanism, No. III)",
  },
  80: {
    title: "On Reserve in communicating Religious Knowledge, Parts I-III",
  },
  81: {
    title: "Catena Patrum. No. IV. Testimony of Writers in the later English Church to the doctrine of the Eucharistic Sacrifice",
  },
  82: {
    title: "Preface, Title-Page, and Contents to Volume IV",
  },
  84: {
    title: "Whether a Clergyman of the Church of England be now bound to have Morning and Evening Prayers daily in his Parish Church",
  },
  86: {
    title: "Indications of a Superintending Providence in the Preservation of the Prayer Book and in the Changes which It has Undergone",
  },
  87: {
    title: "On Reserve in communicating Religious Knowledge (conclusion)",
  },
  88: {
    title: "The Greek Devotions of Bishop Andrews, translated and arranged",
  },
  89: {
    title: "On the Mysticism Attributed to the Fathers of the Church",
  },
  90: {
    title: "Remarks on Certain Passages in the Thirty-Nine Articles",
  },
  91: {
    title: "The Articles of Religion from an American Point of View",
  },
};

// Generate sidebar label: "Tract N: title", truncated at ~60 chars with "..."
function makeSidebarLabel(tractNum, title) {
  const full = `Tract ${tractNum}: ${title}`;
  if (full.length <= 60) return full;
  return full.slice(0, 57) + "...";
}

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

  let frontmatter = match[1];
  const body = match[2];

  // Extract tract number from filename
  const numMatch = file.match(/tract(\d+)/);
  if (!numMatch) {
    console.log(`SKIP (no tract number): ${file}`);
    continue;
  }
  const tractNum = parseInt(numMatch[1], 10);

  const data = tractData[tractNum];
  if (!data) {
    console.log(`SKIP (no changes needed): ${file}`);
    continue;
  }

  let changed = false;

  // Update title
  if (data.title !== undefined) {
    const fullTitle = `Tract ${tractNum}: ${data.title}`;
    const newTitleLine = `title: "${fullTitle}"`;
    const newFrontmatter = frontmatter.replace(/^title:\s*.+$/m, newTitleLine);
    if (newFrontmatter !== frontmatter) {
      frontmatter = newFrontmatter;
      changed = true;
    }

    // Update sidebar label
    const label = makeSidebarLabel(tractNum, data.title);
    const newLabelLine = `  label: "${label}"`;
    const newFm2 = frontmatter.replace(/^\s*label:\s*.+$/m, newLabelLine);
    if (newFm2 !== frontmatter) {
      frontmatter = newFm2;
      changed = true;
    }
  }

  // Update subtitle
  if (data.subtitle !== undefined) {
    if (data.subtitle === null) {
      // Remove subtitle line
      const newFm = frontmatter.replace(/^subtt?itle:\s*.+\n?/m, "");
      if (newFm !== frontmatter) {
        frontmatter = newFm;
        changed = true;
      }
    } else {
      // Set or replace subtitle
      if (/^subtt?itle:/m.test(frontmatter)) {
        const newFm = frontmatter.replace(
          /^subtt?itle:\s*.+$/m,
          `subtitle: "${data.subtitle}"`
        );
        if (newFm !== frontmatter) {
          frontmatter = newFm;
          changed = true;
        }
      } else {
        // Add subtitle after title line
        frontmatter = frontmatter.replace(
          /^(title:\s*.+)$/m,
          `$1\nsubtitle: "${data.subtitle}"`
        );
        changed = true;
      }
    }
  }

  // Update author
  if (data.author !== undefined) {
    const newAuthorLine = `author: "${data.author}"`;
    const newFm = frontmatter.replace(/^author:\s*.+$/m, newAuthorLine);
    if (newFm !== frontmatter) {
      frontmatter = newFm;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(file, `---\n${frontmatter}\n---\n${body}`);
    console.log(`UPDATED: ${file}`);
    updated++;
  } else {
    console.log(`SKIP (no actual changes): ${file}`);
  }
}

console.log(`\nDone. Updated ${updated} files.`);
