/**
 * add-custom-fonts.mjs
 * Scans assets/fonts/custom/ for TTF/OTF files and generates assets/custom-fonts.css
 * Run after dropping new font files into assets/fonts/custom/:
 *   node add-custom-fonts.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_DIR = path.join(__dirname, "assets", "fonts", "custom");
const CSS_OUT = path.join(__dirname, "assets", "custom-fonts.css");

// Map filename weight hints → CSS font-weight values
const WEIGHT_KEYWORDS = [
  { re: /thin/i,        w: 100 },
  { re: /extralight/i,  w: 200 },
  { re: /extra.light/i, w: 200 },
  { re: /ultralight/i,  w: 200 },
  { re: /light/i,       w: 300 },
  { re: /medium/i,      w: 500 },
  { re: /semibold/i,    w: 600 },
  { re: /semi.bold/i,   w: 600 },
  { re: /demibold/i,    w: 600 },
  { re: /extrabold/i,   w: 800 },
  { re: /extra.bold/i,  w: 800 },
  { re: /ultrabold/i,   w: 800 },
  { re: /black/i,       w: 900 },
  { re: /heavy/i,       w: 900 },
  { re: /bold/i,        w: 700 },
  { re: /regular/i,     w: 400 },
  { re: /roman/i,       w: 400 },
];

const ITALIC_RE = /italic|oblique|slanted/i;

function parseFontFile(filename) {
  const base = path.basename(filename, path.extname(filename));

  // Detect italic
  const isItalic = ITALIC_RE.test(base);

  // Detect weight
  let weight = 400;
  for (const { re, w } of WEIGHT_KEYWORDS) {
    if (re.test(base)) { weight = w; break; }
  }

  // Guess family name: everything before the first weight/style keyword
  // e.g. "ClashDisplay-Bold" → "Clash Display"
  //      "Tanker-Regular" → "Tanker"
  const cleaned = base
    .replace(/[-_]/g, " ")
    .replace(/\b(thin|extra\s*light|ultra\s*light|light|medium|semi\s*bold|demi\s*bold|extra\s*bold|ultra\s*bold|bold|black|heavy|regular|roman|italic|oblique|slanted|variable)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalise each word
  const family = cleaned.replace(/\b\w/g, c => c.toUpperCase()) || base;

  return { family, weight, style: isItalic ? "italic" : "normal" };
}

function formatExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".ttf") return "truetype";
  if (ext === ".otf") return "opentype";
  if (ext === ".woff2") return "woff2";
  if (ext === ".woff") return "woff";
  return "truetype";
}

function main() {
  if (!fs.existsSync(CUSTOM_DIR)) {
    console.log(`No custom fonts directory found at:\n  ${CUSTOM_DIR}`);
    console.log("Create it and drop your TTF/OTF files inside, then re-run.");
    process.exit(0);
  }

  const files = fs.readdirSync(CUSTOM_DIR)
    .filter(f => /\.(ttf|otf|woff2|woff)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log("No font files found in assets/fonts/custom/");
    console.log("Drop .ttf or .otf files there and re-run.");
    process.exit(0);
  }

  console.log(`Found ${files.length} font file(s):\n`);

  const cssBlocks = [];
  const families = new Map(); // family → [{ weight, style }]

  for (const file of files) {
    const { family, weight, style } = parseFontFile(file);
    const format = formatExt(file);
    const relativePath = `./fonts/custom/${file}`;

    console.log(`  ${file}`);
    console.log(`    → family: "${family}"  weight: ${weight}  style: ${style}`);

    cssBlocks.push(
`@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('${relativePath}') format('${format}');
}`
    );

    if (!families.has(family)) families.set(family, []);
    families.get(family).push({ weight, style });
  }

  fs.writeFileSync(CSS_OUT, cssBlocks.join("\n\n") + "\n");
  console.log(`\n✓ Generated assets/custom-fonts.css (${cssBlocks.length} @font-face blocks)\n`);

  console.log("─────────────────────────────────────────────");
  console.log("Next: tell Claude which group each font below belongs to,");
  console.log("and it will add them to FONT_OPTIONS + rebuild.\n");

  for (const [family, variants] of families) {
    const weights = [...new Set(variants.map(v => v.weight))].sort().join(", ");
    const hasItalic = variants.some(v => v.style === "italic");
    console.log(`  Font: "${family}"`);
    console.log(`    Weights available: ${weights}${hasItalic ? "  + italic" : ""}`);
    console.log(`    FONT_OPTIONS value: "'${family}', serif"  (adjust serif/sans-serif/cursive as needed)`);
    console.log();
  }
}

main();
