import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import JSZip from "jszip";

const CANVAS_WIDTH = 720;
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
    const halfLen = Math.sqrt((bw / 2) ** 2 + (bh / 2) ** 2) || bh / 2;
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
    radius: 60,
    paddingX: 36,
    paddingY: 20,
    fadeEdges: true,
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
    boxPaddingX:  preset.paddingX,
    boxPaddingY:  preset.paddingY,
    boxFadeEdges: preset.fadeEdges ?? false,
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


export default function TemplateEditor() {
  const [storyId, setStoryId] = useState("story_01");
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedText, setSelectedText] = useState(null);
  const [interaction, setInteraction] = useState(null);
  const [previewName, setPreviewName] = useState("Amy");
  const [viewportZoom, setViewportZoom] = useState(1);
  const canvasRef = useRef(null);
  const [showExport, setShowExport] = useState(false);
  const [exportJSON, setExportJSON] = useState("");
  const [exportMode, setExportMode] = useState("all");
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [imageLoadProgress, setImageLoadProgress] = useState({ active: false, done: 0, total: 0 });
  const [snapGuides, setSnapGuides] = useState([]);
  const [recentColors, setRecentColors] = useState([]);
  const [hoveredPage, setHoveredPage] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Local textarea state — avoids setPages on every keystroke (committed on blur / 200ms debounce)
  const [localContent, setLocalContent] = useState("");

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
  const baseScale = useMemo(() => {
    if (!page) return 1;
    return CANVAS_WIDTH / page.width;
  }, [page]);
  const scale = baseScale * viewportZoom;

  const updateText = useCallback((id, updates) => {
    setPages((prev) => {
      const updated = [...prev];
      const p = { ...updated[currentPage] };
      p.texts = p.texts.map((t) => (t.id === id ? { ...t, ...updates } : t));
      updated[currentPage] = p;
      return updated;
    });
  }, [currentPage]);

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
      boxPaddingX:    preset.paddingX,
      boxPaddingY:    preset.paddingY,
      boxFadeEdges: preset.fadeEdges ?? false,
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

  const addRecentColor = useCallback((hex) => {
    if (!hex || !hex.startsWith("#")) return;
    setRecentColors((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 6));
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
  const renderPageToPngBlob = async (pageData, resolvedName) => {
    const canvas = document.createElement("canvas");
    canvas.width = pageData.width;
    canvas.height = pageData.height;
    const ctx = canvas.getContext("2d");

    // Background image
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = pageData.image; });
    ctx.drawImage(img, 0, 0, pageData.width, pageData.height);

    for (const item of pageData.texts) {
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
          // Cloud / Mist — single elliptical gradient matching the CSS radial-gradient(ellipse).
          // We simulate an ellipse by scaling the coordinate system to a unit circle,
          // drawing a circular gradient, then restoring — this gives a true ellipse.
          const col = item.boxFillColor ?? "#FFFFFF";
          const op  = item.boxFillOpacity ?? 0.85;

          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, r);
          ctx.clip();

          // Scale CTM so (0,0)→(1,1) maps to the box bounds — gradient unit circle = ellipse
          ctx.translate(bx + bw / 2, by + bh / 2);
          ctx.scale(bw / 2, bh / 2);

          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          grad.addColorStop(0,    hexToRgba(col, op * 0.72));
          grad.addColorStop(0.38, hexToRgba(col, op * 0.48));
          grad.addColorStop(0.68, hexToRgba(col, op * 0.18));
          grad.addColorStop(1,    hexToRgba(col, 0));
          ctx.fillStyle = grad;
          ctx.fillRect(-1, -1, 2, 2); // fills the entire unit-circle space = box area
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

      const colorVal = item.color === "custom" ? (item.customColor ?? "#FFFFFF") : item.color;
      ctx.fillStyle = buildCanvasGradient(ctx, colorVal, bx, by, bh, bw, item);

      const fontStr = `${item.italic ? "italic " : ""}${item.bold ? "bold " : ""}${item.size}px ${item.font}`;
      ctx.font = fontStr;
      ctx.letterSpacing = `${item.letterSpacing ?? 0}px`;

      const px_     = item.boxPaddingX ?? 0;
      const py_     = item.boxPaddingY ?? 0;
      const textX   = bx + px_;
      const availW  = bw - px_ * 2;
      const lineH   = item.size * (item.lineHeight ?? 1.2);
      const rawContent = item.content.replace(/\{name\}/g, resolvedName);
      const tt = item.textTransform ?? "none";
      const content = tt === "uppercase" ? rawContent.toUpperCase()
        : tt === "lowercase" ? rawContent.toLowerCase()
        : tt === "capitalize" ? rawContent.replace(/\b\w/g, (c) => c.toUpperCase())
        : rawContent;
      const lines  = wrapTextCanvas(ctx, content, availW);
      const align  = item.textAlign ?? "left";
      ctx.textAlign = align;
      const alignX = align === "center" ? bx + bw / 2 : align === "right" ? bx + bw - px_ : textX;

      const drawLines = (cx, drawFn) =>
        lines.forEach((line, li) => drawFn(line, cx, by + py_ + item.size + li * lineH));

      // Glow
      if (item.glow) {
        ctx.save();
        ctx.shadowColor   = hexToRgba(item.glowColor ?? "#FFD700", item.glowOpacity ?? 0.85);
        ctx.shadowBlur    = item.glowBlur ?? 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle     = hexToRgba(item.glowColor ?? "#FFD700", 0.001);
        for (let g = 0; g < 3; g++) drawLines(alignX, (ln, ax, ay) => ctx.fillText(ln, ax, ay));
        ctx.restore();
      }

      // Bevel
      if (item.bevel) {
        ctx.save();
        const depth = item.bevelDepth ?? 4;
        const sh = item.bevelShadow    ?? "#000000";
        const hi = item.bevelHighlight ?? "#FFFFFF";
        const drawBevelSteps = (fillStyle) => {
          for (let i = depth; i >= 1; i--) {
            const alpha = 0.08 + ((depth - i + 1) / depth) * 0.42;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = fillStyle;
            drawLines(alignX + i, (ln, ax, ay) => ctx.fillText(ln, ax, ay + i));
            ctx.restore();
          }
        };
        if (item.bevelTexture) {
          const texImg = await new Promise((res) => {
            const ti = new Image(); ti.onload = () => res(ti); ti.onerror = () => res(null); ti.src = item.bevelTexture;
          });
          texImg ? drawBevelSteps(ctx.createPattern(texImg, "repeat")) : drawBevelSteps(hexToRgba(sh, 1));
        } else {
          for (let i = depth; i >= 1; i--) {
            const alpha = 0.08 + ((depth - i + 1) / depth) * 0.42;
            ctx.fillStyle = hexToRgba(sh, alpha);
            drawLines(alignX + i, (ln, ax, ay) => ctx.fillText(ln, ax, ay + i));
          }
        }
        ctx.fillStyle = hexToRgba(hi, 0.35);
        drawLines(alignX - 1, (ln, ax, ay) => ctx.fillText(ln, ax, ay - 1));
        ctx.restore();
      }

      // Drop shadow
      if (item.shadow) {
        ctx.save();
        ctx.shadowColor   = hexToRgba(item.shadowColor ?? "#000000", item.shadowOpacity ?? 0.5);
        ctx.shadowBlur    = item.shadowBlur ?? 8;
        ctx.shadowOffsetX = item.shadowOffsetX ?? 2;
        ctx.shadowOffsetY = item.shadowOffsetY ?? 4;
        ctx.fillStyle     = hexToRgba("#000000", 0.001);
        drawLines(alignX, (ln, ax, ay) => ctx.fillText(ln, ax, ay));
        ctx.restore();
      }

      // Stroke
      if (item.stroke) {
        ctx.lineWidth   = item.strokeWidth ?? 4;
        ctx.strokeStyle = hexToRgba(item.strokeColor ?? "#000000", item.strokeOpacity ?? 1);
        ctx.lineJoin    = "round";
        drawLines(alignX, (ln, ax, ay) => ctx.strokeText(ln, ax, ay));
      }

      // Clear shadow state
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // Fill / texture
      if (item.textureImage) {
        const off    = document.createElement("canvas");
        off.width    = bw; off.height = bh;
        const offCtx = off.getContext("2d");
        offCtx.font          = fontStr;
        offCtx.letterSpacing = `${item.letterSpacing ?? 0}px`;
        offCtx.textAlign     = align;
        const offAlignX      = align === "center" ? bw / 2 : align === "right" ? bw - px_ : px_;
        offCtx.fillStyle     = "#fff";
        lines.forEach((line, li) => offCtx.fillText(line, offAlignX, py_ + item.size + li * lineH));
        const texImg = new Image();
        await new Promise((res) => { texImg.onload = res; texImg.src = item.textureImage; });
        offCtx.globalCompositeOperation = "source-in";
        offCtx.drawImage(texImg, 0, 0, bw, bh);
        ctx.drawImage(off, bx, by);
      } else {
        lines.forEach((line, li) => ctx.fillText(line, alignX, by + py_ + item.size + li * lineH));
      }

      ctx.restore();
    }

    return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));
  };

  // ── Single-page PNG export (current page) ───────────────────────────────────
  const exportPNG = async () => {
    if (!page || !page.image) { alert("Please upload an image for this page first."); return; }
    const blob = await renderPageToPngBlob(page, previewName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storyId}_page${currentPage + 1}_preview.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Batch PNG export → single ZIP download ─────────────────────────────────
  const exportAllPNG = async () => {
    const withImages = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.image);
    if (withImages.length === 0) { alert("No pages have images loaded. Upload images first."); return; }

    setBatchExporting(true);
    setBatchProgress({ done: 0, total: withImages.length });

    const zip = new JSZip();

    for (const { p, i } of withImages) {
      try {
        const blob = await renderPageToPngBlob(p, previewName);
        const stem = p.fileName ? p.fileName.replace(/\.[^.]+$/, "") : `page_${String(i + 1).padStart(2, "0")}`;
        // Zero-pad page number so files sort correctly in the folder
        const filename = `${String(i + 1).padStart(2, "0")}_${stem}_subtitle.png`;
        zip.file(filename, blob);
      } catch (err) {
        console.error(`Page ${i + 1} render failed:`, err);
      }
      setBatchProgress({ done: i + 1, total: withImages.length });
    }

    // Generate ZIP with compression
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 1 }, // level 1 = fastest; PNGs are already compressed
    }, (meta) => {
      // meta.percent fires during ZIP generation — reuse the progress bar
      setBatchProgress((prev) => ({ ...prev, done: Math.round(prev.total * (1 - meta.percent / 100)) + Math.round(meta.percent / 100 * prev.total) }));
    });

    const url = URL.createObjectURL(zipBlob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `${storyId}_subtitles_${withImages.length}pages.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setBatchExporting(false);
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
            return { ...p, image: r.dataUrl, width: r.width, height: r.height };
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
            return { ...p, image: r.dataUrl, width: r.width, height: r.height };
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
        texts: p.texts.map(({ id, customColor, customGradientStart, color, ...t }) => ({
          ...t,
          color: resolveExportColor(color, customColor, customGradientStart),
        })),
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

            return {
              // Keep the existing image if we found one; otherwise null (needs batch assign later)
              image:    existing?.image ?? null,
              fileName: p.image ?? existing?.fileName ?? "",
              width:    p.width  ?? existing?.width  ?? 2480,
              height:   p.height ?? existing?.height ?? 3508,
              texts: (p.texts ?? []).map((t) => ({
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              role: t.role ?? "body",
              content: t.content ?? "",
              x: t.x ?? 120,
              y: t.y ?? 120,
              font: t.font ?? "'Lora', serif",
              size: t.size ?? 42,
              color: t.color ?? "#FFFFFF",
              customColor: t.customColor ?? t.color ?? "#FFFFFF",
              bold: t.bold ?? false,
              italic: t.italic ?? false,
              textAlign: t.textAlign ?? "left",
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
              boxPaddingX: t.boxPaddingX ?? 0,
              boxPaddingY:  t.boxPaddingY ?? 0,
              boxFadeEdges: t.boxFadeEdges ?? false,
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
            })),
            };
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

  const sel = page?.texts.find((t) => t.id === selectedText) ?? null;

  // Sync local textarea content whenever selection changes to a different text box
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalContent(sel?.content ?? ""); }, [sel?.id]);

  // RAF-throttled updateText for sliders — caps React renders at 60fps during scrub
  const sliderUpdate = useCallback((id, updates) => {
    if (sliderRAFRef.current) cancelAnimationFrame(sliderRAFRef.current);
    sliderRAFRef.current = requestAnimationFrame(() => updateText(id, updates));
  }, [updateText]);

  const pageHeight = page ? CANVAS_WIDTH * (page.height / page.width) : 0;
  const renderedCanvasWidth = page ? page.width * scale : CANVAS_WIDTH * viewportZoom;
  const renderedCanvasHeight = page ? page.height * scale : pageHeight * viewportZoom;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setViewportZoom((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))));
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setViewportZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
      } else if (event.key === "0") {
        event.preventDefault();
        setViewportZoom(1);
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
    const displayContent = item.content.replace(/\{name\}/g, previewName);
    const boxWidth = (item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH) * scale;
    const boxHeight = (item.boxHeight ?? MIN_BOX_HEIGHT) * scale;
    const isSelected = selectedText === item.id;
    const isDragging = interaction?.id === item.id && interaction.type === "drag";
    const displayStyle = {
      ...getRenderedTextStyle(item),
      fontSize: `${item.size * scale}px`,
      letterSpacing: `${item.letterSpacing * scale}px`,
      // Bevel is rendered on a separate backing layer so it never bleeds through gradient text.
      textShadow: computeNonBevelShadow(item, scale),
      WebkitTextStroke: item.stroke
        ? `${(item.strokeWidth ?? 4) * scale}px ${hexToRgba(item.strokeColor ?? "#000000", item.strokeOpacity ?? 1)}`
        : "0px transparent",
      paintOrder: "stroke fill",
      position: "relative",
    };
    const boxPaddingX = (item.boxPaddingX ?? 0) * scale;
    const boxPaddingY = (item.boxPaddingY ?? 0) * scale;
    const borderWidth = (item.boxBorderWidth ?? 0) * scale;

    // Cloud/mist: single smooth elliptical gradient — no flat zones, no stacking.
    // opacity multiplier keeps the center visually soft even at high fillOpacity.
    const cloudBg = (() => {
      if (!item.boxFadeEdges || (item.boxFillOpacity ?? 0) === 0) return null;
      const c  = item.boxFillColor ?? "#FFFFFF";
      const op = item.boxFillOpacity ?? 0.85;
      return `radial-gradient(ellipse at center, ${hexToRgba(c, op * 0.72)} 0%, ${hexToRgba(c, op * 0.48)} 38%, ${hexToRgba(c, op * 0.18)} 68%, transparent 100%)`;
    })();

    return (
      <div
        key={item.id}
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
          border: borderWidth > 0 ? `${Math.max(1, borderWidth)}px solid ${hexToRgba(item.boxBorderColor ?? "#FFFFFF", item.boxBorderOpacity ?? 0)}` : "none",
          outline: isSelected ? "2px solid rgba(56,189,248,0.9)" : "none",
          outlineOffset: "1px",
          borderRadius: (item.boxRadius ?? 0) * scale,
          background: cloudBg ?? hexToRgba(item.boxFillColor ?? "#0F172A", item.boxFillOpacity ?? 0),
          boxSizing: "border-box",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          overflow: "visible",
        }}
      >
        <div
          style={{
            padding: `${boxPaddingY}px ${boxPaddingX}px`,
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          <div style={displayStyle}>
            {item.bevel && (
              <span style={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                color: item.bevelShadow ?? "#000000",
                WebkitTextFillColor: item.bevelShadow ?? "#000000",
                textShadow: computeBevelShadow(item, scale),
                pointerEvents: "none",
              }}>
                {displayContent}
              </span>
            )}
            <span style={{ ...getTextColorStyle(item), position: "relative", zIndex: 1 }}>
              {displayContent}
            </span>
          </div>
        </div>

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
                  ? <img src={p.image} alt={`Page ${i + 1}`} style={{ width: "100%", borderRadius: 4, display: "block" }} />
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

        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: 16, overflowY: "auto" }}>
          {page ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={addText} style={{ background: "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 16px", color: "#F5D478", fontSize: 13, cursor: "pointer" }}>+ Add text</button>
                {sel && <button onClick={() => duplicateText(sel.id)} style={{ background: "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 16px", color: "#aaa", fontSize: 13, cursor: "pointer" }}>Duplicate</button>}
                {sel && <button onClick={() => deleteText(sel.id)} style={{ background: "#1A1A1A", border: "1px solid #600", borderRadius: 6, padding: "6px 16px", color: "#F88", fontSize: 13, cursor: "pointer" }}>Delete</button>}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, color: "#888", fontSize: 12 }}>
                  <button onClick={() => setViewportZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))} style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, width: 28, height: 28, color: "#ddd", cursor: "pointer" }}>−</button>
                  <span style={{ minWidth: 44, textAlign: "center" }}>{Math.round(viewportZoom * 100)}%</span>
                  <button onClick={() => setViewportZoom((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))))} style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, width: 28, height: 28, color: "#ddd", cursor: "pointer" }}>+</button>
                </div>
              </div>
              <div ref={canvasRef} style={{ position: "relative", width: renderedCanvasWidth, height: renderedCanvasHeight, background: "#111", borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.5)" }}>
                {page.image
                  ? <img src={page.image} alt={page.fileName} style={{ width: "100%", height: "100%", objectFit: "contain" }} draggable={false} />
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
                          img.onload = () => setPages((prev) => { const u = [...prev]; u[currentPage] = { ...u[currentPage], image: dataUrl, fileName: file.name, width: img.naturalWidth, height: img.naturalHeight }; return u; });
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
              <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                Original: {page.width}x{page.height}px · Select a text box to edit it · Drag the top strip to move · Drag the bottom-right corner to resize · {`{name}`} = user's name
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

        <div style={{ width: 320, borderLeft: "1px solid #222", padding: 16, overflowY: "auto", flexShrink: 0 }}>
          {sel ? (
            <>
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

              <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Content (use {`{name}`} for user's name)</label>
              <textarea
                value={localContent}
                onChange={(e) => {
                  const v = e.target.value;
                  setLocalContent(v);
                  // Debounce: write to pages state 200ms after last keystroke
                  if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
                  contentDebounceRef.current = setTimeout(() => updateText(sel.id, { content: v }), 200);
                }}
                onBlur={(e) => {
                  // Immediate commit on blur so value is always saved before switching pages
                  if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
                  updateText(sel.id, { content: e.target.value });
                }}
                rows={4}
                style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: 8, color: "#E0E0E0", fontSize: 13, resize: "vertical", marginBottom: 12, fontFamily: "monospace" }}
              />

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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Fill color</label>
                    <input type="color" value={sel.boxFillColor ?? "#0F172A"} onChange={(e) => updateText(sel.id, { boxFillColor: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>{sel.boxFadeEdges ? "Peak opacity" : "Fill opacity"}</label>
                    <input type="range" min="0" max="1" step="0.05" value={sel.boxFillOpacity ?? 0} onChange={(e) => sliderUpdate(sel.id, { boxFillOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Border color</label>
                    <input type="color" value={sel.boxBorderColor ?? "#FFFFFF"} onChange={(e) => updateText(sel.id, { boxBorderColor: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Border opacity</label>
                    <input type="range" min="0" max="1" step="0.05" value={sel.boxBorderOpacity ?? 0} onChange={(e) => sliderUpdate(sel.id, { boxBorderOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Border px</label>
                    <NumericField value={sel.boxBorderWidth ?? 0} onCommit={(value) => updateText(sel.id, { boxBorderWidth: Math.max(0, value) })} min={0} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Radius</label>
                    <NumericField value={sel.boxRadius ?? 0} onCommit={(value) => updateText(sel.id, { boxRadius: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Pad X</label>
                    <NumericField value={sel.boxPaddingX ?? 0} onCommit={(value) => updateText(sel.id, { boxPaddingX: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Pad Y</label>
                    <NumericField value={sel.boxPaddingY ?? 0} onCommit={(value) => updateText(sel.id, { boxPaddingY: Math.max(0, value) })} min={0} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                  </div>
                </div>
              </div>

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
                <div style={{ marginBottom: 8 }}>
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

              {/* Typography style row — B / I / U + Transform */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button onClick={() => updateText(sel.id, { bold: !sel.bold })} title="Bold" style={{ flex: 1, background: sel.bold ? "#2C2400" : "#1A1A1A", border: `1px solid ${sel.bold ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "7px 0", color: sel.bold ? "#F5D478" : "#666", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>B</button>
                <button onClick={() => updateText(sel.id, { italic: !sel.italic })} title="Italic" style={{ flex: 1, background: sel.italic ? "#2C2400" : "#1A1A1A", border: `1px solid ${sel.italic ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "7px 0", color: sel.italic ? "#F5D478" : "#666", fontSize: 14, cursor: "pointer", fontStyle: "italic" }}>I</button>
                <button onClick={() => updateText(sel.id, { underline: !sel.underline })} title="Underline" style={{ flex: 1, background: sel.underline ? "#2C2400" : "#1A1A1A", border: `1px solid ${sel.underline ? "#F5D478" : "#333"}`, borderRadius: 6, padding: "7px 0", color: sel.underline ? "#F5D478" : "#666", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>U</button>
              </div>
              {/* Text Transform row */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[["none","Aa","Normal"],["uppercase","AA","Caps"],["lowercase","aa","lower"],["capitalize","Ab","Title"]].map(([val,lbl,tip]) => (
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
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#555" }}>Opacity</label>
                      <span style={{ fontSize: 10, color: "#888", fontVariantNumeric: "tabular-nums" }}>{Math.round((sel.shadowOpacity ?? 0.5) * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={sel.shadowOpacity ?? 0.5} onChange={(e) => sliderUpdate(sel.id, { shadowOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 4, accentColor: "#F5D478" }} />
                  </div>
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
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#555" }}>Opacity</label>
                      <span style={{ fontSize: 10, color: "#888", fontVariantNumeric: "tabular-nums" }}>{Math.round((sel.strokeOpacity ?? 1) * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={sel.strokeOpacity ?? 1} onChange={(e) => sliderUpdate(sel.id, { strokeOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 4, accentColor: "#7EC8E3" }} />
                  </div>
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
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#555" }}>Depth</label>
                      <span style={{ fontSize: 10, color: "#888", fontVariantNumeric: "tabular-nums" }}>{sel.bevelDepth ?? 4}px</span>
                    </div>
                    <input type="range" min="1" max="16" step="1" value={sel.bevelDepth ?? 4} onChange={(e) => sliderUpdate(sel.id, { bevelDepth: parseInt(e.target.value) })} style={{ width: "100%", marginTop: 4, accentColor: "#E8A055" }} />
                  </div>
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
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#555" }}>Opacity</label>
                      <span style={{ fontSize: 10, color: "#888", fontVariantNumeric: "tabular-nums" }}>{Math.round((sel.glowOpacity ?? 0.85) * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={sel.glowOpacity ?? 0.85} onChange={(e) => sliderUpdate(sel.id, { glowOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 4, accentColor: "#FFD700" }} />
                  </div>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Max width (px)</label>
                  <NumericField value={sel.maxWidth} onCommit={(value) => { const safe = Math.max(MIN_BOX_WIDTH, Math.round(value)); updateText(sel.id, { maxWidth: safe, boxWidth: safe }); }} min={MIN_BOX_WIDTH} step="1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", color: "#E0E0E0", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888" }}>Opacity</label>
                  <input type="range" min="0" max="1" step="0.05" value={sel.opacity} onChange={(e) => sliderUpdate(sel.id, { opacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
                </div>
              </div>

            </>
          ) : (
            <div style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              {page ? "Click '+ Add text' to create a text box. Once selected, the property panel stays visible until you choose another text box." : "Upload pages to get started."}
            </div>
          )}
        </div>
      </div>

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
