import { useState, useRef, useCallback, useEffect, useMemo } from "react";
// Static import (NOT lazy): a lazy chunk is fetched only when the user clicks batch-export,
// and we redeploy often — after any redeploy the old hashed chunk 404s for every already-open
// session, silently breaking the ZIP download. Bundling it (~30KB gzip) removes that whole
// failure class.
import JSZip from "jszip";

// Zoom is the absolute scale (1 = 100% = 1:1 with exported pixels). Multiplicative steps so the
// range from "fit a 5000px page" (~6%) to inspecting at 200% feels smooth.
const ZOOM_MIN = 0.04;
const ZOOM_MAX = 2;
const ZOOM_STEP = 1.25;
const MIN_BOX_WIDTH = 220;
const MIN_BOX_HEIGHT = 90;

const copyToClipboard = async (text) => {
  if (typeof window !== "undefined" && window.templateEditorDesktop?.copyText) {
    window.templateEditorDesktop.copyText(text);
    return;
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const FONT_OPTIONS = [
  // ── 📖 Classic Serif — 故事书衬线 ────────────────────────────────────────────
  { label: "Lora",               value: "'Lora', serif",               group: "serif" },
  { label: "EB Garamond",        value: "'EB Garamond', serif",        group: "serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif", group: "serif" },
  { label: "Fraunces",           value: "'Fraunces', serif",           group: "serif" },
  { label: "DM Serif Display",   value: "'DM Serif Display', serif",   group: "serif" },
  { label: "Spectral",           value: "'Spectral', serif",           group: "serif" },
  { label: "IM Fell English",    value: "'IM Fell English', serif",    group: "serif" },
  { label: "Gambetta",           value: "'Gambetta', serif",           group: "serif" },

  // ── 🎨 Modern Design — 设计感 ────────────────────────────────────────────────
  { label: "Montserrat",         value: "'Montserrat', sans-serif",    group: "modern" },
  { label: "Poppins",            value: "'Poppins', sans-serif",       group: "modern" },
  { label: "Raleway",            value: "'Raleway', sans-serif",       group: "modern" },
  { label: "Space Grotesk",      value: "'Space Grotesk', sans-serif", group: "modern" },
  { label: "Syne",               value: "'Syne', sans-serif",          group: "modern" },
  { label: "Unbounded",          value: "'Unbounded', sans-serif",     group: "modern" },
  { label: "Outfit",             value: "'Outfit', sans-serif",        group: "modern" },

  // ── ✨ Elegant Display — 典雅大标题 ───────────────────────────────────────────
  { label: "Cinzel",             value: "'Cinzel', serif",             group: "elegant" },
  { label: "Cinzel Decorative",  value: "'Cinzel Decorative', serif",  group: "elegant" },
  { label: "Playfair Display",   value: "'Playfair Display', serif",   group: "elegant" },
  { label: "Bodoni Moda",        value: "'Bodoni Moda', serif",        group: "elegant" },
  { label: "Josefin Sans",       value: "'Josefin Sans', sans-serif",  group: "elegant" },
  { label: "Italiana",           value: "'Italiana', serif",           group: "elegant" },
  { label: "Yeseva One",         value: "'Yeseva One', cursive",       group: "elegant" },
  { label: "Poiret One",         value: "'Poiret One', cursive",       group: "elegant" },
  { label: "Boska",              value: "'Boska', serif",              group: "elegant" },
  { label: "Zodiak",             value: "'Zodiak', serif",             group: "elegant" },

  // ── 🎪 Bold Title — 冲击标题字 ───────────────────────────────────────────────
  { label: "Ultra",              value: "'Ultra', serif",              group: "title" },
  { label: "Abril Fatface",      value: "'Abril Fatface', cursive",    group: "title" },
  { label: "Russo One",          value: "'Russo One', sans-serif",     group: "title" },
  { label: "Lobster Two",        value: "'Lobster Two', cursive",      group: "title" },
  { label: "Pacifico",           value: "'Pacifico', cursive",         group: "title" },
  { label: "Britney",            value: "'Britney', cursive",          group: "title" },

  // ── 🚀 Space & Tech — 太空科技 ────────────────────────────────────────────────
  { label: "Orbitron",           value: "'Orbitron', sans-serif",      group: "space" },
  { label: "Rajdhani",           value: "'Rajdhani', sans-serif",      group: "space" },

  // ── 🧒 Cute & Rounded — 圆润可爱 ─────────────────────────────────────────────
  { label: "Quicksand",          value: "'Quicksand', sans-serif",     group: "cute" },
  { label: "Fredoka One",        value: "'Fredoka One', cursive",      group: "cute" },
  { label: "Chewy",              value: "'Chewy', cursive",            group: "cute" },
  { label: "Boogaloo",           value: "'Boogaloo', cursive",         group: "cute" },
  { label: "Varela Round",       value: "'Varela Round', sans-serif",  group: "cute" },
  { label: "Bubblegum Sans",     value: "'Bubblegum Sans', cursive",   group: "cute" },

  // ── 🔤 Unique & Artistic — 特效艺术字 ────────────────────────────────────────
  { label: "UnifrakturMaguntia", value: "'UnifrakturMaguntia', cursive", group: "display" },
  { label: "Permanent Marker",   value: "'Permanent Marker', cursive", group: "display" },
  { label: "Cabin Sketch",       value: "'Cabin Sketch', cursive",     group: "display" },
  { label: "Sharpie",            value: "'Sharpie', cursive",          group: "display" },
  { label: "Inknut Antiqua",     value: "'Inknut Antiqua', serif",     group: "display" },

  // ── ✍️ Script & Calligraphy — 书法手写 ───────────────────────────────────────
  { label: "Kaushan Script",     value: "'Kaushan Script', cursive",   group: "script" },
  { label: "Tangerine",          value: "'Tangerine', cursive",        group: "script" },
  { label: "Satisfy",            value: "'Satisfy', cursive",          group: "script" },
  { label: "Caveat",             value: "'Caveat', cursive",           group: "script" },
  { label: "Dancing Script",     value: "'DancingScript', cursive",    group: "script" },
  { label: "Kalam",              value: "'Kalam', cursive",            group: "script" },
  { label: "Coustard",           value: "'Coustard', serif",           group: "script" },
  { label: "Clarendon",          value: "'Clarendon', serif",          group: "script" },
  { label: "Betm Rounded",       value: "'Betm Rounded', sans-serif",  group: "script" },
  { label: "Coustard",           value: "'Coustard', serif",           group: "script" },
  { label: "Clarendon",          value: "'Clarendon', serif",          group: "script" },
  { label: "Betm Rounded",       value: "'Betm Rounded', sans-serif",  group: "script" },

  // ── ✒️ Display & Grotesk — 新导入 (variable TTF, assets/fonts/custom) ──────────
  { label: "Bevellier",          value: "'Bevellier', serif",          group: "imports" },
  { label: "Rowan",              value: "'Rowan', serif",              group: "imports" },
  { label: "Technor",            value: "'Technor', sans-serif",       group: "imports" },
  { label: "Nippo",              value: "'Nippo', sans-serif",         group: "imports" },
  { label: "Cabinet Grotesk",    value: "'Cabinet Grotesk', sans-serif", group: "imports" },
  { label: "Telma",              value: "'Telma', sans-serif",         group: "imports" },
  { label: "Bespoke Stencil",    value: "'Bespoke Stencil', sans-serif", group: "imports" },
];

const COLOR_PRESETS = [
  { name: "Gold",        value: "gold_gradient",      preview: "linear-gradient(180deg, #F5D478, #C8922A, #F5E6A3, #A67620)" },
  { name: "Silver",      value: "silver_gradient",    preview: "linear-gradient(180deg, #FFFFFF, #888888, #F0F0F0, #585858)" },
  { name: "Bronze",      value: "bronze_gradient",    preview: "linear-gradient(180deg, #FFD07A, #7A3E0E, #D4904A, #4A2006)" },
  { name: "Rose Gold",   value: "rosegold_gradient",  preview: "linear-gradient(180deg, #FFD8C0, #B06040, #F0B898, #803828)" },
  { name: "Wood Grain",  value: "wood_gradient",      preview: "linear-gradient(180deg, #D4A96A, #8B5E3C, #E8C896, #5C3A1E)" },
  { name: "Copper",      value: "copper_gradient",    preview: "linear-gradient(180deg, #E8A055, #7A4010, #F5C880, #4A2008)" },
  { name: "Forest",      value: "forest_gradient",    preview: "linear-gradient(180deg, #7EC858, #1E5C2A, #B8E890, #0A3D18)" },
  { name: "Jade",        value: "jade_gradient",      preview: "linear-gradient(180deg, #90D0A0, #1A6B3A, #C0E8C8, #0D4A22)" },
  { name: "Ocean",       value: "ocean_gradient",     preview: "linear-gradient(180deg, #7EC8E3, #0A5C8C, #C5E8F5, #043E5C)" },
  { name: "Midnight",    value: "midnight_gradient",  preview: "linear-gradient(180deg, #A0C4E8, #1A3A6B, #D8E8F8, #0A1E4A)" },
  { name: "Amethyst",    value: "amethyst_gradient",  preview: "linear-gradient(180deg, #C89FE3, #6B3A9C, #E8D5F8, #4A1E78)" },
  { name: "Ruby",        value: "ruby_gradient",      preview: "linear-gradient(180deg, #F5A0A0, #8B1010, #F8D0D0, #5A0808)" },
  { name: "Coral",       value: "coral_gradient",     preview: "linear-gradient(180deg, #FF9B7A, #CC4030, #FFCBA8, #8B2018)" },
  { name: "White",       value: "#FFFFFF",            preview: "#FFFFFF" },
  { name: "Black",       value: "#000000",            preview: "#000000" },
  { name: "Solid",       value: "custom",             preview: "conic-gradient(red, orange, yellow, green, blue, purple, red)" },
  { name: "Gradient",    value: "custom_gradient",    preview: "linear-gradient(135deg, #FF8C00, #FFD700, #7B2FFF)" },
];

// Maps preset gradient names → representative solid hex (used in JSON export + panel display)
const GRADIENT_COLOR_MAP = {
  custom_gradient: "#FF8C00", // placeholder; actual value resolved per-item at export time
  gold_gradient:      "#C8922A",
  silver_gradient:    "#A0A0A0",
  bronze_gradient:    "#8B5E3C",
  rosegold_gradient:  "#C48888",
  wood_gradient:      "#8B5E3C",
  copper_gradient:    "#7A4010",
  forest_gradient:    "#1E5C2A",
  jade_gradient:      "#1A6B3A",
  ocean_gradient:     "#0A5C8C",
  midnight_gradient:  "#1A3A6B",
  amethyst_gradient:  "#6B3A9C",
  ruby_gradient:      "#8B1010",
  coral_gradient:     "#CC4030",
};

// Build a real canvas linear gradient for PNG export (top→bottom over text box height)
const GRADIENT_STOPS = {
  gold_gradient:      ["#F5D478", "#C8922A", "#F5E6A3", "#A67620"],
  silver_gradient:    ["#FFFFFF", "#888888", "#F0F0F0", "#585858"],
  bronze_gradient:    ["#FFD07A", "#7A3E0E", "#D4904A", "#4A2006"],
  rosegold_gradient:  ["#FFD8C0", "#B06040", "#F0B898", "#803828"],
  wood_gradient:      ["#D4A96A", "#8B5E3C", "#E8C896", "#5C3A1E"],
  copper_gradient:    ["#E8A055", "#7A4010", "#F5C880", "#4A2008"],
  forest_gradient:    ["#7EC858", "#1E5C2A", "#B8E890", "#0A3D18"],
  jade_gradient:      ["#90D0A0", "#1A6B3A", "#C0E8C8", "#0D4A22"],
  ocean_gradient:     ["#7EC8E3", "#0A5C8C", "#C5E8F5", "#043E5C"],
  midnight_gradient:  ["#A0C4E8", "#1A3A6B", "#D8E8F8", "#0A1E4A"],
  amethyst_gradient:  ["#C89FE3", "#6B3A9C", "#E8D5F8", "#4A1E78"],
  ruby_gradient:      ["#F5A0A0", "#8B1010", "#F8D0D0", "#5A0808"],
  coral_gradient:     ["#FF9B7A", "#CC4030", "#FFCBA8", "#8B2018"],
};
function buildCanvasGradient(ctx, colorVal, bx, by, bh, bw = 0, item = null) {
  if (colorVal === "custom_gradient" && item) {
    const angle = item.customGradientAngle ?? 180;
    const c1 = item.customGradientStart ?? "#FF8C00";
    const c2 = item.customGradientEnd ?? "#FFD700";
    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const cx = bx + bw / 2, cy = by + bh / 2;
    // Gradient-line length = the box's extent PROJECTED onto the gradient direction
    // (CSS linear-gradient rule: |W·sinθ| + |H·cosθ|). Using the diagonal for every
    // angle made vertical gradients span the full width too — but a one-line subtitle
    // is only ~bh tall, so the text sampled just the middle sliver of the c1→c2 ramp
    // and looked flat. Projecting makes vertical span bh, horizontal span bw.
    const halfLen = (Math.abs(dx) * bw + Math.abs(dy) * bh) / 2 || bh / 2;
    const grad = ctx.createLinearGradient(
      cx - dx * halfLen, cy - dy * halfLen,
      cx + dx * halfLen, cy + dy * halfLen,
    );
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    return grad;
  }
  const stops = GRADIENT_STOPS[colorVal];
  if (!stops) return colorVal; // solid color or custom hex
  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0,    stops[0]);
  grad.addColorStop(0.28, stops[1]);
  grad.addColorStop(0.52, stops[2]);
  grad.addColorStop(1,    stops[3]);
  return grad;
}

// Build a self-describing `fill` descriptor for JSON export so the worker can reproduce
// gradients/textures exactly (the flattened `color` hex alone would lose the gradient).
// Mirrors buildCanvasGradient: preset gradients → 4-stop vertical (angle 180); custom →
// 2-stop at the given angle; texture → image reference; everything else → solid.
const buildFill = (color, customColor, gStart, gEnd, gAngle, textureImage) => {
  if (textureImage) return { type: "texture", image: textureImage };
  if (color === "custom_gradient") {
    return { type: "linearGradient", angle: gAngle ?? 180, stops: [
      { offset: 0, color: gStart ?? "#FF8C00" },
      { offset: 1, color: gEnd ?? "#FFD700" },
    ] };
  }
  const stops = GRADIENT_STOPS[color];
  if (stops) {
    return { type: "linearGradient", angle: 180, stops: [
      { offset: 0,    color: stops[0] },
      { offset: 0.28, color: stops[1] },
      { offset: 0.52, color: stops[2] },
      { offset: 1,    color: stops[3] },
    ] };
  }
  return { type: "solid", color: color === "custom" ? (customColor ?? "#FFFFFF") : (color ?? "#FFFFFF") };
};

// Reverse map: "stop0,stop1,stop2,stop3" (uppercase) → preset gradient key. Lets import
// recognise a preset gradient from its exported `fill.stops` and restore the named swatch.
const GRADIENT_KEY_BY_STOPS = (() => {
  const m = {};
  for (const [key, stops] of Object.entries(GRADIENT_STOPS)) {
    m[stops.map((s) => s.toUpperCase()).join(",")] = key;
  }
  return m;
})();

// Inverse of buildFill + resolveExportColor: rebuild the editor's color fields from a `fill`
// descriptor on import. Without this, the round-trip degrades every gradient/texture to the
// flat representative `color` hex (the bug: imported gradients showed as a single solid colour).
const recoverColorDescriptor = (t) => {
  const base = {
    color: t.color ?? "#FFFFFF",
    customColor: t.customColor ?? "#FFFFFF",
    customGradientStart: t.customGradientStart ?? "#FF8C00",
    customGradientEnd: t.customGradientEnd ?? "#FFD700",
    customGradientAngle: t.customGradientAngle ?? 180,
    textureImage: t.textureImage ?? null,
  };
  const isKnownSwatch = (hex) =>
    typeof hex === "string" && COLOR_PRESETS.some((c) => c.value.toUpperCase() === hex.toUpperCase());
  const f = t.fill;
  if (!f || typeof f !== "object") {
    // Legacy template with no `fill`: a raw flat hex that isn't White/Black becomes a custom solid.
    if (typeof base.color === "string" && base.color.startsWith("#") && !isKnownSwatch(base.color)) {
      base.customColor = base.color; base.color = "custom";
    }
    return base;
  }
  if (f.type === "texture" && f.image) return { ...base, textureImage: f.image };
  if (f.type === "linearGradient" && Array.isArray(f.stops) && f.stops.length >= 2) {
    const stops = f.stops.map((s) => s.color ?? "#000000");
    const presetKey = stops.length === 4 ? GRADIENT_KEY_BY_STOPS[stops.map((s) => s.toUpperCase()).join(",")] : null;
    if (presetKey) return { ...base, color: presetKey };
    return {
      ...base,
      color: "custom_gradient",
      customGradientStart: stops[0],
      customGradientEnd: stops[stops.length - 1],
      customGradientAngle: f.angle ?? 180,
    };
  }
  if (f.type === "solid" && f.color) {
    return isKnownSwatch(f.color)
      ? { ...base, color: f.color }
      : { ...base, color: "custom", customColor: f.color };
  }
  return base;
};

// Inverse of exportSpanStyle: rebuild a span's editor style delta on import. Recovers the fill
// fields from `fill`/`color` only when the span overrode the fill; passes other keys through.
const importSpanStyle = (style = {}) => {
  const { fill, color, ...rest } = style;
  if (fill === undefined && color === undefined) return { ...rest };
  const rec = recoverColorDescriptor({ fill, color });
  return {
    ...rest,
    color: rec.color, customColor: rec.customColor,
    customGradientStart: rec.customGradientStart, customGradientEnd: rec.customGradientEnd,
    customGradientAngle: rec.customGradientAngle, textureImage: rec.textureImage,
  };
};

const BOX_STYLE_PRESETS = {
  rounded_translucent: {
    label: "Rounded translucent",
    fillColor: "#0F172A",
    fillOpacity: 0.28,
    borderColor: "#FFFFFF",
    borderOpacity: 0,
    borderWidth: 0,
    radius: 30,
    paddingX: 30,
    paddingY: 18,
  },
  no_box: {
    label: "No box",
    fillColor: "#000000",
    fillOpacity: 0,
    borderColor: "#FFFFFF",
    borderOpacity: 0,
    borderWidth: 0,
    radius: 0,
    paddingX: 0,
    paddingY: 0,
  },
  glass: {
    label: "Glass",
    fillColor: "#F8FAFC",
    fillOpacity: 0.18,
    borderColor: "#FFFFFF",
    borderOpacity: 0.42,
    borderWidth: 1,
    radius: 28,
    paddingX: 28,
    paddingY: 16,
  },
  dark_card: {
    label: "Dark card",
    fillColor: "#0B1120",
    fillOpacity: 0.58,
    borderColor: "#F5D478",
    borderOpacity: 0.28,
    borderWidth: 1,
    radius: 24,
    paddingX: 26,
    paddingY: 16,
  },
  cloud_fade: {
    label: "☁ Cloud / Mist",
    fillColor: "#FFFFFF",
    fillOpacity: 0.85,
    borderColor: "#FFFFFF",
    borderOpacity: 0,
    borderWidth: 0,
    radius: 48,
    paddingX: 40,
    paddingY: 28,
    fadeEdges: true,
    feather: 32,
  },
};

// Style fields captured/applied by the preset system.
// Excludes layout (x, y, boxWidth, boxHeight, maxWidth), content, role, and id.
const STYLE_PRESET_KEYS = [
  "font", "size", "bold", "fontWeight", "italic", "underline", "textTransform",
  "letterSpacing", "lineHeight", "opacity",
  "color", "customColor", "customGradientStart", "customGradientEnd", "customGradientAngle",
  "textureImage",
  "shadow", "shadowColor", "shadowOpacity", "shadowBlur", "shadowOffsetX", "shadowOffsetY",
  "stroke", "strokeWidth", "strokeColor", "strokeOpacity",
  "bevel", "bevelDepth", "bevelHighlight", "bevelShadow", "bevelTexture",
  "glow", "glowColor", "glowBlur", "glowOpacity",
  "boxStyle", "boxFillColor", "boxFillOpacity",
  "boxBorderColor", "boxBorderOpacity", "boxBorderWidth",
  "boxRadius", "boxPaddingTop", "boxPaddingRight", "boxPaddingBottom", "boxPaddingLeft", "boxFadeEdges", "boxFeather",
];

// Per-side inner padding (distance between text and box edge). Falls back to the legacy
// symmetric boxPaddingX/boxPaddingY for templates/presets authored before per-side padding.
const resolvePad = (item) => ({
  top:    item.boxPaddingTop    ?? item.boxPaddingY ?? 0,
  right:  item.boxPaddingRight  ?? item.boxPaddingX ?? 0,
  bottom: item.boxPaddingBottom ?? item.boxPaddingY ?? 0,
  left:   item.boxPaddingLeft   ?? item.boxPaddingX ?? 0,
});

// Convert a style object that may carry legacy symmetric padding into the canonical
// per-side form (and drop the legacy keys), so applying old presets overrides cleanly.
const normalizePaddingStyles = (styles) => {
  if (styles.boxPaddingX === undefined && styles.boxPaddingY === undefined) return styles;
  const { boxPaddingX, boxPaddingY, ...rest } = styles;
  return {
    ...rest,
    boxPaddingTop:    rest.boxPaddingTop    ?? boxPaddingY ?? 0,
    boxPaddingRight:  rest.boxPaddingRight  ?? boxPaddingX ?? 0,
    boxPaddingBottom: rest.boxPaddingBottom ?? boxPaddingY ?? 0,
    boxPaddingLeft:   rest.boxPaddingLeft   ?? boxPaddingX ?? 0,
  };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// ── Coordinate-space law: the image's NATIVE pixels ARE the page space. ──────────────
// Whenever a page's dimensions change (an image with different dims is assigned, or a JSON
// authored in another space is imported onto an existing image), remap the whole text layout
// into the new space instead of silently distorting the image or misplacing the text:
//   · positions/extents map per-axis (x/boxWidth/maxWidth by W-ratio; y/boxHeight by H-ratio)
//   · size-like values (font size, letterSpacing, stroke/shadow/glow/bevel, radius, feather)
//     scale by the WIDTH ratio — font metrics scale linearly with size, so wrapping inside the
//     (also W-scaled) box stays EXACTLY the same. For same-aspect rescales (1024→4096) every
//     factor coincides and the remap is lossless.
const rescalePageLayout = (page, newW, newH) => {
  const oldW = page.width, oldH = page.height;
  if (!oldW || !oldH || (oldW === newW && oldH === newH)) return { ...page, width: newW, height: newH };
  const sx = newW / oldW, sy = newH / oldH, s = sx;
  const num = (v, f) => (v == null ? v : +(v * f).toFixed(2));
  const px  = (v, f) => (v == null ? v : Math.round(v * f));
  const rescaleStyle = (o) => {
    if (!o) return o;
    const r = { ...o };
    if (r.size != null) r.size = Math.max(1, Math.round(r.size * s));
    r.letterSpacing = num(r.letterSpacing, s);
    r.strokeWidth   = num(r.strokeWidth, s);
    r.shadowBlur    = num(r.shadowBlur, s);
    r.shadowOffsetX = num(r.shadowOffsetX, s);
    r.shadowOffsetY = num(r.shadowOffsetY, s);
    r.glowBlur      = num(r.glowBlur, s);
    if (r.bevelDepth != null) r.bevelDepth = Math.max(1, Math.round(r.bevelDepth * s));
    return r;
  };
  const texts = (page.texts ?? []).map((t) => {
    const nt = rescaleStyle(t);
    nt.x = px(t.x, sx); nt.y = px(t.y, sy);
    nt.boxWidth  = px(t.boxWidth, sx);
    nt.maxWidth  = px(t.maxWidth, sx);
    nt.boxHeight = px(t.boxHeight, sy);
    nt.boxRadius = px(t.boxRadius, s);
    nt.boxFeather = px(t.boxFeather, s);
    nt.boxPaddingLeft   = px(t.boxPaddingLeft, sx);
    nt.boxPaddingRight  = px(t.boxPaddingRight, sx);
    nt.boxPaddingTop    = px(t.boxPaddingTop, sy);
    nt.boxPaddingBottom = px(t.boxPaddingBottom, sy);
    nt.boxBorderWidth   = num(t.boxBorderWidth, s);
    if (t.nameStyle) nt.nameStyle = rescaleStyle(t.nameStyle);
    if (Array.isArray(t.spans)) nt.spans = t.spans.map((sp) => (sp?.style ? { ...sp, style: rescaleStyle(sp.style) } : sp));
    return nt;
  });
  return { ...page, width: newW, height: newH, texts };
};

const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace("#", "");
  if (!(normalized.length === 3 || normalized.length === 6)) {
    return `rgba(0,0,0,${alpha})`;
  }

  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

// Only the bevel/emboss portion of the shadow — used on the solid-color backing layer.
const computeBevelShadow = (item, s = 1) => {
  if (!item.bevel) return "none";
  const parts = [];
  const depth = (item.bevelDepth ?? 4) * s;
  const hi    = item.bevelHighlight ?? "#FFFFFF";
  const sh    = item.bevelShadow    ?? "#000000";
  const steps = Math.max(2, Math.round(depth));
  parts.push(`${-Math.round(s)}px ${-Math.round(s)}px ${Math.round(s * 1.5)}px ${hexToRgba(hi, 0.4)}`);
  for (let i = 1; i <= steps; i++) {
    const alpha  = 0.1 + (i / steps) * 0.45;
    const offset = Math.round((i / steps) * depth);
    parts.push(`${offset}px ${offset}px 0px ${hexToRgba(sh, alpha)}`);
  }
  parts.push(`${Math.round(depth + s * 1.5)}px ${Math.round(depth + s * 2)}px ${Math.round(depth * 0.8 + s * 2)}px rgba(0,0,0,0.52)`);
  return parts.join(", ");
};

// Glow + drop shadow only — applied on the main (gradient) text layer.
const computeNonBevelShadow = (item, s = 1) => {
  const parts = [];
  if (item.glow) {
    const gc = hexToRgba(item.glowColor ?? "#FFD700", item.glowOpacity ?? 0.85);
    const gb = (item.glowBlur ?? 20) * s;
    parts.push(`0px 0px ${gb * 1.6}px ${gc}`);
    parts.push(`0px 0px ${gb * 0.7}px ${gc}`);
    parts.push(`0px 0px ${gb * 0.25}px ${gc}`);
  }
  if (item.shadow) {
    parts.push(
      `${(item.shadowOffsetX ?? 2) * s}px ${(item.shadowOffsetY ?? 4) * s}px ` +
      `${(item.shadowBlur ?? 8) * s}px ` +
      `${hexToRgba(item.shadowColor ?? "#000000", item.shadowOpacity ?? 0.5)}`
    );
  }
  return parts.length > 0 ? parts.join(", ") : "none";
};

const getPresetConfig = (presetKey) => BOX_STYLE_PRESETS[presetKey] ?? BOX_STYLE_PRESETS.rounded_translucent;

const defaultTextItem = (pageWidth, pageHeight) => {
  const preset = getPresetConfig("rounded_translucent");
  const bw = pageWidth ? Math.round(pageWidth * 0.72) : 760;
  const bh = pageHeight ? Math.round(pageHeight * 0.14) : 300;
  const x = pageWidth ? Math.round((pageWidth - bw) / 2) : 80;
  const y = pageHeight ? Math.round(pageHeight * 0.55) : 400;
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    role: "body",
    content: "Little {name} and the",
    x,
    y,
    font: "'Gambetta', serif",
    size: 90,
    color: "#FFFFFF",
    customColor: "#FFFFFF",
    bold: true,
    italic: false,
    textAlign: "left",
    verticalAlign: "top",
    shadow: true,
    shadowColor: "#000000",
    shadowOpacity: 0.52,
    shadowBlur: 8,
    shadowOffsetX: 2,
    shadowOffsetY: 4,
    autoScale: true,
    maxWidth: bw,
    boxWidth: bw,
    boxHeight: bh,
    letterSpacing: 1,
    lineHeight: 1.2,
    opacity: 1,
    boxStyle: "rounded_translucent",
    boxFillColor: preset.fillColor,
    boxFillOpacity: preset.fillOpacity,
    boxBorderColor: preset.borderColor,
    boxBorderOpacity: preset.borderOpacity,
    boxBorderWidth: preset.borderWidth,
    boxRadius:    preset.radius,
    boxPaddingTop:    preset.paddingY,
    boxPaddingRight:  preset.paddingX,
    boxPaddingBottom: preset.paddingY,
    boxPaddingLeft:   preset.paddingX,
    boxFadeEdges: preset.fadeEdges ?? false,
    boxFeather: preset.feather ?? 30,
    textureImage: null,
    customGradientStart: "#FF8C00",
    customGradientEnd: "#FFD700",
    customGradientAngle: 180,
    stroke: false,
    strokeWidth: 4,
    strokeColor: "#000000",
    strokeOpacity: 1,
    bevel: false,
    bevelDepth: 4,
    bevelHighlight: "#FFFFFF",
    bevelShadow: "#000000",
    bevelTexture: null,
    glow: false,
    glowColor: "#FFD700",
    glowBlur: 20,
    glowOpacity: 0.85,
    textTransform: "none",
    underline: false,
    nameStyle: null, // independent styling for the {name} token
  };
};

// Gradient CSS strings, shared between preview and canvas export
const TEXT_GRADIENTS = {
  gold_gradient:      "linear-gradient(180deg, #F5D478 0%, #C8922A 28%, #F5E6A3 52%, #A67620 100%)",
  silver_gradient:    "linear-gradient(180deg, #FFFFFF 0%, #888888 28%, #F0F0F0 52%, #585858 100%)",
  bronze_gradient:    "linear-gradient(180deg, #FFD07A 0%, #7A3E0E 28%, #D4904A 52%, #4A2006 100%)",
  rosegold_gradient:  "linear-gradient(180deg, #FFD8C0 0%, #B06040 28%, #F0B898 52%, #803828 100%)",
  wood_gradient:      "linear-gradient(180deg, #D4A96A 0%, #8B5E3C 28%, #E8C896 52%, #5C3A1E 100%)",
  copper_gradient:    "linear-gradient(180deg, #E8A055 0%, #7A4010 28%, #F5C880 52%, #4A2008 100%)",
  forest_gradient:    "linear-gradient(180deg, #7EC858 0%, #1E5C2A 28%, #B8E890 52%, #0A3D18 100%)",
  jade_gradient:      "linear-gradient(180deg, #90D0A0 0%, #1A6B3A 28%, #C0E8C8 52%, #0D4A22 100%)",
  ocean_gradient:     "linear-gradient(180deg, #7EC8E3 0%, #0A5C8C 28%, #C5E8F5 52%, #043E5C 100%)",
  midnight_gradient:  "linear-gradient(180deg, #A0C4E8 0%, #1A3A6B 28%, #D8E8F8 52%, #0A1E4A 100%)",
  amethyst_gradient:  "linear-gradient(180deg, #C89FE3 0%, #6B3A9C 28%, #E8D5F8 52%, #4A1E78 100%)",
  ruby_gradient:      "linear-gradient(180deg, #F5A0A0 0%, #8B1010 28%, #F8D0D0 52%, #5A0808 100%)",
  coral_gradient:     "linear-gradient(180deg, #FF9B7A 0%, #CC4030 28%, #FFCBA8 52%, #8B2018 100%)",
};

// Every branch sets the SAME 8 longhand properties — never use the 'background' shorthand
// alongside longhands, they conflict in React inline styles causing random stale state.
const _COLOR_BASE = {
  color:                "inherit",
  WebkitTextFillColor:  "inherit",
  backgroundImage:      "none",
  backgroundSize:       "auto",
  backgroundPosition:   "0% 0%",
  backgroundRepeat:     "repeat",
  WebkitBackgroundClip: "border-box",
  backgroundClip:       "border-box",
};

// Padding added to every background-clip:text branch so script-font glyphs that
// overhang the typographic box (e.g. Satisfy "L" tail) are not clipped.
// Inline padding does not affect text layout/wrapping.
const _CLIP_TEXT_PADDING = { padding: "0.12em 0.25em", margin: "0 -0.25em" };

const getTextColorStyle = (item) => {
  if (item.textureImage) {
    return {
      ..._COLOR_BASE,
      ..._CLIP_TEXT_PADDING,
      color:                "transparent",
      WebkitTextFillColor:  "transparent",
      backgroundImage:      `url(${item.textureImage})`,
      backgroundSize:       "cover",
      backgroundPosition:   "center",
      backgroundRepeat:     "no-repeat",
      WebkitBackgroundClip: "text",
      backgroundClip:       "text",
    };
  }

  if (item.color === "custom_gradient") {
    const angle = item.customGradientAngle ?? 180;
    const c1 = item.customGradientStart ?? "#FF8C00";
    const c2 = item.customGradientEnd ?? "#FFD700";
    return {
      ..._COLOR_BASE,
      ..._CLIP_TEXT_PADDING,
      color:                "transparent",
      WebkitTextFillColor:  "transparent",
      backgroundImage:      `linear-gradient(${angle}deg, ${c1}, ${c2})`,
      WebkitBackgroundClip: "text",
      backgroundClip:       "text",
    };
  }

  const colorVal = item.color === "custom" ? item.customColor : item.color;

  if (TEXT_GRADIENTS[colorVal]) {
    return {
      ..._COLOR_BASE,
      ..._CLIP_TEXT_PADDING,
      color:                "transparent",
      WebkitTextFillColor:  "transparent",
      backgroundImage:      TEXT_GRADIENTS[colorVal],
      WebkitBackgroundClip: "text",
      backgroundClip:       "text",
    };
  }

  // Solid color — all clip/fill props reset via _COLOR_BASE
  return {
    ..._COLOR_BASE,
    color:               colorVal,
    WebkitTextFillColor: colorVal,
  };
};

// ── {name} independent styling helpers ─────────────────────────────────────
// Keys that nameStyle can override on the base text item
const NAME_STYLE_KEYS = [
  "font","size","bold","fontWeight","italic","letterSpacing","textTransform","textureImage",
  "color","customColor","customGradientStart","customGradientEnd","customGradientAngle",
  "shadow","shadowColor","shadowOpacity","shadowBlur","shadowOffsetX","shadowOffsetY",
  "stroke","strokeWidth","strokeColor","strokeOpacity",
  "bevel","bevelDepth","bevelHighlight","bevelShadow",
  "glow","glowColor","glowBlur","glowOpacity",
];

// Returns a full effective-style item for the {name} token, or null if not enabled
const resolveNameStyle = (item) => {
  if (!item.nameStyle?.enabled) return null;
  const ns = item.nameStyle;
  const result = { ...item };
  NAME_STYLE_KEYS.forEach((k) => { if (ns[k] !== undefined && ns[k] !== null) result[k] = ns[k]; });
  return result;
};

// Keep span char-offsets valid after the content string is edited. Diffs old→new by common
// prefix/suffix; positions before the change stay, after it shift by the length delta, and
// positions inside the replaced region collapse to the change start. Empty spans are dropped.
const remapSpans = (spans, oldText, newText) => {
  if (!spans?.length) return spans ?? [];
  if (oldText === newText) return spans;
  const minLen = Math.min(oldText.length, newText.length);
  let p = 0; while (p < minLen && oldText[p] === newText[p]) p++;
  let s = 0; while (s < (minLen - p) && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
  const oldChangeEnd = oldText.length - s;
  const delta = newText.length - oldText.length;
  const mapPos = (pos) => (pos <= p ? pos : pos >= oldChangeEnd ? pos + delta : p);
  const out = [];
  for (const sp of spans) {
    const ns = mapPos(sp.start), ne = mapPos(sp.end);
    if (ne > ns) out.push({ ...sp, start: ns, end: ne });
  }
  return out;
};

// Named font weights for variable fonts (the dropdown). Canvas/CSS take the numeric value.
const WEIGHT_OPTIONS = [
  { label: "Thin", value: 100 },
  { label: "ExtraLight", value: 200 },
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "SemiBold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "ExtraBold", value: 800 },
  { label: "Black", value: 900 },
];
// Resolved numeric font weight. `fontWeight` is the source of truth; legacy items only have
// `bold` (→ 700/400). A variable font whose axis is narrower than the value is clamped by the browser.
const resolveWeight = (eff) => eff.fontWeight ?? (eff.bold ? 700 : 400);

// Apply a text-transform to a string (shared by single-style + per-run rendering).
// NOTE: `capitalize` is TRUE Title Case — lowercase everything first, then uppercase the first
// letter of each word. The word boundary EXCLUDES apostrophes (' and ’) so a possessive like
// "{name}'s" → "Alexander's" (NOT "Alexander'S"). "ADVENTURE story" → "Adventure Story".
// This must stay byte-identical to the worker's capitalizeText() (worker spec §appendix).
const applyTransform = (s, tt) =>
  tt === "uppercase" ? s.toUpperCase()
  : tt === "lowercase" ? s.toLowerCase()
  : tt === "capitalize" ? s.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])([\p{L}\p{N}])/gu, (_m, p, c) => p + c.toUpperCase())
  : s;

