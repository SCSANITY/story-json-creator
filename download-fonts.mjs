/**
 * download-fonts.mjs
 * Downloads all Google Fonts used by the app into assets/fonts/
 * Run once: node download-fonts.mjs
 */

import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "assets", "fonts");

// All font families to download (name + weights/styles needed)
const FONT_FAMILIES = [
  // ── Existing fonts ──────────────────────────────────────────────────────────
  "Playfair+Display:ital,wght@0,400;0,700;1,400",
  "Cinzel:wght@400;700",
  "Abril+Fatface",
  "Cormorant+Garamond:ital,wght@0,400;0,700;1,400",
  "Righteous",
  "Pacifico",
  "Dancing+Script:wght@400;700",
  "Satisfy",
  "Lora:ital,wght@0,400;0,700;1,400",
  "Merriweather:ital,wght@0,400;0,700;1,400",

  // ── Fantasy / Storybook ─────────────────────────────────────────────────────
  "Uncial+Antiqua",           // Celtic / medieval manuscript
  "MedievalSharp",            // Sharp gothic
  "Jim+Nightshade",           // Dark fairy-tale swash

  // ── Cute / Children's book ──────────────────────────────────────────────────
  "Fredoka+One",              // Rounded friendly — most popular kids font
  "Chewy",                    // Playful bounce
  "Bubblegum+Sans",           // Bubbly cute
  "Boogaloo",                 // Fun casual
  "Lilita+One",               // Bold rounded impact
  "Baloo+2:wght@400;700",     // Friendly bold multilingual

  // ── Calligraphy / Script ────────────────────────────────────────────────────
  "Great+Vibes",              // Elegant thin calligraphy
  "Kaushan+Script",           // Handwritten artistic flair
  "Lobster",                  // Retro rounded script
  "Sacramento",               // Thin flowing calligraphy
  "Alex+Brush",               // Delicate brush script

  // ── Bold Display / Impact ───────────────────────────────────────────────────
  "Bebas+Neue",               // Strong all-caps modern
  "Yeseva+One",               // Bold decorative serif
  "Titan+One",                // Extra-fat rounded display

  // ── Classic / Literary ──────────────────────────────────────────────────────
  "Philosopher:ital,wght@0,400;0,700;1,400",  // Elegant humanist serif
  "IM+Fell+English:ital@0;1",                 // Old English typeface style

  // ── Title Display / 大标题专用 ──────────────────────────────────────────────
  "Cinzel+Decorative:wght@400;900",   // Ornate Roman caps (more ornate than Cinzel)
  "UnifrakturMaguntia",               // Blackletter / Gothic
  "Pirata+One",                       // Pirate / adventure
  "Rye",                              // Wild West vintage poster
  "Skranji",                          // Nordic / runic
  "Metamorphous",                     // Medieval / Renaissance
  "Rozha+One",                        // High-contrast display serif
  "Oswald:wght@400;700",              // Bold condensed sans
  "Russo+One",                        // Geometric bold
  "Raleway:wght@400;700",             // Elegant geometric sans
  "Bangers",                          // Comic book impact
  "Poiret+One",                       // Art Deco
  "Anton",                            // Ultra condensed bold
  "Orbitron:wght@400;700",            // Futuristic geometric circles
  "Press+Start+2P",                   // Pixel / retro game
  "Permanent+Marker",                 // Bold casual handwritten marker
  "Black+Ops+One",                    // Military stencil
  "Alfa+Slab+One",                    // Bold slab serif
  "Italiana",                         // Italian editorial thin elegant
  "Fugaz+One",                        // Bold italic display
  "Luckiest+Guy",                     // Vintage cartoon bold (children's book classic)
  "Nunito:wght@700;900",              // Rounded geometric sans
  "Poppins:wght@400;700",             // #1 most downloaded Google Font
  "Passion+One",                      // Rounded bold condensed
  "Rammetto+One",                     // Bubble-style bold display
  "Amatic+SC:wght@400;700",           // Tall handwritten caps (all letters consistent)
  "Caveat:wght@400;700",              // Casual friendly handwritten
  "Gloria+Hallelujah",                // Thick expressive marker
  "Josefin+Sans:wght@400;700",        // Geometric elegant
  "Comfortaa:wght@400;700",           // Geometric rounded
];

// Browser UA needed to receive woff2 responses from Google Fonts
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    const req = get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      process.stdout.write(`  skip (exists): ${path.basename(dest)}\n`);
      resolve();
      return;
    }
    const get = url.startsWith("https") ? https.get : http.get;
    const req = get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        process.stdout.write(`  downloaded: ${path.basename(dest)}\n`);
        resolve();
      });
      file.on("error", reject);
    });
    req.on("error", reject);
  });
}

// Parse @font-face blocks from Google Fonts CSS
function parseFontFaces(css) {
  const faces = [];
  const regex = /@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = regex.exec(css)) !== null) {
    const block = m[1];
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
    const style = (block.match(/font-style:\s*(\w+)/) || [])[1] || "normal";
    const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1] || "400";
    const src = (block.match(/src:[^;]+url\(([^)]+)\)/) || [])[1];
    const subset = (block.match(/\/\*\s*([^*]+)\s*\*\//) || [])[1]?.trim() || "latin";
    if (family && src) faces.push({ family, style, weight, src, subset });
  }
  return faces;
}

function cssFileName(face) {
  // e.g. "Great Vibes" italic 700 latin → GreatVibes-italic-700-latin.woff2
  const fam = face.family.replace(/\s+/g, "");
  return `${fam}-${face.style}-${face.weight}-${face.subset}.woff2`;
}

async function main() {
  fs.mkdirSync(FONTS_DIR, { recursive: true });

  const allFaces = [];

  for (const family of FONT_FAMILIES) {
    const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    console.log(`\nFetching CSS: ${family}`);
    let css;
    try {
      css = await fetchText(url);
    } catch (e) {
      console.warn(`  WARN: Could not fetch ${family} — ${e.message}`);
      continue;
    }
    const faces = parseFontFaces(css);
    console.log(`  Found ${faces.length} @font-face blocks`);
    allFaces.push(...faces);
  }

  // Download only latin + latin-ext subsets to keep size reasonable
  const relevantFaces = allFaces.filter(
    (f) => f.subset === "latin" || f.subset === "latin-ext"
  );

  console.log(`\nDownloading ${relevantFaces.length} font files to assets/fonts/ …\n`);

  for (const face of relevantFaces) {
    const fileName = cssFileName(face);
    const dest = path.join(FONTS_DIR, fileName);
    try {
      await downloadFile(face.src, dest);
    } catch (e) {
      console.warn(`  WARN: Failed to download ${face.src} — ${e.message}`);
    }
  }

  // Generate fonts.css
  const cssLines = [];
  const seen = new Set();
  for (const face of relevantFaces) {
    const fileName = cssFileName(face);
    const key = fileName;
    if (seen.has(key)) continue;
    seen.add(key);
    cssLines.push(`@font-face {
  font-family: '${face.family}';
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
  src: url('./fonts/${fileName}') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`);
  }

  const cssDest = path.join(__dirname, "assets", "fonts.css");
  fs.writeFileSync(cssDest, cssLines.join("\n\n") + "\n");
  console.log(`\n✓ Generated assets/fonts.css (${seen.size} faces)`);
  console.log("✓ Done! Now update index.html to load assets/fonts.css instead of Google Fonts CDN.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
