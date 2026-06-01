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
  // ── 📖 Classic Serif ─────────────────────────────────────────────────────────
  "Lora:ital,wght@0,400;0,700;1,400",                // Warm balanced narrative serif
  "EB+Garamond:ital,wght@0,400;0,700;1,400",         // Timeless classic Garamond
  "Cormorant+Garamond:ital,wght@0,400;0,700;1,400",  // Ornate luxury high-contrast
  "Fraunces:ital,wght@0,400;0,700;1,400",            // Optical personality serif

  // ── ✨ Elegant Display ────────────────────────────────────────────────────────
  "Cinzel:wght@400;700",                              // Roman grand engraving
  "Cinzel+Decorative:wght@400;900",                  // More ornate Cinzel variant
  "Playfair+Display:ital,wght@0,400;0,700;1,400",    // Premium editorial serif
  "Bodoni+Moda:ital,wght@0,400;0,700;1,400",         // High fashion editorial
  "Josefin+Sans:wght@400;700",                        // Clean metallic all-caps sans
  "Italiana",                                         // Ultra thin elegant italic serif
  "Yeseva+One",                                       // Stylized bold display serif

  // ── 🎨 Modern Design ─────────────────────────────────────────────────────────
  "Montserrat:wght@400;600;700;900",                  // Canva #1 global font
  "Poppins:wght@400;600;700",                         // Canva geometric sans favourite
  "Raleway:wght@400;600;700",                         // Elegant geometric brand sans
  "Space+Grotesk:wght@400;500;700",                   // Modern editorial sans
  "Syne:wght@400;700;800",                            // Experimental display sans
  "Unbounded:wght@400;700",                           // Modern rounded display
  "Outfit:wght@400;600;700",                          // Contemporary geometric sans


  // ── 🎪 Bold Title ─────────────────────────────────────────────────────────────
  "Ultra",                                            // Mega-thick slab serif
  "DM+Serif+Display:ital,wght@0,400;1,400",          // High-contrast modern serif
  "Poiret+One",                                       // Art Deco geometric elegant
  "Abril+Fatface",                                    // High-contrast impact display
  "Russo+One",                                        // Bold condensed modern
  "Lobster+Two:ital,wght@0,400;1,400",               // Classic Lobster variant
  "Pacifico",                                         // Casual round brush display


  // ── 🚀 Space & Tech ───────────────────────────────────────────────────────────
  "Orbitron:wght@400;700",                            // Quintessential space font
  "Rajdhani:wght@400;600;700",                        // Condensed tech all-caps

  // ── 🧒 Cute & Rounded ─────────────────────────────────────────────────────────
  "Quicksand:wght@400;600;700",                       // Soft rounded sans
  "Fredoka+One",                                      // Rounded friendly kids
  "Chewy",                                            // Playful bounce
  "Boogaloo",                                         // Fun casual
  "Varela+Round",                                     // Modern clean rounded sans
  "Bubblegum+Sans",                                   // Cute bold display


  // ── 🔤 Unique & Artistic ──────────────────────────────────────────────────────
  "UnifrakturMaguntia",                               // Blackletter / Gothic
  "Permanent+Marker",                                 // Bold casual marker
  "Cabin+Sketch",                                     // Sketch outline hand-drawn
  "Inknut+Antiqua:wght@400;700",                      // Historical carved ornate serif

  // ── ✍️ Script & Calligraphy ────────────────────────────────────────────────────
  "Kaushan+Script",                                   // Bold upright script display
  "Tangerine:wght@400;700",                           // Hairline elegant calligraphy
  "Satisfy",                                          // Smooth signature style
  "Caveat:wght@400;700",                              // Non-connecting modern handwriting


  // ── 📖 Extra Serif ────────────────────────────────────────────────────────────
  "Spectral:ital,wght@0,400;0,700;1,400",            // Premium editorial serif

  // ── 🌿 Ornate All-Case — 大小写都有装饰感 ────────────────────────────────────
  "IM+Fell+English:ital,wght@0,400;1,400",           // Historical quill-pen (both cases)
  "Almendra:ital,wght@0,400;0,700;1,400",            // kept for CSS only
  "Philosopher:ital,wght@0,400;0,700;1,400;1,700",   // kept for CSS only
  "Crimson+Text:ital,wght@0,400;0,600;1,400",        // kept for CSS only

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