// Split content into [{text, isName}] segments after replacing {name} with resolvedName
const splitContentSegments = (content, resolvedName) => {
  const parts = content.split("{name}");
  if (parts.length === 1) return [{ text: content, isName: false }];
  const segs = [];
  parts.forEach((part, i) => {
    if (part) segs.push({ text: part, isName: false });
    if (i < parts.length - 1) segs.push({ text: resolvedName, isName: true });
  });
  return segs;
};

const getRenderedTextStyle = (item) => {
  return {
    fontFamily: item.font,
    fontSize: `${item.size}px`,
    fontWeight: item.bold ? "bold" : "normal",
    fontStyle: item.italic ? "italic" : "normal",
    letterSpacing: `${item.letterSpacing}px`,
    lineHeight: item.lineHeight,
    textAlign: item.textAlign ?? "left",
    opacity: item.opacity,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    width: "100%",
    height: "100%",
    WebkitTextStroke: item.stroke
      ? `${item.strokeWidth ?? 4}px ${hexToRgba(item.strokeColor ?? "#000000", item.strokeOpacity ?? 1)}`
      : "0px transparent",
    paintOrder: "stroke fill",
    textTransform: item.textTransform ?? "none",
    textDecoration: item.underline ? "underline" : "none",
    // Color/gradient/texture applied separately on the inner <span> so that
    // background-clip: text clips to the actual text characters, not the full box height.
  };
};

function NumericField({
  value,
  onCommit,
  min,
  max,
  step = "any",
  style,
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value == null ? "" : String(value));
      return;
    }

    const parsed = Number.parseFloat(trimmed);
    if (Number.isNaN(parsed)) {
      setDraft(value == null ? "" : String(value));
      return;
    }

    let next = parsed;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onCommit(next);
  }, [draft, max, min, onCommit, value]);

  return (
    <input
      type="text"
      inputMode={step === "1" ? "numeric" : "decimal"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value == null ? "" : String(value));
          e.currentTarget.blur();
        }
      }}
      style={style}
    />
  );
}

// ── Shared property-panel control primitives ────────────────────────────────────
// One layout system for the whole panel so controls never overlap and spacing stays
// consistent: number/color controls live in grid cells (Field), sliders ALWAYS get
// their own full-width row (SliderRow) — never crammed next to another control.
const PANEL_LABEL = { fontSize: 10, color: "#888", display: "block", marginBottom: 4, whiteSpace: "nowrap" };

function Field({ label, children, style }) {
  return (
    <div style={{ minWidth: 0, ...style }}>
      <label style={PANEL_LABEL}>{label}</label>
      {children}
    </div>
  );
}

function SliderRow({ label, value, min = 0, max = 1, step = 0.05, onChange, format, accent = "#F5D478", style }) {
  return (
    <div style={{ marginBottom: 10, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "#888" }}>{label}</span>
        <span style={{ fontSize: 10, color: "#9a9a9a", fontVariantNumeric: "tabular-nums" }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        style={{ width: "100%", height: 16, margin: 0, display: "block", accentColor: accent, cursor: "pointer" }}
      />
    </div>
  );
}

// ── FontPicker ─────────────────────────────────────────────────────────────────
// Custom font selector that renders each option in its own typeface.
// Native <select> <option> elements CANNOT render custom fonts (OS limitation).
const FONT_GROUPS = [
  { key: "serif",   label: "📖 Classic Serif (故事书衬线)" },
  { key: "modern",  label: "🎨 Modern Design (设计感)" },
  { key: "elegant", label: "✨ Elegant Display (典雅大标题)" },
  { key: "title",   label: "🎪 Bold Title (冲击标题字)" },
  { key: "space",   label: "🚀 Space & Tech (太空科技)" },
  { key: "cute",    label: "🧒 Cute & Rounded (圆润可爱)" },
  { key: "display", label: "🔤 Unique & Artistic (特效艺术字)" },
  { key: "script",  label: "✍️  Script & Calligraphy (书法手写)" },
  { key: "imports", label: "✒️ Display & Grotesk (展示/无衬线)" },
];

function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [, forceUpdate] = useState(0);
  const wrapRef = useRef(null);
  const activeRef = useRef(null);
  const current = FONT_OPTIONS.find((f) => f.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Pre-load all fonts once on mount so they're ready before first open
  useEffect(() => {
    const names = FONT_OPTIONS.map((f) => f.value.split(",")[0].trim().replace(/'/g, ""));
    Promise.allSettled(names.map((n) => document.fonts.load(`400 20px "${n}"`)))
      .then(() => forceUpdate((v) => v + 1));
  }, []);

  // When picker opens: ensure fonts loaded, then scroll to current selection
  useEffect(() => {
    if (!open) return;
    const names = FONT_OPTIONS.map((f) => f.value.split(",")[0].trim().replace(/'/g, ""));
    Promise.allSettled(names.map((n) => document.fonts.load(`400 20px "${n}"`))).then(() => {
      forceUpdate((v) => v + 1);
    });
    requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 12 }}>
      {/* Trigger button — shows current font rendered in that typeface */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "#1A1A1A",
          border: open ? "1px solid #F5D478" : "1px solid #333",
          borderRadius: 6,
          padding: "9px 12px",
          color: "#E0E0E0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontFamily: value, fontSize: 20, lineHeight: 1.4, flex: 1, textAlign: "left", overflow: "hidden", whiteSpace: "nowrap" }}>
          {current?.label ?? "Select font"}
        </span>
        <span style={{ color: "#555", fontSize: 9, flexShrink: 0 }}>{open ? "▴" : "▾"}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute",
          zIndex: 200,
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#141414",
          border: "1px solid #333",
          borderRadius: 8,
          maxHeight: 380,
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}>
          {FONT_GROUPS.map((grp) => {
            const fonts = FONT_OPTIONS.filter((f) => f.group === grp.key);
            if (fonts.length === 0) return null;
            return (
              <div key={grp.key}>
                <div style={{
                  padding: "6px 12px",
                  fontSize: 10,
                  color: "#555",
                  letterSpacing: 0.5,
                  borderTop: "1px solid #222",
                  position: "sticky",
                  top: 0,
                  background: "#141414",
                  zIndex: 1,
                }}>
                  {grp.label}
                </div>
                {fonts.map((f) => {
                  const isActive = value === f.value;
                  return (
                    <div
                      key={f.value}
                      ref={isActive ? activeRef : null}
                      onMouseDown={() => { onChange(f.value); setOpen(false); }}
                      style={{
                        padding: "10px 16px",
                        cursor: "pointer",
                        background: isActive ? "#252010" : "transparent",
                        fontFamily: f.value,
                        fontSize: 18,
                        lineHeight: 1.6,
                        color: isActive ? "#F5D478" : "#D0D0D0",
                        borderLeft: isActive ? "2px solid #F5D478" : "2px solid transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#1E1E1E"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      {f.label}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Effect-overflow margin (page px) so glow/shadow/stroke/bevel are not clipped by the
// per-box preview canvas. Mirrors the effect extents drawTextItem can paint outside the box.
const fxMargin = (it) => {
  let m = 4;
  const acc = (o) => {
    if (!o) return;
    if (o.glow)   m = Math.max(m, (o.glowBlur ?? 20) * 1.8);
    if (o.shadow) m = Math.max(m, (o.shadowBlur ?? 8) + Math.max(Math.abs(o.shadowOffsetX ?? 2), Math.abs(o.shadowOffsetY ?? 4)));
    if (o.stroke) m = Math.max(m, (o.strokeWidth ?? 4));
    if (o.bevel)  m = Math.max(m, (o.bevelDepth ?? 4) * 2);
    if (o.boxFadeEdges) m = Math.max(m, (o.boxFeather ?? 30) * 2.2); // Cloud/Mist blur spreads outward
  };
  acc(it);
  if (it.nameStyle?.enabled) acc(it.nameStyle);
  return Math.ceil(m + 6);
};

// Live preview of one text box, painted with the SAME canvas routine as PNG export
// (drawTextItem) → true WYSIWYG. The backing canvas is full page-resolution; CSS scales
// it down for display, so the on-screen pixels ARE the export pixels, just smaller.
async function loadSubtitleFonts(items, failedFonts) {
  const specs = new Map();
  const add = (style) => {
    const spec = `${style.italic ? "italic " : ""}${resolveWeight(style)} ${style.size}px ${style.font}`;
    specs.set(spec, style.font.split(",")[0].trim().replace(/^['"]|['"]$/g, ""));
  };
  for (const item of items) {
    add(item);
    if (item.nameStyle?.enabled) add({ ...item, ...item.nameStyle });
    for (const span of item.spans ?? []) {
      if (span?.style) add({ ...item, ...span.style });
    }
  }
  await Promise.all([...specs].map(async ([spec, family]) => {
    try {
      await document.fonts.load(spec);
    } catch {
      failedFonts?.add(family);
    }
  }));
}

function warnAboutFonts(failedFonts) {
  if (failedFonts.size) {
    window.alert(`Font loading failed: ${[...failedFonts].join(", ")}. The exported images may use a substitute font. Check the lettering before using them.`);
  }
}

function TextBoxCanvas({ item, previewName, scale, draw }) {
  const ref = useRef(null);
  const bw = item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH;
  const bh = item.boxHeight ?? MIN_BOX_HEIGHT;
  const M = fxMargin(item);
  const cw = Math.round(bw + M * 2);
  const ch = Math.round(bh + M * 2);

  useEffect(() => {
    let cancelled = false;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    (async () => {
      // Ensure the chosen fonts are loaded, else measureText/fillText silently fall back.
      await loadSubtitleFonts([item]);
      if (cancelled) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.translate(M - item.x, M - item.y); // map the item's absolute page coords into the box canvas
      try { await draw(ctx, item, previewName); } catch { /* ignore */ }
      ctx.restore();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, previewName, M, cw, ch]);

  return (
    <canvas
      ref={ref}
      width={cw}
      height={ch}
      style={{
        position: "absolute",
        left: -M * scale,
        top: -M * scale,
        width: cw * scale,
        height: ch * scale,
        pointerEvents: "none",
      }}
    />
  );
}

export default function TemplateEditor() {
  const [storyId, setStoryId] = useState("story_01");
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedText, setSelectedText] = useState(null);
  const [interaction, setInteraction] = useState(null);
  const [previewName, setPreviewName] = useState("Amy");
  const [viewportZoom, setViewportZoom] = useState(0.25); // corrected to "fit" once a page loads
  const canvasRef = useRef(null);
  const [showExport, setShowExport] = useState(false);
  const [exportJSON, setExportJSON] = useState("");
  const [exportMode, setExportMode] = useState("all");
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [imageLoadProgress, setImageLoadProgress] = useState({ active: false, done: 0, total: 0 });
  const [snapGuides, setSnapGuides] = useState([]);
  const [recentColors, setRecentColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ymi-recent-colors") ?? "[]"); } catch { return []; }
  });
  // Recently-used custom gradients ({start,end,angle}) — persisted, re-applied with one click.
  const [recentGradients, setRecentGradients] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ymi-recent-gradients") ?? "[]"); } catch { return []; }
  });
  const [hoveredPage, setHoveredPage] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Per-character styling scope. null = editing the whole text box; {start,end} = editing a
  // span (a selected character range) so the style controls write into that span's delta.
  const [spanRange, setSpanRange] = useState(null);
  // Latest text selection inside the Content textarea ({start,end}) — drives "style selection".
  const contentSelRef = useRef({ start: 0, end: 0 });
  const contentTaRef = useRef(null); // the Content <textarea> DOM node — read live selection on click
  const [contentSel, setContentSel] = useState({ start: 0, end: 0 });
  // Local textarea state — avoids setPages on every keystroke (committed on blur / 200ms debounce)
  const [localContent, setLocalContent] = useState("");
  // Style presets — persisted independently in localStorage
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ymi-style-presets") ?? "[]"); } catch { return []; }
  });
  // Inline save-preset form state: null = hidden, string = name being typed
  const [presetDraft, setPresetDraft] = useState(null);
  // Same, for saving the {name} token's style as a preset (form lives in the {name} panel)
  const [namePresetDraft, setNamePresetDraft] = useState(null);
  // Undo affordance after applying a preset: null = hidden,
  // { textId, beforePatch, name, scope } = a revertable apply. Auto-dismisses after 6s.
  const [presetUndo, setPresetUndo] = useState(null);
  const presetUndoTimerRef = useRef(null);

  // ── Session persistence ───────────────────────────────────────────────────────
  // Load saved session on first mount
  useEffect(() => {
    const load = async () => {
      try {
        const api = window.templateEditorDesktop;
        if (!api?.loadSession) {
          // Web fallback: localStorage
          const raw = localStorage.getItem('ymi-session');
          if (raw) {
            try {
              const saved = JSON.parse(raw);
              if (saved.storyId) setStoryId(saved.storyId);
              if (Array.isArray(saved.pages) && saved.pages.length > 0) {
                setPages(saved.pages);
                setCurrentPage(0);
              }
            } catch {}
          }
          setSessionLoaded(true);
          return;
        }
        const raw = await api.loadSession();
        if (!raw) { setSessionLoaded(true); return; }
        const saved = JSON.parse(raw);
        if (saved.storyId) setStoryId(saved.storyId);
        if (Array.isArray(saved.pages) && saved.pages.length > 0) {
          setPages(saved.pages);
          setCurrentPage(0);
        }
      } catch (e) {
        console.warn("Could not load session:", e);
      }
      setSessionLoaded(true);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag/resize performance refs ──────────────────────────────────────────
  // textBoxRefs: id → outer div DOM element (for direct style manipulation)
  const textBoxRefs = useRef(new Map());
  // dragLivePos: stores the final snapped position during drag (no re-render)
  const dragLivePos = useRef({ x: 0, y: 0 });
  // RAF handles for throttling snap guide updates and resize state updates
  const snapRAFRef = useRef(null);
  const resizeRAFRef = useRef(null);
  // Debounce ref for content textarea (prevents setPages on every keystroke)
  const contentDebounceRef = useRef(null);
  // RAF ref for throttling slider onChange to 60fps
  const sliderRAFRef = useRef(null);
  // Tracks whether the current resize interaction actually moved (guards history save)
  const resizeMovedRef = useRef(false);

  // Auto-save session whenever pages or storyId change (debounced 2s).
  // ⚠️ Images (base64) are intentionally EXCLUDED — they are 1-5MB each.
  // Saving 8 pages × ~2MB = 16MB of JSON to disk every 2s causes main-thread jank.
  // Images must be re-loaded after restart; all text configs (positions, styles, content) persist.
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!sessionLoaded) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const api = window.templateEditorDesktop;
      // Strip base64 image data before serialising — keep only text configs
      const saveable = {
        storyId,
        pages: pages.map((p) => ({
          fileName: p.fileName,
          width:    p.width,
          height:   p.height,
          texts:    p.texts,
          // image intentionally omitted
        })),
      };
      const payload = JSON.stringify(saveable);
      if (!api?.saveSession) {
        try { localStorage.setItem('ymi-session', payload); } catch {}
        return;
      }
      api.saveSession(payload).catch(() => {});
    }, 2000);
    return () => clearTimeout(saveTimerRef.current);
  }, [pages, storyId, sessionLoaded]);

  // Persist style presets whenever they change
  useEffect(() => {
    try { localStorage.setItem("ymi-style-presets", JSON.stringify(presets)); } catch {}
  }, [presets]);

  // Persist recently-used solid colours and custom gradients across sessions.
  useEffect(() => {
    try { localStorage.setItem("ymi-recent-colors", JSON.stringify(recentColors)); } catch {}
  }, [recentColors]);
  useEffect(() => {
    try { localStorage.setItem("ymi-recent-gradients", JSON.stringify(recentGradients)); } catch {}
  }, [recentGradients]);

  // ── History ────────────────────────────────────────────────────────────────
  // Only snapshot texts[] per page — never the base64 image data.
  // Images can't be undone and each one is 500KB–1MB; storing them in 40
  // history entries with 8 pages would consume hundreds of MB and crash Electron.
  const MAX_HISTORY = 40;
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  const saveHistory = useCallback((label) => {
    // Snapshot only texts arrays indexed by page position
    const textsSnapshot = pagesRef.current.map((p) =>
      JSON.parse(JSON.stringify(p.texts))
    );
    const base = historyRef.current.slice(0, historyIdxRef.current + 1);
    const entry = { texts: textsSnapshot, label, time: Date.now() };
    const next = [...base, entry].slice(-MAX_HISTORY);
    historyRef.current = next;
    historyIdxRef.current = next.length - 1;
  }, []);

  const jumpToHistory = useCallback((idx) => {
    if (idx < 0 || idx >= historyRef.current.length) return;
    const entry = historyRef.current[idx];
    historyIdxRef.current = idx;
    // Restore only texts; keep each page's image, fileName, width, height intact
    setPages((prev) =>
      prev.map((p, i) => ({
        ...p,
        texts: entry.texts[i] ? JSON.parse(JSON.stringify(entry.texts[i])) : p.texts,
      }))
    );
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    jumpToHistory(historyIdxRef.current - 1);
  }, [jumpToHistory]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    jumpToHistory(historyIdxRef.current + 1);
  }, [jumpToHistory]);

  // Style preset keys that are safe to copy (exclude layout/position/content)
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const img = new Image();
        img.onload = () => {
          setPages((prev) => [
            ...prev,
            {
              image: dataUrl,   // base64 data URL — persists across restarts
              fileName: file.name,
              width: img.naturalWidth,
              height: img.naturalHeight,
              texts: [],
            },
          ]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const page = pages[currentPage] ?? null;
  // viewportZoom IS the absolute scale: 100% (=1) renders 1:1 with the exported page pixels.
  const scale = viewportZoom;
  // Measure the canvas scroll-area width so "Fit" always fits the ACTUAL available space
  // (never overflows), regardless of window size.
  const scrollAreaRef = useRef(null);
  const [scrollAreaW, setScrollAreaW] = useState(0);
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    setScrollAreaW(el.clientWidth);
    const ro = new ResizeObserver((entries) => { for (const e of entries) setScrollAreaW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [page != null]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitZoom = useMemo(() => {
    if (!page || scrollAreaW <= 0) return 1;
    return clamp((scrollAreaW - 24) / page.width, ZOOM_MIN, 1); // capped at 100% so small pages aren't blown up
  }, [page, scrollAreaW]);
  // Auto-fit the first page once the scroll area is measured, so a 5000px page doesn't open at 1:1.
  const didInitZoomRef = useRef(false);
  useEffect(() => {
    if (!didInitZoomRef.current && page && scrollAreaW > 0) {
      didInitZoomRef.current = true;
      setViewportZoom(clamp((scrollAreaW - 24) / page.width, ZOOM_MIN, 1));
    }
  }, [page, scrollAreaW]);

  // Currently-selected text item. Declared here (right after `page`) because it is
  // referenced inside useCallback dependency arrays further down (e.g. confirmSavePreset,
  // applyPreset). Dependency arrays are evaluated during render, so `sel` must already be
  // initialized by then — declaring it lower would put it in the Temporal Dead Zone and
  // throw "Cannot access 'sel' before initialization", blanking the whole app.
  const sel = page?.texts.find((t) => t.id === selectedText) ?? null;

  const updateText = useCallback((id, updates) => {
    setPages((prev) => {
      const updated = [...prev];
      const p = { ...updated[currentPage] };
      p.texts = p.texts.map((t) => (t.id === id ? { ...t, ...updates } : t));
      updated[currentPage] = p;
      return updated;
    });
  }, [currentPage]);

  // ── Per-character span styling: scope routing ──────────────────────────────
  // The span (in sel.spans) whose range matches the active spanRange, or null in box scope.
  const activeSpan = (spanRange && sel)
    ? (sel.spans ?? []).find((s) => s.start === spanRange.start && s.end === spanRange.end) ?? null
    : null;
  // What the style controls DISPLAY: box fields, overlaid with the active span's deltas.
  const styleView = (spanRange && sel) ? { ...sel, ...(activeSpan?.style ?? {}) } : sel;
  // Substring the active span covers (for the scope bar label).
  const spanText = (spanRange && sel) ? (sel.content ?? "").slice(spanRange.start, spanRange.end) : "";

  // Route a STYLE patch to the current scope: box → updateText; span → merge into the span delta.
  const writeStyle = useCallback((patch) => {
    if (!sel) return;
    if (!spanRange) { updateText(sel.id, patch); return; }
    const spans = [...(sel.spans ?? [])];
    let idx = spans.findIndex((s) => s.start === spanRange.start && s.end === spanRange.end);
    if (idx < 0) { spans.push({ start: spanRange.start, end: spanRange.end, style: {} }); idx = spans.length - 1; }
    spans[idx] = { ...spans[idx], style: { ...spans[idx].style, ...patch } };
    updateText(sel.id, { spans });
  }, [sel, spanRange, updateText]);

  // Begin styling the current Content selection: create/locate a span for that exact range.
  // Reads the live textarea selection (more reliable than the polled onSelect state).
  const styleSelection = useCallback(() => {
    if (!sel) return;
    const ta = contentTaRef.current;
    const start = ta ? ta.selectionStart : contentSelRef.current.start;
    const end   = ta ? ta.selectionEnd   : contentSelRef.current.end;
    if (end <= start) return;
    const spans = [...(sel.spans ?? [])];
    if (!spans.some((s) => s.start === start && s.end === end)) {
      spans.push({ start, end, style: {} });
      updateText(sel.id, { spans });
    }
    setSpanRange({ start, end });
  }, [sel, updateText]);

  // Clear the active span (remove its overrides) and return to box scope.
  const clearActiveSpan = useCallback(() => {
    if (!sel || !spanRange) { setSpanRange(null); return; }
    const spans = (sel.spans ?? []).filter((s) => !(s.start === spanRange.start && s.end === spanRange.end));
    updateText(sel.id, { spans });
    setSpanRange(null);
  }, [sel, spanRange, updateText]);

  const applyBoxPreset = useCallback((id, presetKey) => {
    const preset = getPresetConfig(presetKey);
    updateText(id, {
      boxStyle:       presetKey,
      boxFillColor:   preset.fillColor,
      boxFillOpacity: preset.fillOpacity,
      boxBorderColor: preset.borderColor,
      boxBorderOpacity: preset.borderOpacity,
      boxBorderWidth: preset.borderWidth,
      boxRadius:      preset.radius,
      // Switching box style resets to symmetric padding (overrides any per-side tweak).
      boxPaddingTop:    preset.paddingY,
      boxPaddingRight:  preset.paddingX,
      boxPaddingBottom: preset.paddingY,
      boxPaddingLeft:   preset.paddingX,
      boxPaddingX: undefined,
      boxPaddingY: undefined,
      boxFadeEdges: preset.fadeEdges ?? false,
    boxFeather: preset.feather ?? 30,
    });
  }, [updateText]);

  const handleTextureUpload = (prop, label) => (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel) return;
    const reader = new FileReader();
    reader.onload = (ev) => { saveHistory(label); updateText(sel.id, { [prop]: ev.target.result }); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const addText = () => {
    if (!page) return;
    saveHistory("Add text");
    const newItem = defaultTextItem(page.width, page.height);
    setPages((prev) => {
      const updated = [...prev];
      updated[currentPage] = { ...updated[currentPage], texts: [...updated[currentPage].texts, newItem] };
      return updated;
    });
    setSelectedText(newItem.id);
  };

  const deleteText = (id) => {
    if (!page) return;
    saveHistory("Delete text");
    setPages((prev) => {
      const updated = [...prev];
      const p = { ...updated[currentPage] };
      p.texts = p.texts.filter((t) => t.id !== id);
      updated[currentPage] = p;
      return updated;
    });
    const remaining = page.texts.filter((t) => t.id !== id);
    setSelectedText(remaining[0]?.id ?? null);
  };

  const duplicateText = (id) => {
    if (!page) return;
    saveHistory("Duplicate text");
    const item = page.texts.find((t) => t.id === id);
    if (!item) return;
    const newItem = {
      ...item,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      x: item.x + 20,
      y: item.y + 20,
    };
    setPages((prev) => {
      const updated = [...prev];
      updated[currentPage] = { ...updated[currentPage], texts: [...updated[currentPage].texts, newItem] };
      return updated;
    });
    setSelectedText(newItem.id);
  };

  const deletePage = (i) => {
    setPages((prev) => prev.filter((_, idx) => idx !== i));
    setCurrentPage((prev) => Math.max(0, i <= prev ? prev - 1 : prev));
    setSelectedText(null);
  };

  // Remove every page (images + subtitles). History only snapshots texts per page index, so a
  // full page wipe is NOT undoable — hence the confirm. Presets/recent colors are untouched.
  const clearAllPages = () => {
    if (pages.length === 0) return;
    if (!window.confirm(`Remove ALL ${pages.length} page(s) and their subtitles?\n\nStyle presets and recent colors are kept. This cannot be undone.`)) return;
    setPages([]);
    setCurrentPage(0);
    setSelectedText(null);
    setSpanRange(null);
    historyRef.current = [];
    historyIdxRef.current = -1;
    // Persist the wipe IMMEDIATELY — the autosave is debounced 2s, and closing the app inside
    // that window would resurrect the cleared pages on next launch.
    const payload = JSON.stringify({ storyId, pages: [] });
    const api = window.templateEditorDesktop;
    if (api?.saveSession) api.saveSession(payload).catch(() => {});
    else { try { localStorage.setItem("ymi-session", payload); } catch { /* ignore */ } }
  };

  // ── Style presets ──────────────────────────────────────────────────────────
  const confirmSavePreset = useCallback(() => {
    if (!sel || presetDraft === null) return;
    const name = presetDraft.trim() || `Style ${presets.length + 1}`;
    const styles = {};
    STYLE_PRESET_KEYS.forEach((k) => { if (sel[k] !== undefined) styles[k] = sel[k]; });
    setPresets((prev) => [...prev, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, styles }]);
    setPresetDraft(null);
  }, [sel, presetDraft, presets.length]);

  // Save the {name} token's EFFECTIVE style (base text ⊕ nameStyle overrides) as a preset.
  // Snapshotting the resolved style makes the preset self-contained: applying it elsewhere
  // reproduces the exact look regardless of the target box's base style. Marked source:"name"
  // so preset lists can badge it; it lives in the same ymi-style-presets pool and can be
  // applied to whole boxes too (NAME_STYLE_KEYS ⊂ STYLE_PRESET_KEYS).
  const confirmSaveNamePreset = useCallback(() => {
    if (!sel?.nameStyle?.enabled || namePresetDraft === null) return;
    const name = namePresetDraft.trim() || `Name style ${presets.length + 1}`;
    const eff = resolveNameStyle(sel); // full effective item for the {name} token
    const styles = {};
    NAME_STYLE_KEYS.forEach((k) => { if (eff[k] !== undefined) styles[k] = eff[k]; });
    setPresets((prev) => [...prev, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, styles, source: "name" }]);
    setNamePresetDraft(null);
  }, [sel, namePresetDraft, presets.length]);

  // Show the revertable "Applied X · Undo" toast for 6s.
  const showPresetUndo = useCallback((textId, beforePatch, name, scope) => {
    setPresetUndo({ textId, beforePatch, name, scope });
    if (presetUndoTimerRef.current) clearTimeout(presetUndoTimerRef.current);
    presetUndoTimerRef.current = setTimeout(() => setPresetUndo(null), 6000);
  }, []);

  // Apply a saved preset to the whole text box. Captures the prior values of the
  // exact keys the preset overwrites, so the apply can be cleanly reverted.
  const applyPreset = useCallback((preset) => {
    if (!sel) return;
    const styles = normalizePaddingStyles(preset.styles); // migrate legacy symmetric padding
    const before = {};
    Object.keys(styles).forEach((k) => { before[k] = sel[k]; });
    saveHistory("Apply style preset");
    updateText(sel.id, styles);
    showPresetUndo(sel.id, before, preset.name, "box");
  }, [sel, saveHistory, updateText, showPresetUndo]);

  // Apply a saved preset to the {name} token only. The {name} sub-style supports a
  // smaller key set than a full preset, so we take the intersection with NAME_STYLE_KEYS
  // and merge it into nameStyle — box/underline/transform/bevel/texture keys are ignored.
  const applyPresetToName = useCallback((preset) => {
    if (!sel?.nameStyle?.enabled) return;
    const filtered = {};
    NAME_STYLE_KEYS.forEach((k) => { if (preset.styles[k] !== undefined) filtered[k] = preset.styles[k]; });
    if (Object.keys(filtered).length === 0) return;
    const beforeNameStyle = JSON.parse(JSON.stringify(sel.nameStyle));
    saveHistory("Apply preset to name");
    updateText(sel.id, { nameStyle: { ...sel.nameStyle, ...filtered } });
    showPresetUndo(sel.id, { nameStyle: beforeNameStyle }, preset.name, "name");
  }, [sel, saveHistory, updateText, showPresetUndo]);

  // Revert the last preset apply to the exact state captured before it.
  const undoPresetApply = useCallback(() => {
    if (!presetUndo) return;
    updateText(presetUndo.textId, presetUndo.beforePatch);
    setPresetUndo(null);
    if (presetUndoTimerRef.current) clearTimeout(presetUndoTimerRef.current);
  }, [presetUndo, updateText]);

  const deletePreset = useCallback((id) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addRecentColor = useCallback((hex) => {
    if (!hex || !hex.startsWith("#")) return;
    setRecentColors((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 6));
  }, []);

  // Remember a dialled-in custom gradient so it can be re-applied from the Color panel.
  const addRecentGradient = useCallback((g) => {
    if (!g?.start || !g?.end) return;
    const norm = { start: g.start, end: g.end, angle: g.angle ?? 180 };
    const key = (x) => `${x.start}|${x.end}|${x.angle}`.toUpperCase();
    setRecentGradients((prev) => [norm, ...prev.filter((c) => key(c) !== key(norm))].slice(0, 6));
  }, []);

  const handleDragStart = (e, id) => {
    e.stopPropagation();
    if (!page) return;
    setSelectedText(id);
    const item = page.texts.find((t) => t.id === id);
    if (!item) return;
    dragLivePos.current = { x: item.x, y: item.y };
    setInteraction({
      type: "drag",
      id,
      startX: e.clientX,
      startY: e.clientY,
      scale,
      origX: item.x,
      origY: item.y,
      width: item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH,
      height: item.boxHeight ?? MIN_BOX_HEIGHT,
    });
  };

  // handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'
  const handleResizeStart = (e, id, handle) => {
    e.stopPropagation();
    e.preventDefault();
    if (!page) return;
    setSelectedText(id);
    const item = page.texts.find((t) => t.id === id);
    if (!item) return;
    resizeMovedRef.current = false;
    setInteraction({
      type: "resize",
      handle,
      id,
      startX: e.clientX,
      startY: e.clientY,
      scale,
      origX: item.x,
      origY: item.y,
      origWidth: item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH,
      origHeight: item.boxHeight ?? MIN_BOX_HEIGHT,
    });
  };

  const SNAP_THRESHOLD = 8;

  const handleMouseMove = useCallback((e) => {
    if (!interaction || !page) return;

    if (interaction.type === "drag") {
      const dx = (e.clientX - interaction.startX) / interaction.scale;
      const dy = (e.clientY - interaction.startY) / interaction.scale;
      const bw = interaction.width;
      const bh = interaction.height;
      let rawX = clamp(Math.round(interaction.origX + dx), 0, Math.max(0, page.width - bw));
      let rawY = clamp(Math.round(interaction.origY + dy), 0, Math.max(0, page.height - bh));

      // Build snap target lists from page edges/center + other text boxes
      const snapX = [0, Math.round(page.width / 2), page.width];
      const snapY = [0, Math.round(page.height / 2), page.height];
      for (const t of page.texts) {
        if (t.id === interaction.id) continue;
        const tw = t.boxWidth ?? t.maxWidth ?? MIN_BOX_WIDTH;
        const th = t.boxHeight ?? MIN_BOX_HEIGHT;
        snapX.push(t.x, Math.round(t.x + tw / 2), t.x + tw);
        snapY.push(t.y, Math.round(t.y + th / 2), t.y + th);
      }

      const guides = [];
      let snappedX = rawX;
      let snappedY = rawY;

      const dragXPts = [rawX, Math.round(rawX + bw / 2), rawX + bw];
      for (let di = 0; di < dragXPts.length; di++) {
        for (const tx of snapX) {
          if (Math.abs(dragXPts[di] - tx) <= SNAP_THRESHOLD) {
            snappedX = clamp(tx - (di === 0 ? 0 : di === 1 ? Math.round(bw / 2) : bw), 0, Math.max(0, page.width - bw));
            guides.push({ axis: "v", pos: tx });
            break;
          }
        }
        if (snappedX !== rawX) break;
      }

      const dragYPts = [rawY, Math.round(rawY + bh / 2), rawY + bh];
      for (let di = 0; di < dragYPts.length; di++) {
        for (const ty of snapY) {
          if (Math.abs(dragYPts[di] - ty) <= SNAP_THRESHOLD) {
            snappedY = clamp(ty - (di === 0 ? 0 : di === 1 ? Math.round(bh / 2) : bh), 0, Math.max(0, page.height - bh));
            guides.push({ axis: "h", pos: ty });
            break;
          }
        }
        if (snappedY !== rawY) break;
      }

      // ── PERF: apply position via CSS transform directly on the DOM element ──
      // This bypasses React's reconciler entirely — zero re-renders during drag.
      // React still owns left/top (at origX/origY); transform handles the delta.
      dragLivePos.current = { x: snappedX, y: snappedY };
      const el = textBoxRefs.current.get(interaction.id);
      if (el) {
        const tdx = (snappedX - interaction.origX) * interaction.scale;
        const tdy = (snappedY - interaction.origY) * interaction.scale;
        el.style.transform = `translate(${tdx}px, ${tdy}px)`;
      }

      // Snap guides: RAF-throttled so they don't force a React render every pixel
      if (snapRAFRef.current) cancelAnimationFrame(snapRAFRef.current);
      snapRAFRef.current = requestAnimationFrame(() => setSnapGuides(guides));
      return;
    }

    // ── Resize: RAF-throttled (caps React updates at 60fps) ──────────────────
    if (resizeRAFRef.current) cancelAnimationFrame(resizeRAFRef.current);
    resizeRAFRef.current = requestAnimationFrame(() => {
      if (!interaction || interaction.type !== "resize") return;
      const dx = (e.clientX - interaction.startX) / interaction.scale;
      const dy = (e.clientY - interaction.startY) / interaction.scale;
      const h = interaction.handle ?? "se";

      let newX = interaction.origX;
      let newY = interaction.origY;
      let newW = interaction.origWidth;
      let newH = interaction.origHeight;

      if (h.includes("e")) newW = clamp(Math.round(interaction.origWidth + dx), MIN_BOX_WIDTH, page.width - interaction.origX);
      if (h.includes("w")) {
        const rawX = Math.max(0, interaction.origX + Math.round(dx));
        newX = rawX;
        newW = Math.max(MIN_BOX_WIDTH, interaction.origX + interaction.origWidth - rawX);
      }
      if (h.includes("s")) newH = clamp(Math.round(interaction.origHeight + dy), MIN_BOX_HEIGHT, page.height - interaction.origY);
      if (h.includes("n")) {
        const rawY = Math.max(0, interaction.origY + Math.round(dy));
        newY = rawY;
        newH = Math.max(MIN_BOX_HEIGHT, interaction.origY + interaction.origHeight - rawY);
      }

      resizeMovedRef.current = true;
      updateText(interaction.id, { x: newX, y: newY, boxWidth: newW, maxWidth: newW, boxHeight: newH });
    });
  }, [interaction, page, updateText]);

  const handleMouseUp = useCallback(() => {
    if (interaction?.type === "drag") {
      const el = textBoxRefs.current.get(interaction.id);
      if (el) el.style.transform = "";
      const { x: lx, y: ly } = dragLivePos.current;
      // Only commit if the item actually moved (guards against pure-click position reset)
      if (lx !== interaction.origX || ly !== interaction.origY) {
        saveHistory("Move text");
        updateText(interaction.id, { x: lx, y: ly });
      }
    }
    if (interaction?.type === "resize" && resizeMovedRef.current) {
      saveHistory("Resize text");
    }
    if (snapRAFRef.current) cancelAnimationFrame(snapRAFRef.current);
    if (resizeRAFRef.current) cancelAnimationFrame(resizeRAFRef.current);
    setInteraction(null);
    setSnapGuides([]);
  }, [interaction, updateText, saveHistory]);

  useEffect(() => {
    if (!interaction) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [interaction, handleMouseMove, handleMouseUp]);

  const wrapTextCanvas = (ctx, text, maxWidth) => {
    const lines = [];
    for (const para of text.split("\n")) {
      const words = para.split(" ");
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  };

  // ── Shared canvas renderer ──────────────────────────────────────────────────
  // Renders one page (image + texts) into a PNG Blob. Pure function — no state.
  const renderPageToPngBlob = async (pageData, resolvedName, failedFonts) => {
    const canvas = document.createElement("canvas");
    canvas.width = pageData.width;
    canvas.height = pageData.height;
    const ctx = canvas.getContext("2d");

    // Make sure every font used on this page is loaded before we measure/draw —
    // otherwise canvas silently falls back to a default face (the #1 cause of
    // "the exported PNG looks different from the workbench").
    await loadSubtitleFonts(pageData.texts, failedFonts);

    // Background image
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = pageData.image; });
    ctx.drawImage(img, 0, 0, pageData.width, pageData.height);

    for (const item of pageData.texts) {
      await drawTextItem(ctx, item, resolvedName);
    }

    return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));
  };

  // ── Shared per-text-box drawing — the SINGLE source of truth for BOTH the live
  // preview and PNG export, so the workbench shows exactly what gets exported.
  // Draws box fill/border + text (all effects + mixed {name}) at the item's absolute
  // page coordinates onto ctx. Does not clear the target or manage page-level state.
  const drawTextItem = async (ctx, item, resolvedName) => {
      const bx = item.x;
      const by = item.y;
      const bw = item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH;
      const bh = item.boxHeight ?? MIN_BOX_HEIGHT;
      const r  = item.boxRadius ?? 0;

      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;

      // Box fill
      if ((item.boxFillOpacity ?? 0) > 0) {
        ctx.save();
        ctx.globalAlpha = item.opacity ?? 1;

        if (item.boxFadeEdges) {
          // Cloud / Mist — a FEATHERED rounded rectangle: a solid rounded rect whose edges are
          // softened with a blur, giving a uniform body that dissolves into the background.
          // (Replaces the old elliptical radial gradient, which read as a dim oval with empty
          // corners.) `boxFeather` = edge softness in px; the blur spreads ~feather px outward.
          const col = item.boxFillColor ?? "#FFFFFF";
          const op  = item.boxFillOpacity ?? 0.85;
          const feather = Math.max(2, item.boxFeather ?? 30);
          const pad = Math.ceil(feather * 2);
          const off = document.createElement("canvas");
          off.width = Math.max(1, Math.ceil(bw + pad * 2));
          off.height = Math.max(1, Math.ceil(bh + pad * 2));
          const oc = off.getContext("2d");
          oc.fillStyle = hexToRgba(col, op);
          oc.beginPath();
          oc.roundRect(pad, pad, bw, bh, r);
          oc.fill();
          ctx.filter = `blur(${feather}px)`;
          ctx.drawImage(off, bx - pad, by - pad);
          ctx.filter = "none";
        } else {
          ctx.globalAlpha = (item.opacity ?? 1) * (item.boxFillOpacity ?? 0);
          ctx.fillStyle = item.boxFillColor ?? "#0F172A";
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, r);
          ctx.fill();
        }

        ctx.restore();
      }

      // Box border
      if ((item.boxBorderWidth ?? 0) > 0 && (item.boxBorderOpacity ?? 0) > 0) {
        ctx.save();
        ctx.globalAlpha = (item.opacity ?? 1) * (item.boxBorderOpacity ?? 0);
        ctx.strokeStyle = item.boxBorderColor ?? "#FFFFFF";
        ctx.lineWidth   = item.boxBorderWidth ?? 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, r);
        ctx.stroke();
        ctx.restore();
      }

      const pad    = resolvePad(item);
      const padL = pad.left, padR = pad.right, padT = pad.top, padB = pad.bottom;
      const valign = item.verticalAlign ?? "top";
      const textX  = bx + padL;
      const availW = bw - padL - padR;
      const cxCenter = bx + padL + availW / 2; // horizontal center of the padded text area
      // Vertical offset of the whole text block within the padded box area (top/middle/bottom).
      const vBlockOffset = (lineCount, lineH) => {
        const paddedH = bh - padT - padB;
        const textH = Math.max(0, lineCount) * lineH;
        if (valign === "middle") return Math.max(0, (paddedH - textH) / 2);
        if (valign === "bottom") return Math.max(0, paddedH - textH);
        return 0;
      };
      const align  = item.textAlign ?? "left";
      const tt     = item.textTransform ?? "none";
      const applyTT = (s) => applyTransform(s, tt); // single source of truth (module-level)

      const nameEff = resolveNameStyle(item);
      const hasNameStyle = nameEff && item.content.includes("{name}");
      const hasSpans = Array.isArray(item.spans) && item.spans.some((s) => s && s.style && s.end > s.start);

      // ── Helper: set canvas font state for a given effective item ─────────────
      const setFont = (eff) => {
        ctx.font = `${eff.italic ? "italic " : ""}${resolveWeight(eff)} ${eff.size}px ${eff.font}`;
        ctx.letterSpacing = `${eff.letterSpacing ?? 0}px`;
      };

      if (!hasNameStyle && !hasSpans) {
        // ── Single-style rendering (original path) ─────────────────────────────
        const colorVal = item.color === "custom" ? (item.customColor ?? "#FFFFFF") : item.color;
        ctx.fillStyle  = buildCanvasGradient(ctx, colorVal, bx, by, bh, bw, item);
        const fontStr  = `${item.italic ? "italic " : ""}${resolveWeight(item)} ${item.size}px ${item.font}`;
        ctx.font       = fontStr;
        ctx.letterSpacing = `${item.letterSpacing ?? 0}px`;
        const lineH    = item.size * (item.lineHeight ?? 1.2);
        const content  = applyTT(item.content.replace(/\{name\}/g, resolvedName));
        const lines    = wrapTextCanvas(ctx, content, availW);
        const vOffset  = vBlockOffset(lines.length, lineH);
        ctx.textAlign  = align;
        const alignX   = align === "center" ? cxCenter : align === "right" ? bx + bw - padR : textX;
        const drawLines = (cx, drawFn) => lines.forEach((line, li) => drawFn(line, cx, by + padT + vOffset + item.size + li * lineH));

        // Glow: the halo is the SHADOW of opaque glyphs (Chromium scales shadow alpha by the
        // source alpha, so a near-transparent fill yields NO glow). The opaque glyph is covered
        // by the later fill pass, leaving only the blurred halo. Drawn 3× to intensify.
        if (item.glow) { ctx.save(); ctx.shadowColor = hexToRgba(item.glowColor ?? "#FFD700", item.glowOpacity ?? 0.85); ctx.shadowBlur = item.glowBlur ?? 20; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = item.glowColor ?? "#FFD700"; for (let g = 0; g < 3; g++) drawLines(alignX, (ln, ax, ay) => ctx.fillText(ln, ax, ay)); ctx.restore(); }
        if (item.bevel) {
          ctx.save();
          const depth = item.bevelDepth ?? 4; const sh = item.bevelShadow ?? "#000000"; const hi = item.bevelHighlight ?? "#FFFFFF";
          const drawBevelSteps = (fs) => { for (let i = depth; i >= 1; i--) { const a = 0.08 + ((depth-i+1)/depth)*0.42; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = fs; drawLines(alignX+i,(ln,ax,ay)=>ctx.fillText(ln,ax,ay+i)); ctx.restore(); } };
          if (item.bevelTexture) { const ti = await new Promise(res=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>res(null);img.src=item.bevelTexture;}); ti?drawBevelSteps(ctx.createPattern(ti,"repeat")):drawBevelSteps(hexToRgba(sh,1)); } else { for(let i=depth;i>=1;i--){const a=0.08+((depth-i+1)/depth)*0.42;ctx.fillStyle=hexToRgba(sh,a);drawLines(alignX+i,(ln,ax,ay)=>ctx.fillText(ln,ax,ay+i));} }
          ctx.fillStyle = hexToRgba(hi, 0.35); drawLines(alignX-1,(ln,ax,ay)=>ctx.fillText(ln,ax,ay-1)); ctx.restore();
        }
        // Shadow: cast by an OPAQUE glyph (Chromium scales shadow alpha by source alpha, so a
        // near-transparent fill = no shadow). The glyph is overwritten by the later fill pass.
        if (item.shadow) { ctx.save(); ctx.shadowColor=hexToRgba(item.shadowColor??"#000000",item.shadowOpacity??0.5); ctx.shadowBlur=item.shadowBlur??8; ctx.shadowOffsetX=item.shadowOffsetX??2; ctx.shadowOffsetY=item.shadowOffsetY??4; ctx.fillStyle=hexToRgba(item.shadowColor??"#000000",1); drawLines(alignX,(ln,ax,ay)=>ctx.fillText(ln,ax,ay)); ctx.restore(); }
        if (item.stroke) { ctx.lineWidth=item.strokeWidth??4; ctx.strokeStyle=hexToRgba(item.strokeColor??"#000000",item.strokeOpacity??1); ctx.lineJoin="round"; drawLines(alignX,(ln,ax,ay)=>ctx.strokeText(ln,ax,ay)); }
        ctx.shadowColor="transparent"; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
        if (item.textureImage) {
          const off=document.createElement("canvas"); off.width=bw; off.height=bh; const oc=off.getContext("2d");
          oc.font=fontStr; oc.letterSpacing=`${item.letterSpacing??0}px`; oc.textAlign=align;
          const oax=align==="center"?(padL+availW/2):align==="right"?(bw-padR):padL; oc.fillStyle="#fff";
          lines.forEach((line,li)=>oc.fillText(line,oax,padT+vOffset+item.size+li*lineH));
          const ti=new Image(); await new Promise(res=>{ti.onload=res;ti.src=item.textureImage;}); oc.globalCompositeOperation="source-in"; oc.drawImage(ti,0,0,bw,bh); ctx.drawImage(off,bx,by);
        } else {
          lines.forEach((line, li) => ctx.fillText(line, alignX, by + padT + vOffset + item.size + li * lineH));
        }
      } else {
        // ── General multi-run rendering — handles {name} AND per-character span overrides ──
        // Content is split into WORDS (the unit of line-wrapping) made of RUNS (the unit of
        // styling/drawing). A run is a maximal stretch of characters sharing one effective style:
        //   base item ⊕ nameStyle (for the {name} token) ⊕ the span override covering those chars.
        // The old {name} mixed mode is just the special case "one run = the name". Every effect
        // pass (glow/bevel/shadow/stroke/fill+texture) reads run.eff so each run is independent.
        const spans = (item.spans ?? []).filter((s) => s && s.style && s.end > s.start);
        const nameStyleObj = item.nameStyle?.enabled ? item.nameStyle : null;
        const baseTT = item.textTransform ?? "none";
        // The span.style object reference covering a raw-content offset (last match wins).
        const spanRefAt = (pos) => { let st = null; for (const s of spans) if (pos >= s.start && pos < s.end) st = s.style; return st; };
        // Fully-resolved effective style for a run: clone base, layer nameStyle then span delta.
        const effFor = (spanStyle, isName) => {
          const eff = { ...item };
          if (isName && nameStyleObj) NAME_STYLE_KEYS.forEach((k) => { if (nameStyleObj[k] != null) eff[k] = nameStyleObj[k]; });
          if (spanStyle)             NAME_STYLE_KEYS.forEach((k) => { if (spanStyle[k]   != null) eff[k] = spanStyle[k]; });
          return eff;
        };

        // 1. Split raw content into {name} / literal segments, tracking raw offsets so spans map.
        const segs = [];
        { const re = /\{name\}/g; let last = 0, m;
          while ((m = re.exec(item.content)) !== null) {
            if (m.index > last) segs.push({ text: item.content.slice(last, m.index), rawStart: last, isName: false });
            segs.push({ text: "{name}", rawStart: m.index, isName: true });
            last = m.index + m[0].length;
          }
          if (last < item.content.length) segs.push({ text: item.content.slice(last), rawStart: last, isName: false });
          if (segs.length === 0) segs.push({ text: "", rawStart: 0, isName: false });
        }

        // 2. Build words → runs. Words break at spaces/newlines; runs break at span/name edges.
        const words = [];
        let cur = null;
        const flush = () => { if (cur && cur.runs.length) words.push(cur); cur = null; };
        const startWord = () => { if (!cur) cur = { runs: [], isSpace: false }; return cur; };
        const addChar = (ch, spanRef) => {
          const w = startWord();
          const lastRun = w.runs[w.runs.length - 1];
          if (lastRun && lastRun.spanRef === spanRef && !lastRun.isName) lastRun.raw += ch;
          else w.runs.push({ raw: ch, spanRef, isName: false });
        };
        for (const seg of segs) {
          if (seg.isName) {
            flush();
            words.push({ runs: [{ raw: resolvedName, spanRef: spanRefAt(seg.rawStart), isName: true }], isSpace: false });
          } else {
            for (let i = 0; i < seg.text.length; i++) {
              const ch = seg.text[i];
              if (ch === "\n") { flush(); words.push({ isNewline: true }); continue; }
              const ref = spanRefAt(seg.rawStart + i);
              if (ch === " ") { flush(); words.push({ runs: [{ raw: " ", spanRef: ref, isName: false }], isSpace: true }); }
              else addChar(ch, ref);
            }
            flush();
          }
        }
        flush();

        // 3. Resolve each run's effective style + transformed text, measure with its own font.
        const allRuns = [];
        for (const word of words) {
          if (word.isNewline) { word.width = 0; continue; }
          let wsum = 0;
          for (const run of word.runs) {
            run.eff  = effFor(run.spanRef, run.isName);
            run.text = applyTransform(run.raw, run.eff.textTransform ?? baseTT);
            setFont(run.eff);
            run.width = ctx.measureText(run.text).width;
            wsum += run.width;
            allRuns.push(run);
          }
          word.width = wsum;
        }
        // Line height = tallest run's line box (keeps multi-size lines from overlapping).
        const lineH = Math.max(
          item.size * (item.lineHeight ?? 1.2),
          ...allRuns.map((r) => (r.eff.size ?? item.size) * (r.eff.lineHeight ?? item.lineHeight ?? 1.2)),
        );

        // 4. Pack WORDS into lines (word-level wrapping keeps a word's runs together on one line).
        const mixedLines = [[]];
        let lw = 0;
        for (const word of words) {
          if (word.isNewline) { mixedLines.push([]); lw = 0; continue; }
          if (word.isSpace && lw === 0) continue; // skip leading spaces on new lines
          if (!word.isSpace && lw + word.width > availW && lw > 0) { mixedLines.push([]); lw = 0; }
          mixedLines[mixedLines.length - 1].push(word);
          lw += word.width;
        }
        const vOffset = vBlockOffset(mixedLines.length, lineH);

        // Alignment width must IGNORE trailing (and leading) spaces — exactly like the single-
        // style path, whose wrapped line strings carry no trailing space. Counting a wrapped
        // line's trailing space here would shift centered/right text off by ~half a space width
        // per line (severe at subtitle sizes), misaligning lines against each other.
        const lineContentWidth = (line) => {
          let s = 0, e = line.length;
          while (s < e && line[s].isSpace) s++;
          while (e > s && line[e - 1].isSpace) e--;
          let w = 0; for (let i = s; i < e; i++) w += line[i].width;
          return w;
        };
        const lineStartX = (line) => {
          const totalW = lineContentWidth(line);
          if (align === "center") return cxCenter - totalW / 2;
          if (align === "right")  return bx + bw - padR - totalW;
          return textX;
        };
        // Iterate every run with its baseline (x, y). Baseline ascent stays at item.size — the
        // same as the previous {name} mixed path — so existing layouts don't shift vertically.
        const forEachRun = (cb) => {
          mixedLines.forEach((line, li) => {
            const y = by + padT + vOffset + item.size + li * lineH;
            let x = lineStartX(line);
            for (const word of line) for (const run of word.runs) { cb(run, x, y); x += run.width; }
          });
        };

        // Runs are positioned manually at their LEFT edge (lineStartX + advance). fillText/
        // strokeText honour ctx.textAlign, so we MUST pin it to "left" — otherwise a center/right
        // textAlign left over from a previously-drawn item (the single-style path sets it) would
        // re-anchor every run and shatter the layout. Same for the baseline.
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // 5. Glow (per-run; opaque source so the shadow halo actually renders — covered by fill).
        ctx.save();
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        forEachRun((run, x, y) => {
          const eff = run.eff;
          if (!eff.glow) return;
          ctx.save();
          ctx.shadowColor = hexToRgba(eff.glowColor ?? "#FFD700", eff.glowOpacity ?? 0.85);
          ctx.shadowBlur  = eff.glowBlur ?? 20;
          ctx.fillStyle   = eff.glowColor ?? "#FFD700";
          setFont(eff);
          for (let g = 0; g < 3; g++) ctx.fillText(run.text, x, y);
          ctx.restore();
        });
        ctx.restore();

        // 6. Bevel (per-run).
        forEachRun((run, x, y) => {
          const eff = run.eff;
          if (!eff.bevel) return;
          ctx.save();
          setFont(eff);
          const depth = eff.bevelDepth ?? 4; const sh = eff.bevelShadow ?? "#000000"; const hi = eff.bevelHighlight ?? "#FFFFFF";
          for (let i = depth; i >= 1; i--) {
            const a = 0.08 + ((depth - i + 1) / depth) * 0.42;
            ctx.globalAlpha = a; ctx.fillStyle = hexToRgba(sh, a); ctx.fillText(run.text, x + i, y + i);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = hexToRgba(hi, 0.35); ctx.fillText(run.text, x - 1, y - 1);
          ctx.restore();
        });

        // 7. Shadow (per-run; opaque source).
        ctx.save();
        forEachRun((run, x, y) => {
          const eff = run.eff;
          if (!eff.shadow) return;
          ctx.save();
          ctx.shadowColor   = hexToRgba(eff.shadowColor ?? "#000000", eff.shadowOpacity ?? 0.5);
          ctx.shadowBlur    = eff.shadowBlur ?? 8;
          ctx.shadowOffsetX = eff.shadowOffsetX ?? 2;
          ctx.shadowOffsetY = eff.shadowOffsetY ?? 4;
          ctx.fillStyle     = hexToRgba(eff.shadowColor ?? "#000000", 1);
          setFont(eff);
          ctx.fillText(run.text, x, y);
          ctx.restore();
        });
        ctx.restore();

        // 8. Stroke (per-run).
        forEachRun((run, x, y) => {
          const eff = run.eff;
          if (!eff.stroke) return;
          setFont(eff);
          ctx.lineWidth   = eff.strokeWidth ?? 4;
          ctx.strokeStyle = hexToRgba(eff.strokeColor ?? "#000000", eff.strokeOpacity ?? 1);
          ctx.lineJoin    = "round";
          ctx.strokeText(run.text, x, y);
        });

        // 9. Fill (per-run gradient/solid OR texture mask). Textures preloaded once per src.
        const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
        const texSrcs = [...new Set(allRuns.map((r) => r.eff.textureImage).filter(Boolean))];
        const texMap = new Map();
        for (const src of texSrcs) texMap.set(src, await loadImg(src));
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        forEachRun((run, x, y) => {
          const eff = run.eff;
          setFont(eff);
          const tex = eff.textureImage ? texMap.get(eff.textureImage) : null;
          if (tex) {
            // Texture fill: mask the texture to this run's glyphs via an offscreen canvas.
            const w = Math.max(1, Math.ceil(run.width) + 2);
            const h = Math.max(1, Math.ceil(eff.size * 1.5));
            const asc = eff.size; // baseline within the offscreen
            const off = document.createElement("canvas"); off.width = w; off.height = h;
            const oc = off.getContext("2d");
            oc.font = ctx.font; oc.letterSpacing = `${eff.letterSpacing ?? 0}px`; oc.fillStyle = "#fff";
            oc.fillText(run.text, 0, asc);
            oc.globalCompositeOperation = "source-in";
            oc.drawImage(tex, 0, 0, w, h);
            ctx.drawImage(off, x, y - asc);
          } else {
            const cVal = eff.color === "custom" ? (eff.customColor ?? "#FFFFFF") : eff.color;
            ctx.fillStyle = buildCanvasGradient(ctx, cVal, x, y - eff.size, eff.size, run.width || 1, eff);
            ctx.fillText(run.text, x, y);
          }
        });
      }

      ctx.restore();
  };

  // ── Single-page PNG export (current page) ───────────────────────────────────
  const exportPNG = async () => {
    if (!page || !page.image) { alert("Please upload an image for this page first."); return; }
    try {
      const failedFonts = new Set();
      const blob = await renderPageToPngBlob(page, previewName, failedFonts);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${storyId}_page${currentPage + 1}_preview.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000); // don't abort the download (browser race)
      warnAboutFonts(failedFonts);
    } catch (err) {
      console.error("PNG export failed:", err);
      alert(`PNG export failed: ${err?.message ?? err}`);
    }
  };

  // ── Batch PNG export → single ZIP download ─────────────────────────────────
  const exportAllPNG = async () => {
    const withImages = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.image);
    if (withImages.length === 0) { alert("No pages have images loaded. Upload images first."); return; }

    setBatchExporting(true);
    setBatchProgress({ done: 0, total: withImages.length });

    let failedPages = 0;
    try {
      const zip = new JSZip();
      const failedFonts = new Set();

      for (const { p, i } of withImages) {
        try {
          const blob = await renderPageToPngBlob(p, previewName, failedFonts);
          const stem = p.fileName ? p.fileName.replace(/\.[^.]+$/, "") : `page_${String(i + 1).padStart(2, "0")}`;
          // Zero-pad page number so files sort correctly in the folder
          const filename = `${String(i + 1).padStart(2, "0")}_${stem}_subtitle.png`;
          zip.file(filename, blob);
        } catch (err) {
          failedPages++;
          console.error(`Page ${i + 1} render failed:`, err);
        }
        setBatchProgress({ done: i + 1, total: withImages.length });
      }

      // PNGs are already compressed — STORE skips recompression (faster, far less memory
      // pressure on big books; DEFLATE gained ~nothing on PNG payloads).
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });

      const url = URL.createObjectURL(zipBlob);
      const a   = document.createElement("a");
      a.href    = url;
      a.download = `${storyId}_subtitles_${withImages.length}pages.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke AFTER the download has had time to start — revoking synchronously can abort
      // the download in some browsers (Firefox/Safari race).
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      warnAboutFonts(failedFonts);
      if (failedPages > 0) alert(`ZIP downloaded, but ${failedPages} page(s) failed to render — check those pages.`);
    } catch (err) {
      console.error("Batch export failed:", err);
      alert(`Batch export failed: ${err?.message ?? err}\n\nIf this keeps happening, refresh the page (Ctrl+Shift+R) and try again.`);
    } finally {
      // Always clear the overlay — a stuck "exporting…" screen was the old failure mode.
      setBatchExporting(false);
    }
  };

  // ── Batch image loader ─────────────────────────────────────────────────────
  // Strategy: try exact fileName match first; remaining files fill pages in order.
  // Works whether pages came from JSON import (image=null) or are already populated.
  const batchLoadImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    // Show progress immediately
    setImageLoadProgress({ active: true, done: 0, total: files.length });

    let doneCount = 0;
    const readFile = (file) =>
      new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          const img = new Image();
          img.onload = () => {
            doneCount++;
            // Update progress counter as each file finishes decoding
            setImageLoadProgress({ active: true, done: doneCount, total: files.length });
            res({ dataUrl, width: img.naturalWidth, height: img.naturalHeight, name: file.name });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });

    Promise.all(files.map(readFile)).then((results) => {
      setImageLoadProgress({ active: false, done: 0, total: 0 });
      setPages((prev) => {
        // ── Case A: no pages yet → create new pages for all files ────────────
        if (prev.length === 0) {
          return results.map((r) => ({
            image: r.dataUrl, fileName: r.name,
            width: r.width, height: r.height, texts: [],
          }));
        }

        // ── Case B: pages exist ───────────────────────────────────────────────
        // Rule: pages that ALREADY have an image are NEVER touched.
        //       Empty pages (image=null) get filled first — by fileName then by order.
        //       Files left over after all empty slots are filled → appended as new pages.

        const byName = new Map(results.map((r) => [r.name.toLowerCase(), r]));
        const usedFileNames = new Set();

        // Pass 1 — fill empty pages by exact fileName match
        const afterNameMatch = prev.map((p) => {
          if (p.image) return p; // already has image, never touch
          const key = (p.fileName ?? "").toLowerCase();
          if (key && byName.has(key)) {
            usedFileNames.add(key);
            const r = byName.get(key);
            // Image dims win — remap any JSON-space layout into the image's native pixels
            return { ...rescalePageLayout(p, r.width, r.height), image: r.dataUrl };
          }
          return p; // still empty, needs positional
        });

        // Pass 2 — fill remaining empty pages positionally (files not yet used)
        const positionalQueue = results.filter((r) => !usedFileNames.has(r.name.toLowerCase()));
        let posIdx = 0;
        const afterPositional = afterNameMatch.map((p) => {
          if (p.image) return p;
          if (posIdx < positionalQueue.length) {
            const r = positionalQueue[posIdx++];
            // Image dims win — remap any JSON-space layout into the image's native pixels.
            // Also take the file's REAL name: a positionally-filled page otherwise keeps its
            // stale fileName (from the JSON / a previous session), which then leaks into the
            // exported PNG names ("cache"-looking wrong names in the ZIP).
            return { ...rescalePageLayout(p, r.width, r.height), image: r.dataUrl, fileName: r.name };
          }
          return p; // no file left for this page
        });

        // Pass 3 — any remaining files (more than empty slots) → new pages
        const extraFiles = positionalQueue.slice(posIdx);
        const newPages = extraFiles.map((r) => ({
          image: r.dataUrl, fileName: r.name,
          width: r.width, height: r.height, texts: [],
        }));

        return [...afterPositional, ...newPages];
      });
    });
  };

  const resolveExportColor = (color, customColor, gradientStart) => {
    if (color === "custom_gradient") return gradientStart ?? "#FF8C00";
    if (color === "custom") return customColor ?? "#FFFFFF";
    return GRADIENT_COLOR_MAP[color] ?? color;
  };

  // Encode a span's sparse style delta for export: if it overrides the fill (color/texture),
  // emit a lossless `fill` descriptor + flat `color` (mirroring the top-level text), and drop
  // the editor-only raw gradient fields. Non-fill overrides (font/size/effects) pass through.
  const exportSpanStyle = (style = {}) => {
    const { color, customColor, customGradientStart, customGradientEnd, customGradientAngle, textureImage, ...rest } = style;
    const out = { ...rest };
    if (color !== undefined || textureImage !== undefined) {
      out.color = resolveExportColor(color, customColor, customGradientStart);
      out.fill = buildFill(color, customColor, customGradientStart, customGradientEnd, customGradientAngle, textureImage);
    }
    return out;
  };

  const generateExport = (mode = "all") => {
    const pagesToExport = mode === "current" ? [pages[currentPage]] : pages;
    const pageOffset = mode === "current" ? currentPage : 0;
    const config = {
      story_id: storyId,
      generated_at: new Date().toISOString(),
      pages: pagesToExport.map((p, i) => ({
        page: pageOffset + i + 1,
        image: p.fileName ?? `page_${pageOffset + i + 1}.png`,
        width: p.width ?? 0,
        height: p.height ?? 0,
        texts: p.texts.map((t) => {
          const pad = resolvePad(t);
          const {
            id, color, customColor, customGradientStart, customGradientEnd, customGradientAngle,
            textureImage, boxPaddingX, boxPaddingY,
            boxPaddingTop, boxPaddingRight, boxPaddingBottom, boxPaddingLeft,
            nameStyle, spans, ...rest
          } = t;
          const out = {
            ...rest,
            // `color` kept as a flat representative hex for simple consumers;
            // `fill` is the canonical, lossless fill descriptor the renderer should use.
            color: resolveExportColor(color, customColor, customGradientStart),
            fill: buildFill(color, customColor, customGradientStart, customGradientEnd, customGradientAngle, textureImage),
            // Canonical per-side padding (legacy symmetric boxPaddingX/Y dropped from output)
            boxPaddingTop:    pad.top,
            boxPaddingRight:  pad.right,
            boxPaddingBottom: pad.bottom,
            boxPaddingLeft:   pad.left,
          };
          // Per-character style runs (each style delta fill-encoded for the worker).
          if (Array.isArray(spans) && spans.length) {
            out.spans = spans
              .filter((s) => s && s.end > s.start)
              .map((s) => ({ start: s.start, end: s.end, style: exportSpanStyle(s.style ?? {}) }));
          }
          if (nameStyle?.enabled) {
            out.nameStyle = {
              ...nameStyle,
              fill: buildFill(nameStyle.color, nameStyle.customColor, nameStyle.customGradientStart, nameStyle.customGradientEnd, nameStyle.customGradientAngle, nameStyle.textureImage),
            };
          } else if (nameStyle !== undefined) {
            out.nameStyle = nameStyle; // null — no independent {name} styling
          }
          return out;
        }),
      })),
    };
    setExportJSON(JSON.stringify(config, null, 2));
    setExportMode(mode);
    setShowExport(true);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target.result);
        if (config.story_id) setStoryId(config.story_id);
        if (Array.isArray(config.pages)) {
          // Use functional update so we can read the current pages state.
          // This lets us PRESERVE existing images: if the user already uploaded
          // images (as pages) and then imports a JSON, the images are kept.
          // Matching priority: (1) fileName match, (2) same index.
          setPages((prev) => config.pages.map((p, jsonIdx) => {
            const wantedFileName = (p.image ?? "").toLowerCase();
            // Try to find an existing page that already has an image for this slot
            const byName  = wantedFileName ? prev.find(ep => ep.image && (ep.fileName ?? "").toLowerCase() === wantedFileName) : null;
            const byIndex = prev[jsonIdx];
            const existing = byName ?? byIndex ?? null;

            // Build the page in the JSON's own coordinate space first; if an existing image is
            // kept, rescalePageLayout below remaps everything into the image's NATIVE pixel
            // space (the image is the source of truth — never distort it to the JSON's dims).
            const built = {
              // Keep the existing image if we found one; otherwise null (needs batch assign later)
              image:    existing?.image ?? null,
              fileName: p.image ?? existing?.fileName ?? "",
              width:    p.width  ?? existing?.width  ?? 2480,
              height:   p.height ?? existing?.height ?? 3508,
              texts: (p.texts ?? []).map((t) => { const rec = recoverColorDescriptor(t); return {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              role: t.role ?? "body",
              content: t.content ?? "",
              x: t.x ?? 120,
              y: t.y ?? 120,
              font: t.font ?? "'Lora', serif",
              size: t.size ?? 42,
              // Restore the full colour descriptor from `fill` (gradients/textures survive
              // round-trip). Falls back to flat fields for legacy templates without `fill`.
              color: rec.color,
              customColor: rec.customColor,
              customGradientStart: rec.customGradientStart,
              customGradientEnd: rec.customGradientEnd,
              customGradientAngle: rec.customGradientAngle,
              textureImage: rec.textureImage,
              bold: t.bold ?? false,
              fontWeight: t.fontWeight ?? (t.bold ? 700 : 400),
              italic: t.italic ?? false,
              textAlign: t.textAlign ?? "left",
              verticalAlign: t.verticalAlign ?? "top",
              shadow: t.shadow ?? false,
              shadowColor: t.shadowColor ?? "#000000",
              shadowOpacity: t.shadowOpacity ?? 0.5,
              shadowBlur: t.shadowBlur ?? 8,
              shadowOffsetX: t.shadowOffsetX ?? 2,
              shadowOffsetY: t.shadowOffsetY ?? 4,
              autoScale: t.autoScale ?? true,
              maxWidth: t.maxWidth ?? t.boxWidth ?? 760,
              boxWidth: t.boxWidth ?? t.maxWidth ?? 760,
              boxHeight: t.boxHeight ?? 180,
              letterSpacing: t.letterSpacing ?? 0,
              lineHeight: t.lineHeight ?? 1.2,
              opacity: t.opacity ?? 1,
              boxStyle: t.boxStyle ?? "no_box",
              boxFillColor: t.boxFillColor ?? "#0F172A",
              boxFillOpacity: t.boxFillOpacity ?? 0,
              boxBorderColor: t.boxBorderColor ?? "#FFFFFF",
              boxBorderOpacity: t.boxBorderOpacity ?? 0,
              boxBorderWidth: t.boxBorderWidth ?? 0,
              boxRadius: t.boxRadius ?? 0,
              boxPaddingTop:    t.boxPaddingTop    ?? t.boxPaddingY ?? 0,
              boxPaddingRight:  t.boxPaddingRight  ?? t.boxPaddingX ?? 0,
              boxPaddingBottom: t.boxPaddingBottom ?? t.boxPaddingY ?? 0,
              boxPaddingLeft:   t.boxPaddingLeft   ?? t.boxPaddingX ?? 0,
              boxFadeEdges: t.boxFadeEdges ?? false,
              boxFeather: t.boxFeather ?? 30,
              stroke: t.stroke ?? false,
              strokeWidth: t.strokeWidth ?? 4,
              strokeColor: t.strokeColor ?? "#000000",
              strokeOpacity: t.strokeOpacity ?? 1,
              bevel: t.bevel ?? false,
              bevelDepth: t.bevelDepth ?? 4,
              bevelHighlight: t.bevelHighlight ?? "#FFFFFF",
              bevelShadow: t.bevelShadow ?? "#000000",
              bevelTexture: t.bevelTexture ?? null,
              glow: t.glow ?? false,
              glowColor: t.glowColor ?? "#FFD700",
              glowBlur: t.glowBlur ?? 20,
              glowOpacity: t.glowOpacity ?? 0.85,
              textTransform: t.textTransform ?? "none",
              underline: t.underline ?? false,
              nameStyle: t.nameStyle ?? null,
              // Per-character style runs — rebuild each span's style delta (fill recovered).
              spans: Array.isArray(t.spans)
                ? t.spans.filter((s) => s && s.end > s.start).map((s) => ({ start: s.start, end: s.end, style: importSpanStyle(s.style ?? {}) }))
                : [],
            }; }),
            };
            // Image dims win: remap the JSON-space layout into the kept image's native pixels.
            return existing?.image ? rescalePageLayout(built, existing.width, existing.height) : built;
          }));
          setCurrentPage(0);
          setSelectedText(null);
        }
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadJSON = () => {
    const blob = new Blob([exportJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportMode === "current"
      ? `${storyId}_page${currentPage + 1}_template.json`
      : `${storyId}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sync local textarea content whenever selection changes to a different text box
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalContent(sel?.content ?? ""); setSpanRange(null); }, [sel?.id]);

  // Commit Content edits, remapping span offsets so per-character styling survives text edits.
  const commitContent = useCallback((newContent) => {
    if (!sel) return;
    setPages((prev) => {
      const updated = [...prev];
      const p = { ...updated[currentPage] };
      p.texts = p.texts.map((t) => t.id === sel.id
        ? { ...t, content: newContent, spans: remapSpans(t.spans, t.content ?? "", newContent) }
        : t);
      updated[currentPage] = p;
      return updated;
    });
  }, [sel, currentPage]);

  // RAF-throttled updateText for sliders — caps React renders at 60fps during scrub
  const sliderUpdate = useCallback((id, updates) => {
    if (sliderRAFRef.current) cancelAnimationFrame(sliderRAFRef.current);
    sliderRAFRef.current = requestAnimationFrame(() => updateText(id, updates));
  }, [updateText]);

  // Scope-routed write helpers used by the style+effects panel. Defined here (not inside the
  // panel's IIFE) so the IIFE can alias them by a DIFFERENT name — aliasing a same-named const
  // inside the block would hit the temporal dead zone and blank the app on render.
  const styleScopeUpdate = (_id, patch) => writeStyle(patch);
  const styleScopeSlider = spanRange ? ((_id, patch) => writeStyle(patch)) : sliderUpdate;
  const styleScopeTexture = (prop, label) => (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { saveHistory(label); writeStyle({ [prop]: ev.target.result }); };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const renderedCanvasWidth = page ? page.width * scale : 0;
  const renderedCanvasHeight = page ? page.height * scale : 0;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setViewportZoom((prev) => clamp(prev * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setViewportZoom((prev) => clamp(prev / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
      } else if (event.key === "0") {
        event.preventDefault();
        setViewportZoom(1); // Ctrl+0 = 100% = 1:1 with the exported pixels
      } else if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const RESIZE_HANDLES = [
    { id: "nw", cx: 0,   cy: 0,   cursor: "nwse-resize" },
    { id: "n",  cx: 0.5, cy: 0,   cursor: "ns-resize"   },
    { id: "ne", cx: 1,   cy: 0,   cursor: "nesw-resize" },
    { id: "e",  cx: 1,   cy: 0.5, cursor: "ew-resize"   },
    { id: "se", cx: 1,   cy: 1,   cursor: "nwse-resize" },
    { id: "s",  cx: 0.5, cy: 1,   cursor: "ns-resize"   },
    { id: "sw", cx: 0,   cy: 1,   cursor: "nesw-resize" },
    { id: "w",  cx: 0,   cy: 0.5, cursor: "ew-resize"   },
  ];
  const HS = 9; // handle size px

  const renderTextBox = (item) => {
    const boxWidth = (item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH) * scale;
    const boxHeight = (item.boxHeight ?? MIN_BOX_HEIGHT) * scale;
    const isSelected = selectedText === item.id;
    const isDragging = interaction?.id === item.id && interaction.type === "drag";

    return (
      <div
        key={item.id}
        data-text-id={item.id}
        ref={(el) => {
          if (el) textBoxRefs.current.set(item.id, el);
          else textBoxRefs.current.delete(item.id);
        }}
        onMouseDown={(e) => handleDragStart(e, item.id)}
        style={{
          position: "absolute",
          left: item.x * scale,
          top: item.y * scale,
          width: boxWidth,
          height: boxHeight,
          // Box fill + border are painted by drawTextItem on the canvas (so preview === export);
          // the wrapper only carries selection outline + drag/resize affordances.
          outline: isSelected ? "2px solid rgba(56,189,248,0.9)" : "none",
          outlineOffset: "1px",
          boxSizing: "border-box",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          overflow: "visible",
        }}
      >
        <TextBoxCanvas item={item} previewName={previewName} scale={scale} draw={drawTextItem} />

        {isSelected && RESIZE_HANDLES.map((h) => (
          <div
            key={h.id}
            onMouseDown={(e) => handleResizeStart(e, item.id, h.id)}
            style={{
              position: "absolute",
              left: h.cx * boxWidth - HS / 2,
              top: h.cy * boxHeight - HS / 2,
              width: HS,
              height: HS,
              background: "#fff",
              border: "1.5px solid #38bdf8",
              borderRadius: 2,
              cursor: h.cursor,
              zIndex: 10,
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Söhne', system-ui, sans-serif", minHeight: "100vh", background: "#0D0D0D", color: "#E0E0E0" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #F5D478, #A67620)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#111" }}>Y</div>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.5 }}>YMI Story JSON Creator</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }}>Story ID:</span>
          <input value={storyId} onChange={(e) => setStoryId(e.target.value)} style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 10px", color: "#E0E0E0", fontSize: 13, width: 120 }} />
          <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>Preview name:</span>
          <input value={previewName} onChange={(e) => setPreviewName(e.target.value)} style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 10px", color: "#E0E0E0", fontSize: 13, width: 100 }} />
          <label style={{ background: "#1A1A1A", color: "#aaa", border: "1px solid #444", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", marginLeft: 8 }}>
            Import JSON
            <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
          </label>
          <button onClick={generateExport} style={{ background: "linear-gradient(135deg, #F5D478, #A67620)", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginLeft: 4 }}>
            Export JSON
          </button>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
        <div style={{ width: 180, borderRight: "1px solid #222", padding: 12, overflowY: "auto", flexShrink: 0 }}>
          <label style={{ display: "block", padding: "10px 0", textAlign: "center", border: "2px dashed #333", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#888", marginBottom: 6 }}>
            + Upload pages (new)
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
          </label>
          {/* ── Assign images button + live progress ── */}
          {imageLoadProgress.active ? (
            // Loading state: button replaced by animated progress indicator
            <div style={{ marginBottom: 6, border: "1px solid #1d4ed8", borderRadius: 8, background: "#0d1833", overflow: "hidden" }}>
              <div style={{ padding: "7px 8px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                {/* Spinner */}
                <svg width="13" height="13" viewBox="0 0 13 13" style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }}>
                  <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="20 12" />
                </svg>
                <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, flex: 1 }}>
                  Loading {imageLoadProgress.done} / {imageLoadProgress.total}
                </span>
                <span style={{ fontSize: 10, color: "#3b82f6" }}>
                  {imageLoadProgress.total > 0 ? Math.round((imageLoadProgress.done / imageLoadProgress.total) * 100) : 0}%
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 3, background: "#1e3a5f" }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #2563eb, #60a5fa)",
                  width: `${imageLoadProgress.total > 0 ? (imageLoadProgress.done / imageLoadProgress.total) * 100 : 0}%`,
                  transition: "width 0.15s ease",
                }} />
              </div>
            </div>
          ) : (
            <label
              title="Pick images and assign them to existing pages — matches by filename first, then fills remaining pages in order"
              style={{ display: "block", padding: "8px 4px", textAlign: "center", border: `1px solid ${pages.some(p => !p.image) ? "#a16207" : "#2a4a2a"}`, borderRadius: 8, cursor: "pointer", fontSize: 11, color: pages.some(p => !p.image) ? "#fbbf24" : "#6a9a6a", background: pages.some(p => !p.image) ? "#1c1400" : "#0d1f0d", marginBottom: 4 }}
            >
              📥 Assign images to pages
              <input type="file" accept="image/*" multiple onChange={batchLoadImages} style={{ display: "none" }} />
            </label>
          )}
          {!imageLoadProgress.active && pages.length > 0 && pages.some(p => !p.image) && (
            <div style={{ fontSize: 10, color: "#92400e", background: "#1c1400", borderRadius: 4, padding: "3px 6px", marginBottom: 6, textAlign: "center", border: "1px solid #78350f" }}>
              ⚠ {pages.filter(p => !p.image).length}/{pages.length} pages need images
            </div>
          )}
          {pages.map((p, i) => (
            <div key={i}
              onMouseEnter={() => setHoveredPage(i)}
              onMouseLeave={() => setHoveredPage(null)}
              style={{ position: "relative", padding: 4, marginBottom: 6, borderRadius: 6, border: i === currentPage ? "2px solid #F5D478" : "2px solid transparent", opacity: i === currentPage ? 1 : 0.7 }}
            >
              <div onClick={() => setCurrentPage(i)} style={{ cursor: "pointer" }}>
                {p.image
                  ? <img src={p.image} alt={`Page ${i + 1}`} style={{ width: "100%", aspectRatio: `${p.width} / ${p.height}`, objectFit: "fill", borderRadius: 4, display: "block" }} />
                  : (
                    <div style={{ width: "100%", aspectRatio: "3/4", background: "#1a1a1a", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 4 }}>
                      <span style={{ fontSize: 18 }}>🖼️</span>
                      {p.fileName && <span style={{ fontSize: 8, color: "#555", textAlign: "center", wordBreak: "break-all", lineHeight: 1.2 }}>{p.fileName}</span>}
                    </div>
                  )
                }
                <div style={{ fontSize: 10, color: p.image ? "#888" : "#a16207", textAlign: "center", marginTop: 2 }}>Page {i + 1} · {p.texts.length} texts{!p.image ? " · no image" : ""}</div>
              </div>
              {hoveredPage === i && (
                <button
                  onClick={(e) => { e.stopPropagation(); deletePage(i); }}
                  title="Delete page"
                  style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, background: "#7f1d1d", border: "none", borderRadius: 4, color: "#fca5a5", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}
                >✕</button>
              )}
            </div>
          ))}

          {pages.length > 0 && (
            <button
              onClick={clearAllPages}
              title="Remove all pages and their subtitles (style presets are kept)"
              style={{ width: "100%", marginTop: 4, background: "#1a0d0d", border: "1px solid #5a1a1a", borderRadius: 8, padding: "7px 0", color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              🗑 Clear all pages
            </button>
          )}

        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, minWidth: 0 }}>
          {page ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={addText} style={{ background: "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 16px", color: "#F5D478", fontSize: 13, cursor: "pointer" }}>+ Add text</button>
                {sel && <button onClick={() => duplicateText(sel.id)} style={{ background: "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 16px", color: "#aaa", fontSize: 13, cursor: "pointer" }}>Duplicate</button>}
                {sel && <button onClick={() => deleteText(sel.id)} style={{ background: "#1A1A1A", border: "1px solid #600", borderRadius: 6, padding: "6px 16px", color: "#F88", fontSize: 13, cursor: "pointer" }}>Delete</button>}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8, color: "#888", fontSize: 12 }}>
                  <button onClick={() => setViewportZoom((prev) => clamp(prev / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))} title="Zoom out" style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, width: 28, height: 28, color: "#ddd", cursor: "pointer" }}>−</button>
                  <span style={{ minWidth: 46, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{Math.round(viewportZoom * 100)}%</span>
                  <button onClick={() => setViewportZoom((prev) => clamp(prev * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))} title="Zoom in" style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, width: 28, height: 28, color: "#ddd", cursor: "pointer" }}>+</button>
                  <button onClick={() => setViewportZoom(fitZoom)} title="Fit the whole page to the view" style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, height: 28, padding: "0 10px", color: "#bbb", cursor: "pointer", fontSize: 11 }}>Fit</button>
                  <button onClick={() => setViewportZoom(1)} title="Actual size — 1:1 with the exported PNG pixels" style={{ background: viewportZoom === 1 ? "#2C2400" : "#1A1A1A", border: `1px solid ${viewportZoom === 1 ? "#F5D478" : "#333"}`, borderRadius: 6, height: 28, padding: "0 10px", color: viewportZoom === 1 ? "#F5D478" : "#bbb", cursor: "pointer", fontSize: 11 }}>100%</button>
                </div>
              </div>
              {/* Scroll area: the canvas is rendered at viewportZoom (100% = 1:1 with the export),
                  centred when it fits, scrollable in both axes when zoomed past the viewport. */}
              <div ref={scrollAreaRef} style={{ flex: 1, minHeight: 0, overflow: "auto", width: "100%" }}>
                <div style={{ width: renderedCanvasWidth, margin: "0 auto" }}>
              <div ref={canvasRef} style={{ position: "relative", width: renderedCanvasWidth, height: renderedCanvasHeight, background: "#111", borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.5)" }}>
                {page.image
                  /* objectFit:"fill" — stretch the image to the page box EXACTLY like the export's
                     ctx.drawImage(img, 0,0, page.width, page.height), so preview === exported PNG
                     even when the stored page width/height differs from the image's native aspect. */
                  ? <img src={page.image} alt={page.fileName} style={{ width: "100%", height: "100%", objectFit: "fill" }} draggable={false} />
                  : (
                    <label style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#555", cursor: "pointer", fontSize: 13 }}>
                      <span style={{ fontSize: 36 }}>🖼️</span>
                      <span>No image — click to upload for <b style={{ color: "#888" }}>{page.fileName}</b></span>
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target.result;
                          const img = new Image();
                          img.onload = () => setPages((prev) => { const u = [...prev]; u[currentPage] = { ...rescalePageLayout(u[currentPage], img.naturalWidth, img.naturalHeight), image: dataUrl, fileName: file.name }; return u; });
                          img.src = dataUrl;
                        };
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  )
                }
                {page.texts.map(renderTextBox)}
                {snapGuides.map((g, i) =>
                  g.axis === "v"
                    ? <div key={i} style={{ position: "absolute", left: g.pos * scale - 0.5, top: 0, bottom: 0, width: 1, background: "rgba(56,189,248,0.9)", pointerEvents: "none", zIndex: 20 }} />
                    : <div key={i} style={{ position: "absolute", top: g.pos * scale - 0.5, left: 0, right: 0, height: 1, background: "rgba(56,189,248,0.9)", pointerEvents: "none", zIndex: 20 }} />
                )}
              </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 8, textAlign: "center" }}>
                    Original: {page.width}x{page.height}px · 100% = exported PNG size · Select a text box to edit · Drag the top strip to move · Drag the bottom-right corner to resize · {`{name}`} = user's name
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#555" }}>
              <div style={{ fontSize: 48 }}>📖</div>
              <div style={{ fontSize: 16 }}>Upload your story pages to get started</div>
              <label style={{ padding: "12px 28px", background: "linear-gradient(135deg, #F5D478, #A67620)", color: "#000", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                Choose images
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
              </label>
            </div>
          )}
        </div>

        <div style={{ width: 320, borderLeft: "1px solid #222", padding: 16, overflowY: "auto", flexShrink: 0, scrollbarGutter: "stable" }}>
          {sel ? (
            <>
              {/* ── Style Presets ─────────────────────────────────────────── */}
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #222" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Style Presets</span>
                  {presetDraft === null ? (
                    <button
                      onClick={() => setPresetDraft(`Style ${presets.length + 1}`)}
                      title="Save current text style as a reusable preset"
                      style={{ background: "#1c1c00", border: "1px solid #3a3000", borderRadius: 6, padding: "3px 10px", color: "#F5D478", fontSize: 11, cursor: "pointer" }}
                    >+ Save style</button>
                  ) : (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        autoFocus
                        value={presetDraft}
                        onChange={(e) => setPresetDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmSavePreset(); if (e.key === "Escape") setPresetDraft(null); }}
                        placeholder="Preset name…"
                        style={{ background: "#1A1A1A", border: "1px solid #F5D478", borderRadius: 5, padding: "3px 7px", color: "#E0E0E0", fontSize: 11, width: 110, outline: "none" }}
                      />
                      <button onClick={confirmSavePreset} style={{ background: "#F5D478", border: "none", borderRadius: 5, padding: "3px 8px", color: "#111", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓</button>
                      <button onClick={() => setPresetDraft(null)} style={{ background: "#2a2a2a", border: "none", borderRadius: 5, padding: "3px 6px", color: "#888", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  )}
                </div>

                {presets.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#3a3a3a", textAlign: "center", padding: "6px 0" }}>No presets saved yet</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        style={{ display: "flex", alignItems: "center", background: "#161616", borderRadius: 6, border: "1px solid #252525", overflow: "hidden" }}
                      >
                        <button
                          onClick={() => applyPreset(preset)}
                          title={`Apply "${preset.name}" to this text box${preset.source === "name" ? " (saved from a {name} style)" : ""}`}
                          style={{ flex: 1, background: "none", border: "none", color: preset.source === "name" ? "#E0C878" : "#C0C0C0", fontSize: 12, cursor: "pointer", textAlign: "left", padding: "6px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {preset.source === "name" ? "✦ " : ""}{preset.name}
                        </button>
                        <button
                          onClick={() => deletePreset(preset.id)}
                          title="Delete preset"
                          style={{ background: "none", border: "none", borderLeft: "1px solid #252525", color: "#444", fontSize: 13, cursor: "pointer", padding: "6px 8px", lineHeight: 1, flexShrink: 0 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#F5D478" }}>Text properties</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Role</label>
                  <select value={sel.role ?? "body"} onChange={(e) => updateText(sel.id, { role: e.target.value })} style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "5px 8px", color: "#E0E0E0", fontSize: 13 }}>
                    <option value="title">Title</option>
                    <option value="body">Body</option>
                    <option value="caption">Caption</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Align</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["left", "center", "right"].map((align) => (
                      <button key={align} onClick={() => updateText(sel.id, { textAlign: align })} style={{ flex: 1, background: sel.textAlign === align ? "#333" : "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "5px 0", color: sel.textAlign === align ? "#F5D478" : "#888", fontSize: 13, cursor: "pointer" }}>
                        {align === "left" ? "⬛◻◻" : align === "center" ? "◻⬛◻" : "◻◻⬛"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Vertical align (within box)</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["top", "⬆ Top"], ["middle", "↕ Middle"], ["bottom", "⬇ Bottom"]].map(([v, label]) => (
                    <button key={v} onClick={() => updateText(sel.id, { verticalAlign: v })} style={{ flex: 1, background: (sel.verticalAlign ?? "top") === v ? "#333" : "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "5px 0", color: (sel.verticalAlign ?? "top") === v ? "#F5D478" : "#888", fontSize: 12, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Content (use {`{name}`} for user's name)</label>
              <textarea
                ref={contentTaRef}
                value={localContent}
                onChange={(e) => {
                  const v = e.target.value;
                  setLocalContent(v);
                  setSpanRange(null); // text offsets shifting → leave per-character scope
                  // Debounce: write to pages state 200ms after last keystroke (remaps spans)
                  if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
                  contentDebounceRef.current = setTimeout(() => commitContent(v), 200);
                }}
                onSelect={(e) => {
                  const r = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 };
                  contentSelRef.current = r; setContentSel(r);
                }}
                onMouseUp={(e) => { const r = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 }; contentSelRef.current = r; setContentSel(r); }}
                onKeyUp={(e) => { const r = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 }; contentSelRef.current = r; setContentSel(r); }}
                onBlur={(e) => {
                  // Immediate commit on blur so value is always saved before switching pages
                  if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
                  commitContent(e.target.value);
                }}
                rows={4}
                style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: 8, color: "#E0E0E0", fontSize: 13, resize: "vertical", marginBottom: 8, fontFamily: "monospace" }}
              />

              {/* ── Per-character styling scope bar ─────────────────────────────── */}
              {spanRange ? (
                <div style={{ background: "#2A2400", border: "1px solid #F5D478", borderRadius: 6, padding: "8px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#F5D478", fontWeight: 600 }}>✦ Styling selection:</span>
                  <span style={{ fontSize: 12, color: "#E0E0E0", fontFamily: "monospace", background: "#1A1A1A", borderRadius: 4, padding: "1px 6px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spanText || "∅"}</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={clearActiveSpan} title="Remove this segment's overrides" style={{ background: "#2A0A0A", border: "1px solid #5A1A1A", borderRadius: 4, color: "#FF6B6B", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>Clear</button>
                  <button onClick={() => setSpanRange(null)} style={{ background: "#333", border: "1px solid #555", borderRadius: 4, color: "#E0E0E0", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>Done</button>
                </div>
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={styleSelection}
                    title="Select characters in the box above, then click to style just that part"
                    style={{ width: "100%", background: contentSel.end > contentSel.start ? "#1e3a5f" : "#1A1A1A", border: `1px solid ${contentSel.end > contentSel.start ? "#2563eb" : "#333"}`, borderRadius: 6, padding: "7px 0", color: contentSel.end > contentSel.start ? "#7dd3fc" : "#777", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ✦ Style selected characters{contentSel.end > contentSel.start ? ` («${(localContent).slice(contentSel.start, contentSel.end).slice(0, 12)}»)` : ""}
                  </button>
                  {(sel.spans?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#555" }}>Segments:</span>
                      {(sel.spans ?? []).map((sp, i) => (
                        <button key={`${sp.start}-${sp.end}-${i}`} onClick={() => setSpanRange({ start: sp.start, end: sp.end })} title={`chars ${sp.start}–${sp.end}`}
                          style={{ background: "#1A1A1A", border: "1px solid #444", borderRadius: 4, color: "#E0A055", fontSize: 11, padding: "2px 7px", cursor: "pointer", fontFamily: "monospace", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(sel.content ?? "").slice(sp.start, sp.end) || "∅"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>X position</label>
                  <NumericField value={sel.x} onCommit={(value) => updateText(sel.id, { x: Math.max(0, Math.round(value)) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Y position</label>
                  <NumericField value={sel.y} onCommit={(value) => updateText(sel.id, { y: Math.max(0, Math.round(value)) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Box width (px)</label>
                  <NumericField
                    value={sel.boxWidth ?? sel.maxWidth ?? 1500}
                    onCommit={(value) => {
                      const safe = Math.max(MIN_BOX_WIDTH, Math.round(value));
                      updateText(sel.id, { boxWidth: safe, maxWidth: safe });
                    }}
                    min={MIN_BOX_WIDTH}
                    step="1"
                    style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Box height (px)</label>
                  <NumericField
                    value={sel.boxHeight ?? MIN_BOX_HEIGHT}
                    onCommit={(value) => updateText(sel.id, { boxHeight: Math.max(MIN_BOX_HEIGHT, Math.round(value)) })}
                    min={MIN_BOX_HEIGHT}
                    step="1"
                    style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }}
                  />
                </div>
              </div>

              <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Box style</label>
              <select
                value={sel.boxStyle ?? "rounded_translucent"}
                onChange={(e) => applyBoxPreset(sel.id, e.target.value)}
                style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "6px 8px", color: "#E0E0E0", fontSize: 13, marginBottom: 12 }}
              >
                {Object.entries(BOX_STYLE_PRESETS).map(([value, preset]) => (
                  <option key={value} value={value}>{preset.label}</option>
                ))}
              </select>

              <div style={{ background: "#151515", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#888" }}>Box appearance</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6, marginBottom: 10 }}>
                  <Field label="Fill color">
                    <input type="color" value={sel.boxFillColor ?? "#0F172A"} onChange={(e) => updateText(sel.id, { boxFillColor: e.target.value })} style={{ width: "100%", height: 30, border: "1px solid #333", borderRadius: 6, cursor: "pointer", background: "#1A1A1A", padding: 2 }} />
                  </Field>
                  <Field label="Border color">
                    <input type="color" value={sel.boxBorderColor ?? "#FFFFFF"} onChange={(e) => updateText(sel.id, { boxBorderColor: e.target.value })} style={{ width: "100%", height: 30, border: "1px solid #333", borderRadius: 6, cursor: "pointer", background: "#1A1A1A", padding: 2 }} />
                  </Field>
                </div>
                <SliderRow label={sel.boxFadeEdges ? "Cloud opacity" : "Fill opacity"} value={sel.boxFillOpacity ?? 0} onChange={(e) => sliderUpdate(sel.id, { boxFillOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} />
                {sel.boxFadeEdges && (
                  <SliderRow label="Edge softness" value={sel.boxFeather ?? 30} min={2} max={90} step={1} onChange={(e) => sliderUpdate(sel.id, { boxFeather: parseFloat(e.target.value) })} format={(v) => Math.round(v) + "px"} />
                )}
                <SliderRow label="Border opacity" value={sel.boxBorderOpacity ?? 0} onChange={(e) => sliderUpdate(sel.id, { boxBorderOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Border px</label>
                    <NumericField value={sel.boxBorderWidth ?? 0} onCommit={(value) => updateText(sel.id, { boxBorderWidth: Math.max(0, value) })} min={0} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Radius</label>
                    <NumericField value={sel.boxRadius ?? 0} onCommit={(value) => updateText(sel.id, { boxRadius: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                </div>
                {/* Per-side inner padding — distance between the text and the box border */}
                <label style={{ fontSize: 10, color: "#666", display: "block", marginBottom: 4 }}>Padding · text ↔ border (px)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>↑ Top</label>
                    <NumericField value={resolvePad(sel).top} onCommit={(value) => updateText(sel.id, { boxPaddingTop: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>→ Right</label>
                    <NumericField value={resolvePad(sel).right} onCommit={(value) => updateText(sel.id, { boxPaddingRight: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>↓ Bottom</label>
                    <NumericField value={resolvePad(sel).bottom} onCommit={(value) => updateText(sel.id, { boxPaddingBottom: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>← Left</label>
                    <NumericField value={resolvePad(sel).left} onCommit={(value) => updateText(sel.id, { boxPaddingLeft: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                </div>
              </div>

              {/* ── Text style + effects — SCOPE-ROUTED ──────────────────────────────
                  Everything below writes to the CURRENT scope: the whole box, or just the
                  selected characters when a span is active. We shadow `sel` (→ merged view)
                  and the write helpers (`updateText`/`sliderUpdate`/`handleTextureUpload`) so
                  the existing controls need no changes — they transparently target the scope.
                  Layout/box/content controls above stay box-only; {name} panel below is separate. */}
              {(() => {
                const sel = styleView;
                const updateText = styleScopeUpdate;
                const sliderUpdate = styleScopeSlider;
                const handleTextureUpload = styleScopeTexture;
                return (<>
              {/* ── Font ──────────────────────────────────────────────────── */}
              <label style={{ fontSize: 11, color: "#888" }}>Font</label>
              <FontPicker
                value={sel.font}
                onChange={(v) => { saveHistory("Change font"); updateText(sel.id, { font: v }); }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Font size</label>
                  <NumericField value={sel.size} onCommit={(value) => updateText(sel.id, { size: Math.max(1, Math.round(value)) })} min={1} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Line height</label>
                  <NumericField value={sel.lineHeight ?? 1.2} onCommit={(value) => updateText(sel.id, { lineHeight: Math.max(0.5, value) })} min={0.5} max={4} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Letter spacing</label>
                  <NumericField value={sel.letterSpacing} onCommit={(value) => updateText(sel.id, { letterSpacing: value })} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                </div>
              </div>

              <label style={{ fontSize: 11, color: "#888" }}>Color</label>
              {recentColors.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Recently used</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {recentColors.map((hex) => (
                      <div key={hex} onClick={() => updateText(sel.id, { color: "custom", customColor: hex })} title={hex}
                        style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: sel.color === "custom" && sel.customColor === hex ? "2px solid #F5D478" : "2px solid #444", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
              )}
              {recentGradients.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Recent gradients</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {recentGradients.map((g) => {
                      const active = sel.color === "custom_gradient"
                        && (sel.customGradientStart ?? "").toUpperCase() === g.start.toUpperCase()
                        && (sel.customGradientEnd ?? "").toUpperCase() === g.end.toUpperCase()
                        && (sel.customGradientAngle ?? 180) === g.angle;
                      return (
                        <div key={`${g.start}|${g.end}|${g.angle}`}
                          onClick={() => updateText(sel.id, { color: "custom_gradient", customGradientStart: g.start, customGradientEnd: g.end, customGradientAngle: g.angle })}
                          title={`${g.start} → ${g.end} @ ${g.angle}°`}
                          style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(${g.angle}deg, ${g.start}, ${g.end})`, border: active ? "2px solid #F5D478" : "2px solid #444", cursor: "pointer" }} />
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {COLOR_PRESETS.map((c) => (
                  <div key={c.value} onClick={() => updateText(sel.id, { color: c.value })} title={c.name} style={{ width: 28, height: 28, borderRadius: 6, background: c.preview, border: sel.color === c.value ? "2px solid #F5D478" : "2px solid #333", cursor: "pointer" }} />
                ))}
              </div>
              {/* Custom solid color */}
              {sel.color === "custom" && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <input type="color" value={sel.customColor}
                    onChange={(e) => updateText(sel.id, { customColor: e.target.value })}
                    onBlur={(e) => addRecentColor(e.target.value)}
                    style={{ width: 36, height: 32, border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                  <input type="text" value={(sel.customColor ?? "#FFFFFF").toUpperCase()} maxLength={7}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateText(sel.id, { customColor: v });
                    }}
                    onBlur={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) addRecentColor(e.target.value); }}
                    style={{ flex: 1, background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 12, fontFamily: "monospace" }} />
                  <button onClick={() => void copyToClipboard((sel.customColor ?? "#FFFFFF").toUpperCase())}
                    style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "4px 8px", color: "#888", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>Copy</button>
                </div>
              )}
              {/* Custom gradient editor */}
              {sel.color === "custom_gradient" && (
                <div style={{ marginBottom: 8 }}
                  onBlur={() => addRecentGradient({ start: sel.customGradientStart ?? "#FF8C00", end: sel.customGradientEnd ?? "#FFD700", angle: sel.customGradientAngle ?? 180 })}>
                  {/* Preview bar */}
                  <div style={{
                    height: 20, borderRadius: 6, marginBottom: 8,
                    background: `linear-gradient(${sel.customGradientAngle ?? 180}deg, ${sel.customGradientStart ?? "#FF8C00"}, ${sel.customGradientEnd ?? "#FFD700"})`,
                    border: "1px solid #333",
                  }} />
                  {/* Start + End color pickers */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Start color</div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input type="color" value={sel.customGradientStart ?? "#FF8C00"}
                          onChange={(e) => updateText(sel.id, { customGradientStart: e.target.value })}
                          style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer", flexShrink: 0 }} />
                        <input type="text" value={(sel.customGradientStart ?? "#FF8C00").toUpperCase()} maxLength={7}
                          onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) updateText(sel.id, { customGradientStart: e.target.value }); }}
                          style={{ flex: 1, background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 11, fontFamily: "monospace", minWidth: 0 }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>End color</div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input type="color" value={sel.customGradientEnd ?? "#FFD700"}
                          onChange={(e) => updateText(sel.id, { customGradientEnd: e.target.value })}
                          style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer", flexShrink: 0 }} />
                        <input type="text" value={(sel.customGradientEnd ?? "#FFD700").toUpperCase()} maxLength={7}
                          onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) updateText(sel.id, { customGradientEnd: e.target.value }); }}
                          style={{ flex: 1, background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 11, fontFamily: "monospace", minWidth: 0 }} />
                      </div>
                    </div>
                  </div>
                  {/* Angle control */}
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Direction</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
                    {[[0,"↑"],[90,"→"],[180,"↓"],[270,"←"],[135,"↘"],[315,"↗"]].map(([a, icon]) => (
                      <button key={a} onClick={() => updateText(sel.id, { customGradientAngle: a })}
                        style={{ flex: 1, padding: "4px 0", borderRadius: 4, border: "none", background: (sel.customGradientAngle ?? 180) === a ? "#F5D478" : "#2A2A2A", color: (sel.customGradientAngle ?? 180) === a ? "#000" : "#888", fontSize: 14, cursor: "pointer" }}>{icon}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="range" min={0} max={359} value={sel.customGradientAngle ?? 180}
                      onChange={(e) => sliderUpdate(sel.id, { customGradientAngle: Number(e.target.value) })}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace", width: 36, textAlign: "right" }}>{sel.customGradientAngle ?? 180}°</span>
                  </div>
                </div>
              )}
              {/* For preset gradients: show representative hex */}
              {sel.color !== "custom" && sel.color !== "custom_gradient" && (() => {
                const hexVal = GRADIENT_COLOR_MAP[sel.color] ?? sel.color ?? "#FFFFFF";
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, background: hexVal, border: "1px solid #444", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace", flex: 1 }}>{hexVal.toUpperCase()}</span>
                    <button onClick={() => void copyToClipboard(hexVal.toUpperCase())}
                      style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "2px 8px", color: "#888", fontSize: 10, cursor: "pointer" }}>Copy</button>
                  </div>
                );
              })()}

              {/* ── Texture fill ─────────────────────────────────────────── */}
              <label style={{ fontSize: 11, color: "#888" }}>Texture fill</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                {sel.textureImage ? (
                  <>
                    <div style={{ width: 52, height: 30, borderRadius: 6, backgroundImage: `url(${sel.textureImage})`, backgroundSize: "cover", backgroundPosition: "center", border: "1px solid #555", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#aaa", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Texture active</span>
                    <button
                      onClick={() => { saveHistory("Remove texture"); updateText(sel.id, { textureImage: null }); }}
                      style={{ background: "#2A1A1A", border: "1px solid #553333", borderRadius: 6, padding: "4px 10px", color: "#FF8888", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                    >Remove</button>
                  </>
                ) : (
                  <label style={{ flex: 1, background: "#1A1A1A", border: "1px dashed #444", borderRadius: 6, padding: "6px 12px", color: "#888", fontSize: 12, cursor: "pointer", textAlign: "center" }}>
                    + Upload texture image
                    <input type="file" accept="image/*" onChange={handleTextureUpload("textureImage", "Add texture")} style={{ display: "none" }} />
                  </label>
                )}
              </div>

              {/* Font weight — full variable-font range (Thin → Black) */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#888", width: 48, flexShrink: 0 }}>Weight</label>
                <select
                  value={resolveWeight(sel)}
                  onChange={(e) => { const w = Number(e.target.value); updateText(sel.id, { fontWeight: w, bold: w >= 700 }); }}
                  style={{ flex: 1, background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "5px 8px", color: "#E0E0E0", fontSize: 13 }}
                >
                  {WEIGHT_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>{w.label} ({w.value})</option>
                  ))}
                </select>
              </div>
              {/* Typography style row — B / I / U + Transform */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button onClick={() => { const w = resolveWeight(sel); updateText(sel.id, { fontWeight: w >= 700 ? 400 : 700, bold: w < 700 }); }} title="Bold (toggle 400↔700)" style={{ flex: 1, background: resolveWeight(sel) >= 700 ? "#2C2400" : "#1A1A1A", border: `1px solid ${resolveWeight(sel) >= 700 ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "7px 0", color: resolveWeight(sel) >= 700 ? "#F5D478" : "#666", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>B</button>
                <button onClick={() => updateText(sel.id, { italic: !sel.italic })} title="Italic" style={{ flex: 1, background: sel.italic ? "#2C2400" : "#1A1A1A", border: `1px solid ${sel.italic ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "7px 0", color: sel.italic ? "#F5D478" : "#666", fontSize: 14, cursor: "pointer", fontStyle: "italic" }}>I</button>
                <button onClick={() => updateText(sel.id, { underline: !sel.underline })} title="Underline" style={{ flex: 1, background: sel.underline ? "#2C2400" : "#1A1A1A", border: `1px solid ${sel.underline ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "7px 0", color: sel.underline ? "#F5D478" : "#666", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>U</button>
              </div>
              {/* Text Transform row */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[["none","Aa","Original (as typed)"],["uppercase","AA","ALL CAPS"],["lowercase","aa","all lowercase"],["capitalize","Ab","Title Case (first letter of each word)"]].map(([val,lbl,tip]) => (
                  <button key={val} onClick={() => updateText(sel.id, { textTransform: val })} title={tip}
                    style={{ flex: 1, background: (sel.textTransform ?? "none") === val ? "#2C2400" : "#1A1A1A", border: `1px solid ${(sel.textTransform ?? "none") === val ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "5px 0", color: (sel.textTransform ?? "none") === val ? "#F5D478" : "#555", fontSize: 11, cursor: "pointer" }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Effects section header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Effects</span>
                <div style={{ flex: 1, height: 1, background: "#222" }} />
              </div>

              {/* Effect toggle cards — Canva-style 2×2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <button onClick={() => updateText(sel.id, { shadow: !sel.shadow })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", background: sel.shadow ? "#1C1800" : "#161616", border: `1.5px solid ${sel.shadow ? "#F5D478" : "#2A2A2A"}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>🌑</span>
                  <span style={{ fontSize: 11, color: sel.shadow ? "#F5D478" : "#555", fontWeight: sel.shadow ? 600 : 400 }}>Shadow</span>
                </button>
                <button onClick={() => updateText(sel.id, { stroke: !sel.stroke })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", background: sel.stroke ? "#001820" : "#161616", border: `1.5px solid ${sel.stroke ? "#7EC8E3" : "#2A2A2A"}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>⬡</span>
                  <span style={{ fontSize: 11, color: sel.stroke ? "#7EC8E3" : "#555", fontWeight: sel.stroke ? 600 : 400 }}>Outline</span>
                </button>
                <button onClick={() => updateText(sel.id, { bevel: !sel.bevel })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", background: sel.bevel ? "#1A0E00" : "#161616", border: `1.5px solid ${sel.bevel ? "#E8A055" : "#2A2A2A"}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>🔲</span>
                  <span style={{ fontSize: 11, color: sel.bevel ? "#E8A055" : "#555", fontWeight: sel.bevel ? 600 : 400 }}>3D Bevel</span>
                </button>
                <button onClick={() => updateText(sel.id, { glow: !sel.glow })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", background: sel.glow ? "#1A1600" : "#161616", border: `1.5px solid ${sel.glow ? "#FFD700" : "#2A2A2A"}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>✨</span>
                  <span style={{ fontSize: 11, color: sel.glow ? "#FFD700" : "#555", fontWeight: sel.glow ? 600 : 400 }}>Glow</span>
                </button>
              </div>

              {/* Shadow controls */}
              {sel.shadow && (
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#F5D478", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Shadow</span>
                  </div>
                  <SliderRow label="Opacity" value={sel.shadowOpacity ?? 0.5} onChange={(e) => sliderUpdate(sel.id, { shadowOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} accent="#F5D478" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Blur</label>
                      <NumericField value={sel.shadowBlur} onCommit={(value) => updateText(sel.id, { shadowBlur: Math.max(0, value) })} min={0} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>X</label>
                      <NumericField value={sel.shadowOffsetX} onCommit={(value) => updateText(sel.id, { shadowOffsetX: value })} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Y</label>
                      <NumericField value={sel.shadowOffsetY} onCommit={(value) => updateText(sel.id, { shadowOffsetY: value })} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                  </div>
                  <label style={{ fontSize: 10, color: "#555" }}>Color</label>
                  <input type="color" value={sel.shadowColor} onChange={(e) => updateText(sel.id, { shadowColor: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer", marginTop: 3 }} />
                </div>
              )}

              {/* Stroke / Outline controls */}
              {sel.stroke && (
                <div style={{ background: "#111", border: "1px solid #1A2A30", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#7EC8E3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Outline</span>
                  </div>
                  <SliderRow label="Opacity" value={sel.strokeOpacity ?? 1} onChange={(e) => sliderUpdate(sel.id, { strokeOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} accent="#7EC8E3" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Width (px)</label>
                      <NumericField value={sel.strokeWidth ?? 4} onCommit={(value) => updateText(sel.id, { strokeWidth: Math.max(0.5, value) })} min={0.5} step="0.5" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Color</label>
                      <input type="color" value={sel.strokeColor ?? "#000000"} onChange={(e) => updateText(sel.id, { strokeColor: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer", marginTop: 2 }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Bevel / 3D Emboss controls */}
              {sel.bevel && (
                <div style={{ background: "#111", border: "1px solid #2A1A00", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: "#E8A055", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>3D Bevel</span>
                  <SliderRow label="Depth" value={sel.bevelDepth ?? 4} min={1} max={16} step={1} onChange={(e) => sliderUpdate(sel.id, { bevelDepth: parseInt(e.target.value) })} format={(v) => v + "px"} accent="#E8A055" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Highlight</label>
                      <input type="color" value={sel.bevelHighlight ?? "#FFFFFF"} onChange={(e) => updateText(sel.id, { bevelHighlight: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer", marginTop: 2 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Shadow</label>
                      <input type="color" value={sel.bevelShadow ?? "#000000"} onChange={(e) => updateText(sel.id, { bevelShadow: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer", marginTop: 2 }} />
                    </div>
                  </div>
                  {/* Bevel texture fill */}
                  <div>
                    <label style={{ fontSize: 10, color: "#555", display: "block", marginBottom: 4 }}>Depth Texture</label>
                    {sel.bevelTexture ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 36, height: 28, borderRadius: 4, overflow: "hidden", border: "1px solid #333", flexShrink: 0 }}>
                          <img src={sel.bevelTexture} alt="bevel texture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "#E8A055", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Active</span>
                        <button onClick={() => { saveHistory("Remove bevel texture"); updateText(sel.id, { bevelTexture: null }); }} style={{ fontSize: 10, background: "#2A0A0A", border: "1px solid #5A1A1A", borderRadius: 4, color: "#FF6B6B", padding: "2px 6px", cursor: "pointer" }}>Remove</button>
                      </div>
                    ) : (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>
                        <span style={{ fontSize: 14 }}>🪵</span>
                        <span style={{ fontSize: 10, color: "#888" }}>Upload texture…</span>
                        <input type="file" accept="image/*" onChange={handleTextureUpload("bevelTexture", "Add bevel texture")} style={{ display: "none" }} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Glow controls */}
              {sel.glow && (
                <div style={{ background: "#111", border: "1px solid #2A2200", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: "#FFD700", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Glow</span>
                  <SliderRow label="Opacity" value={sel.glowOpacity ?? 0.85} onChange={(e) => sliderUpdate(sel.id, { glowOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} accent="#FFD700" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Blur radius</label>
                      <NumericField value={sel.glowBlur ?? 20} onCommit={(value) => updateText(sel.id, { glowBlur: Math.max(1, value) })} min={1} max={80} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#555" }}>Color</label>
                      <input type="color" value={sel.glowColor ?? "#FFD700"} onChange={(e) => updateText(sel.id, { glowColor: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer", marginTop: 2 }} />
                    </div>
                  </div>
                </div>
              )}
                </>);
              })()}

              {/* Layer opacity — full-width slider row. (The old "Max width" control was a
                  duplicate of "Box width", which already writes both boxWidth & maxWidth.)
                  Stays box-only: opacity multiplies the whole layer (box + text), not a span. */}
              <SliderRow label="Layer opacity" value={sel.opacity ?? 1} onChange={(e) => sliderUpdate(sel.id, { opacity: parseFloat(e.target.value) })} format={(v) => Math.round((v ?? 1) * 100) + "%"} style={{ marginBottom: 12 }} />

              {/* ── {name} independent style section ─────────────────────────
                  Only visible when the text content contains {name}           */}
              {sel.content.includes("{name}") && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>{"{name}"} Style</span>
                    <div style={{ flex: 1, height: 1, background: "#222" }} />
                    <button
                      onClick={() => {
                        if (sel.nameStyle?.enabled) {
                          updateText(sel.id, { nameStyle: null });
                        } else {
                          // Initialise with current item's styles as defaults
                          updateText(sel.id, { nameStyle: {
                            enabled: true,
                            font: sel.font, size: sel.size, bold: sel.bold, fontWeight: resolveWeight(sel), italic: sel.italic, letterSpacing: sel.letterSpacing,
                            textTransform: sel.textTransform ?? "none", textureImage: sel.textureImage ?? null,
                            color: sel.color, customColor: sel.customColor,
                            customGradientStart: sel.customGradientStart, customGradientEnd: sel.customGradientEnd, customGradientAngle: sel.customGradientAngle,
                            shadow: sel.shadow, shadowColor: sel.shadowColor, shadowOpacity: sel.shadowOpacity, shadowBlur: sel.shadowBlur, shadowOffsetX: sel.shadowOffsetX, shadowOffsetY: sel.shadowOffsetY,
                            stroke: sel.stroke, strokeWidth: sel.strokeWidth, strokeColor: sel.strokeColor, strokeOpacity: sel.strokeOpacity,
                            bevel: sel.bevel, bevelDepth: sel.bevelDepth, bevelHighlight: sel.bevelHighlight, bevelShadow: sel.bevelShadow,
                            glow: sel.glow, glowColor: sel.glowColor, glowBlur: sel.glowBlur, glowOpacity: sel.glowOpacity,
                          }});
                        }
                      }}
                      style={{ background: sel.nameStyle?.enabled ? "#1c1800" : "#1A1A1A", border: `1px solid ${sel.nameStyle?.enabled ? "#F5D478" : "#444"}`, borderRadius: 6, padding: "3px 10px", color: sel.nameStyle?.enabled ? "#F5D478" : "#666", fontSize: 11, cursor: "pointer" }}
                    >
                      {sel.nameStyle?.enabled ? "On" : "Off"}
                    </button>
                  </div>

                  {sel.nameStyle?.enabled && (() => {
                    const ns = sel.nameStyle;
                    const upNs = (patch) => updateText(sel.id, { nameStyle: { ...ns, ...patch } });
                    const slNs = (patch) => sliderUpdate(sel.id, { nameStyle: { ...ns, ...patch } });
                    const handleNameTexture = (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => { saveHistory("Name texture"); upNs({ textureImage: ev.target.result }); };
                      reader.readAsDataURL(file); e.target.value = "";
                    };
                    return (
                      <div style={{ background: "#111", borderRadius: 8, padding: 12, border: "1px solid #2a2400" }}>

                        {/* {name} presets — apply a saved preset, or save the current name style */}
                        <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #2a2400" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: "#666", flex: 1 }}>Presets for {"{name}"}</span>
                            {namePresetDraft === null ? (
                              <button onClick={() => setNamePresetDraft("")} title="Save the current {name} style as a preset"
                                style={{ background: "#1c1800", border: "1px solid #F5D478", borderRadius: 5, padding: "2px 8px", color: "#F5D478", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                                ＋ Save
                              </button>
                            ) : (
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input
                                  autoFocus
                                  value={namePresetDraft}
                                  onChange={(e) => setNamePresetDraft(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") confirmSaveNamePreset(); if (e.key === "Escape") setNamePresetDraft(null); }}
                                  placeholder="Preset name…"
                                  style={{ width: 110, background: "#1A1A1A", border: "1px solid #F5D478", borderRadius: 5, padding: "2px 6px", color: "#E0E0E0", fontSize: 11 }}
                                />
                                <button onClick={confirmSaveNamePreset} style={{ background: "#F5D478", border: "none", borderRadius: 5, padding: "2px 7px", color: "#111", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓</button>
                                <button onClick={() => setNamePresetDraft(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: "0 2px" }}>✕</button>
                              </div>
                            )}
                          </div>
                          {presets.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {presets.map((preset) => (
                                <button
                                  key={preset.id}
                                  onClick={() => applyPresetToName(preset)}
                                  title={`Apply "${preset.name}" font/size/color/effects to {name} only`}
                                  style={{ background: "#161616", border: `1px solid ${preset.source === "name" ? "#3a3010" : "#2a2a2a"}`, borderRadius: 6, padding: "4px 9px", color: preset.source === "name" ? "#E0C878" : "#C0C0C0", fontSize: 11, cursor: "pointer", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                >
                                  {preset.source === "name" ? "✦ " : ""}{preset.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Font */}
                        <label style={{ fontSize: 11, color: "#888" }}>Font</label>
                        <FontPicker value={ns.font ?? sel.font} onChange={(v) => { saveHistory("Name style font"); upNs({ font: v }); }} />

                        {/* Size + Bold/Italic */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, color: "#888" }}>Size</label>
                            <NumericField value={ns.size ?? sel.size} onCommit={(v) => upNs({ size: Math.max(1, Math.round(v)) })} min={1} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: "#888" }}>Letter sp.</label>
                            <NumericField value={ns.letterSpacing ?? 0} onCommit={(v) => upNs({ letterSpacing: v })} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: "#888" }}>Style</label>
                            <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                              <button onClick={() => { const w = resolveWeight(ns); upNs({ fontWeight: w >= 700 ? 400 : 700, bold: w < 700 }); }} style={{ flex: 1, background: resolveWeight(ns) >= 700 ? "#2C2400" : "#1A1A1A", border: `1px solid ${resolveWeight(ns) >= 700 ? "#F5D478" : "#333"}`, borderRadius: 4, padding: "4px 0", color: resolveWeight(ns) >= 700 ? "#F5D478" : "#666", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>B</button>
                              <button onClick={() => upNs({ italic: !ns.italic })} style={{ flex: 1, background: ns.italic ? "#2C2400" : "#1A1A1A", border: `1px solid ${ns.italic ? "#F5D478" : "#333"}`, borderRadius: 4, padding: "4px 0", color: ns.italic ? "#F5D478" : "#666", fontSize: 13, cursor: "pointer", fontStyle: "italic" }}>I</button>
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: "#888" }}>Weight</label>
                            <select value={resolveWeight(ns)} onChange={(e) => { const w = Number(e.target.value); upNs({ fontWeight: w, bold: w >= 700 }); }}
                              style={{ width: "100%", marginTop: 4, background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 6px", color: "#E0E0E0", fontSize: 12 }}>
                              {WEIGHT_OPTIONS.map((w) => (<option key={w.value} value={w.value}>{w.label} ({w.value})</option>))}
                            </select>
                          </div>
                        </div>

                        {/* Color presets */}
                        <label style={{ fontSize: 11, color: "#888" }}>Color</label>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8, marginTop: 4 }}>
                          {COLOR_PRESETS.map((c) => (
                            <div key={c.value} onClick={() => upNs({ color: c.value })} title={c.name} style={{ width: 24, height: 24, borderRadius: 5, background: c.preview, border: ns.color === c.value ? "2px solid #F5D478" : "2px solid #333", cursor: "pointer" }} />
                          ))}
                        </div>
                        {ns.color === "custom" && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                            <input type="color" value={ns.customColor ?? "#FFFFFF"} onChange={(e) => upNs({ customColor: e.target.value })} style={{ width: 32, height: 28, border: "none", borderRadius: 5, cursor: "pointer" }} />
                            <input type="text" value={(ns.customColor ?? "#FFFFFF").toUpperCase()} maxLength={7}
                              onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) upNs({ customColor: e.target.value }); }}
                              style={{ flex: 1, background: "#1A1A1A", border: "1px solid #333", borderRadius: 5, padding: "4px 8px", color: "#E0E0E0", fontSize: 12, fontFamily: "monospace" }} />
                          </div>
                        )}
                        {ns.color === "custom_gradient" && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ height: 16, borderRadius: 4, marginBottom: 6, background: `linear-gradient(${ns.customGradientAngle ?? 180}deg, ${ns.customGradientStart ?? "#FF8C00"}, ${ns.customGradientEnd ?? "#FFD700"})`, border: "1px solid #333" }} />
                            <div style={{ display: "flex", gap: 6 }}>
                              <input type="color" value={ns.customGradientStart ?? "#FF8C00"} onChange={(e) => upNs({ customGradientStart: e.target.value })} style={{ flex: 1, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
                              <input type="color" value={ns.customGradientEnd ?? "#FFD700"} onChange={(e) => upNs({ customGradientEnd: e.target.value })} style={{ flex: 1, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
                            </div>
                          </div>
                        )}

                        {/* Case (textTransform) — independent for {name}; e.g. "AA" → name uppercased */}
                        <label style={{ fontSize: 11, color: "#888", display: "block", marginTop: 4, marginBottom: 4 }}>Case</label>
                        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                          {[["none","Aa","Original (as typed)"],["uppercase","AA","ALL CAPS"],["lowercase","aa","all lowercase"],["capitalize","Ab","Title Case"]].map(([val,lbl,tip]) => (
                            <button key={val} onClick={() => upNs({ textTransform: val })} title={tip}
                              style={{ flex: 1, background: (ns.textTransform ?? "none") === val ? "#2C2400" : "#1A1A1A", border: `1px solid ${(ns.textTransform ?? "none") === val ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "5px 0", color: (ns.textTransform ?? "none") === val ? "#F5D478" : "#555", fontSize: 11, cursor: "pointer" }}>
                              {lbl}
                            </button>
                          ))}
                        </div>

                        {/* Texture fill — independent for {name} */}
                        <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Texture fill</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                          {ns.textureImage ? (
                            <>
                              <div style={{ width: 46, height: 28, borderRadius: 6, backgroundImage: `url(${ns.textureImage})`, backgroundSize: "cover", backgroundPosition: "center", border: "1px solid #555", flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: "#aaa", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Texture active</span>
                              <button onClick={() => { saveHistory("Remove name texture"); upNs({ textureImage: null }); }} style={{ background: "#2A1A1A", border: "1px solid #553333", borderRadius: 6, padding: "4px 10px", color: "#FF8888", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Remove</button>
                            </>
                          ) : (
                            <label style={{ flex: 1, background: "#1A1A1A", border: "1px dashed #444", borderRadius: 6, padding: "6px 12px", color: "#888", fontSize: 12, cursor: "pointer", textAlign: "center" }}>
                              + Upload texture image
                              <input type="file" accept="image/*" onChange={handleNameTexture} style={{ display: "none" }} />
                            </label>
                          )}
                        </div>

                        {/* Effects */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
                          {[
                            { key: "shadow", label: "Shadow",   icon: "🌑" },
                            { key: "stroke", label: "Outline",  icon: "⬡" },
                            { key: "bevel",  label: "3D Bevel", icon: "🔲" },
                            { key: "glow",   label: "Glow",     icon: "✨" },
                          ].map(({ key, label, icon }) => (
                            <button key={key} onClick={() => upNs({ [key]: !ns[key] })}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", background: ns[key] ? "#1C1800" : "#161616", border: `1.5px solid ${ns[key] ? "#F5D478" : "#2A2A2A"}`, borderRadius: 7, cursor: "pointer" }}>
                              <span style={{ fontSize: 14 }}>{icon}</span>
                              <span style={{ fontSize: 10, color: ns[key] ? "#F5D478" : "#555" }}>{label}</span>
                            </button>
                          ))}
                        </div>

                        {ns.shadow && (
                          <div style={{ marginTop: 8 }}>
                            <SliderRow label="Opacity" value={ns.shadowOpacity ?? 0.5} onChange={(e) => slNs({ shadowOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                              <Field label="Blur"><NumericField value={ns.shadowBlur ?? 8} onCommit={(v) => upNs({ shadowBlur: Math.max(0, v) })} min={0} step="0.1" style={{ width: "100%", boxSizing: "border-box", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "4px 6px", color: "#E0E0E0", fontSize: 12 }} /></Field>
                              <Field label="X"><NumericField value={ns.shadowOffsetX ?? 2} onCommit={(v) => upNs({ shadowOffsetX: v })} step="0.1" style={{ width: "100%", boxSizing: "border-box", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "4px 6px", color: "#E0E0E0", fontSize: 12 }} /></Field>
                              <Field label="Y"><NumericField value={ns.shadowOffsetY ?? 4} onCommit={(v) => upNs({ shadowOffsetY: v })} step="0.1" style={{ width: "100%", boxSizing: "border-box", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "4px 6px", color: "#E0E0E0", fontSize: 12 }} /></Field>
                            </div>
                            <Field label="Color"><input type="color" value={ns.shadowColor ?? "#000000"} onChange={(e) => upNs({ shadowColor: e.target.value })} style={{ width: "100%", height: 28, border: "1px solid #333", borderRadius: 4, cursor: "pointer", background: "#1A1A1A", padding: 2 }} /></Field>
                          </div>
                        )}

                        {ns.stroke && (
                          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <Field label="Width (px)"><NumericField value={ns.strokeWidth ?? 4} onCommit={(v) => upNs({ strokeWidth: Math.max(0.5, v) })} min={0.5} step="0.5" style={{ width: "100%", boxSizing: "border-box", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "4px 6px", color: "#E0E0E0", fontSize: 12 }} /></Field>
                            <Field label="Color"><input type="color" value={ns.strokeColor ?? "#000000"} onChange={(e) => upNs({ strokeColor: e.target.value })} style={{ width: "100%", height: 28, border: "1px solid #333", borderRadius: 4, cursor: "pointer", background: "#1A1A1A", padding: 2 }} /></Field>
                          </div>
                        )}

                        {ns.bevel && (
                          <div style={{ marginTop: 8 }}>
                            <SliderRow label="Depth" value={ns.bevelDepth ?? 4} min={1} max={16} step={1} onChange={(e) => slNs({ bevelDepth: parseInt(e.target.value) })} format={(v) => v + "px"} accent="#E8A055" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                              <Field label="Highlight"><input type="color" value={ns.bevelHighlight ?? "#FFFFFF"} onChange={(e) => upNs({ bevelHighlight: e.target.value })} style={{ width: "100%", height: 28, border: "1px solid #333", borderRadius: 4, cursor: "pointer", background: "#1A1A1A", padding: 2 }} /></Field>
                              <Field label="Shadow"><input type="color" value={ns.bevelShadow ?? "#000000"} onChange={(e) => upNs({ bevelShadow: e.target.value })} style={{ width: "100%", height: 28, border: "1px solid #333", borderRadius: 4, cursor: "pointer", background: "#1A1A1A", padding: 2 }} /></Field>
                            </div>
                          </div>
                        )}

                        {ns.glow && (
                          <div style={{ marginTop: 8 }}>
                            <SliderRow label="Opacity" value={ns.glowOpacity ?? 0.85} onChange={(e) => slNs({ glowOpacity: parseFloat(e.target.value) })} format={(v) => Math.round(v * 100) + "%"} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                              <Field label="Blur"><NumericField value={ns.glowBlur ?? 20} onCommit={(v) => upNs({ glowBlur: Math.max(1, v) })} min={1} max={80} step="1" style={{ width: "100%", boxSizing: "border-box", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "4px 6px", color: "#E0E0E0", fontSize: 12 }} /></Field>
                              <Field label="Color"><input type="color" value={ns.glowColor ?? "#FFD700"} onChange={(e) => upNs({ glowColor: e.target.value })} style={{ width: "100%", height: 28, border: "1px solid #333", borderRadius: 4, cursor: "pointer", background: "#1A1A1A", padding: 2 }} /></Field>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

            </>
          ) : (
            <div style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              {page ? "Click '+ Add text' to create a text box. Once selected, the property panel stays visible until you choose another text box." : "Upload pages to get started."}
            </div>
          )}
        </div>
      </div>

      {/* Preset-apply undo toast — lets the user revert an accidental preset click */}
      {presetUndo && (
        <div style={{ position: "fixed", bottom: 24, left: 24, background: "#141414", border: "1px solid #3a3000", borderRadius: 10, padding: "10px 12px 10px 16px", zIndex: 9999, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <span style={{ fontSize: 13, color: "#C0C0C0" }}>
            Applied <b style={{ color: "#F5D478" }}>{presetUndo.name}</b>
            {presetUndo.scope === "name" && <span style={{ color: "#888" }}> to {"{name}"}</span>}
          </span>
          <button
            onClick={undoPresetApply}
            style={{ background: "#F5D478", border: "none", borderRadius: 6, padding: "5px 14px", color: "#111", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >Undo</button>
          <button
            onClick={() => { setPresetUndo(null); if (presetUndoTimerRef.current) clearTimeout(presetUndoTimerRef.current); }}
            title="Dismiss"
            style={{ background: "none", border: "none", color: "#666", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
          >✕</button>
        </div>
      )}

      {/* Batch export progress toast — persists outside the export modal */}
      {batchExporting && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#141414", border: "1px solid #16a34a", borderRadius: 12, padding: "14px 22px", zIndex: 9999, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 300 }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#6ee7b7", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              {batchProgress.done < batchProgress.total
                ? `Rendering page ${batchProgress.done} / ${batchProgress.total}`
                : "Packaging ZIP…"}
            </div>
            <div style={{ height: 4, background: "#333", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #16a34a, #4ade80)", borderRadius: 2, width: `${batchProgress.total > 0 ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0}%`, transition: "width 0.25s ease" }} />
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowExport(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1A1A1A", borderRadius: 12, padding: 24, width: 600, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#F5D478" }}>Export JSON</span>
              <button onClick={() => setShowExport(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer" }}>X</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button
                onClick={() => generateExport("current")}
                style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: exportMode === "current" ? "#F5D478" : "#2A2A2A", color: exportMode === "current" ? "#000" : "#888", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >当前页 Page {currentPage + 1}</button>
              <button
                onClick={() => generateExport("all")}
                style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: exportMode === "all" ? "#F5D478" : "#2A2A2A", color: exportMode === "all" ? "#000" : "#888", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >全部页 All {pages.length} pages</button>
            </div>
            <pre style={{ background: "#111", borderRadius: 8, padding: 16, fontSize: 12, color: "#aaa", overflow: "auto", flex: 1, maxHeight: "50vh", fontFamily: "monospace", lineHeight: 1.5 }}>{exportJSON}</pre>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={downloadJSON} style={{ flex: 2, background: "linear-gradient(135deg, #F5D478, #A67620)", color: "#000", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>⬇ Download JSON</button>
              <button onClick={() => { void copyToClipboard(exportJSON); }} style={{ flex: 1, background: "#333", color: "#E0E0E0", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, cursor: "pointer" }}>Copy JSON</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => { setShowExport(false); void exportPNG(); }} style={{ flex: 1, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖼 Export current page PNG</button>
              <button
                onClick={() => { setShowExport(false); void exportAllPNG(); }}
                disabled={batchExporting}
                style={{ flex: 1, background: batchExporting ? "#1a2a1a" : "#0d2d0d", color: batchExporting ? "#4a7a4a" : "#6ee7b7", border: "1px solid #16a34a", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: batchExporting ? "not-allowed" : "pointer" }}
              >
                {batchExporting
                  ? `⏳ ${batchProgress.done}/${batchProgress.total} rendered…`
                  : `📦 Export all as ZIP (${pages.filter(p => p.image).length} pages)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
