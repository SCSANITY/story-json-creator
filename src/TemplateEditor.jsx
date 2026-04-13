import { useState, useRef, useCallback, useEffect, useMemo } from "react";

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
  // ── Title Display / 大标题专用 ★ ─────────────────────────────────────────
  { label: "Cinzel Decorative",    value: "'Cinzel Decorative', cursive",     group: "title" },
  { label: "UnifrakturMaguntia",   value: "'UnifrakturMaguntia', cursive",    group: "title" },
  { label: "Rye",                  value: "'Rye', cursive",                   group: "title" },
  { label: "Metamorphous",         value: "'Metamorphous', cursive",          group: "title" },
  { label: "Rozha One",            value: "'Rozha One', serif",               group: "title" },
  { label: "Oswald",               value: "'Oswald', sans-serif",             group: "title" },
  { label: "Russo One",            value: "'Russo One', sans-serif",          group: "title" },
  { label: "Raleway",              value: "'Raleway', sans-serif",            group: "title" },
  { label: "Bangers",              value: "'Bangers', cursive",               group: "title" },
  { label: "Poiret One",           value: "'Poiret One', cursive",            group: "title" },
  { label: "Anton",                value: "'Anton', sans-serif",              group: "title" },
  { label: "Orbitron",             value: "'Orbitron', sans-serif",           group: "title" },
  { label: "Press Start 2P",       value: "'Press Start 2P', cursive",        group: "title" },
  { label: "Permanent Marker",     value: "'Permanent Marker', cursive",      group: "title" },
  { label: "Black Ops One",        value: "'Black Ops One', cursive",         group: "title" },
  { label: "Alfa Slab One",        value: "'Alfa Slab One', cursive",         group: "title" },
  { label: "Italiana",             value: "'Italiana', serif",                group: "title" },
  { label: "Fugaz One",            value: "'Fugaz One', cursive",             group: "title" },
  { label: "Luckiest Guy",         value: "'Luckiest Guy', cursive",          group: "title" },
  { label: "Nunito",               value: "'Nunito', sans-serif",             group: "title" },
  { label: "Poppins",              value: "'Poppins', sans-serif",            group: "title" },
  { label: "Passion One",          value: "'Passion One', cursive",           group: "title" },
  { label: "Rammetto One",         value: "'Rammetto One', cursive",          group: "title" },
  { label: "Amatic SC",            value: "'Amatic SC', cursive",             group: "title" },
  { label: "Caveat",               value: "'Caveat', cursive",                group: "title" },
  { label: "Gloria Hallelujah",    value: "'Gloria Hallelujah', cursive",     group: "title" },
  { label: "Josefin Sans",         value: "'Josefin Sans', sans-serif",       group: "title" },
  { label: "Comfortaa",            value: "'Comfortaa', cursive",             group: "title" },

  // ── Fantasy / Storybook (奇幻 · 故事书风) ──────────────────────────────────
  { label: "Cinzel",              value: "'Cinzel', serif",                group: "fantasy" },
  { label: "Playfair Display",    value: "'Playfair Display', serif",       group: "fantasy" },
  { label: "Cormorant Garamond",  value: "'Cormorant Garamond', serif",     group: "fantasy" },
  { label: "IM Fell English",     value: "'IM Fell English', serif",        group: "fantasy" },
  { label: "Uncial Antiqua",      value: "'Uncial Antiqua', cursive",       group: "fantasy" },
  { label: "MedievalSharp",       value: "'MedievalSharp', serif",          group: "fantasy" },
  { label: "Jim Nightshade",      value: "'Jim Nightshade', cursive",       group: "fantasy" },
  { label: "Philosopher",         value: "'Philosopher', serif",            group: "fantasy" },

  // ── Cute / Children's Book (可爱 · 儿童书风) ──────────────────────────────
  { label: "Fredoka One",         value: "'Fredoka One', cursive",          group: "cute" },
  { label: "Chewy",               value: "'Chewy', cursive",                group: "cute" },
  { label: "Bubblegum Sans",      value: "'Bubblegum Sans', cursive",       group: "cute" },
  { label: "Boogaloo",            value: "'Boogaloo', cursive",             group: "cute" },
  { label: "Lilita One",          value: "'Lilita One', cursive",           group: "cute" },
  { label: "Baloo 2",             value: "'Baloo 2', cursive",              group: "cute" },
  { label: "Pacifico",            value: "'Pacifico', cursive",             group: "cute" },
  { label: "Righteous",           value: "'Righteous', sans-serif",         group: "cute" },

  // ── Calligraphy / Script (书法 · 手写艺术) ────────────────────────────────
  { label: "Great Vibes",         value: "'Great Vibes', cursive",          group: "script" },
  { label: "Dancing Script",      value: "'Dancing Script', cursive",       group: "script" },
  { label: "Kaushan Script",      value: "'Kaushan Script', cursive",       group: "script" },
  { label: "Lobster",             value: "'Lobster', cursive",              group: "script" },
  { label: "Sacramento",          value: "'Sacramento', cursive",           group: "script" },
  { label: "Alex Brush",          value: "'Alex Brush', cursive",           group: "script" },
  { label: "Satisfy",             value: "'Satisfy', cursive",              group: "script" },
  { label: "Abril Fatface",       value: "'Abril Fatface', serif",          group: "script" },

  // ── Bold Display / Impact (强势标题 · 视觉冲击) ───────────────────────────
  { label: "Bebas Neue",          value: "'Bebas Neue', cursive",           group: "display" },
  { label: "Yeseva One",          value: "'Yeseva One', serif",             group: "display" },
  { label: "Titan One",           value: "'Titan One', cursive",            group: "display" },

  // ── Body / Subtitle (正文 · 故事内文) ─────────────────────────────────────
  { label: "Lora",                value: "'Lora', serif",                   group: "body" },
  { label: "Merriweather",        value: "'Merriweather', serif",           group: "body" },
  { label: "Georgia",             value: "Georgia, serif",                  group: "body" },
  { label: "Times New Roman",     value: "'Times New Roman', serif",        group: "body" },
  { label: "Garamond",            value: "Garamond, serif",                 group: "body" },
  { label: "Palatino",            value: "Palatino, serif",                 group: "body" },

  // ── Sans-serif (无衬线) ────────────────────────────────────────────────────
  { label: "Arial",               value: "Arial, sans-serif",               group: "sans" },
  { label: "Verdana",             value: "Verdana, sans-serif",             group: "sans" },
  { label: "Helvetica",           value: "Helvetica, sans-serif",           group: "sans" },
];

const COLOR_PRESETS = [
  { name: "Gold gradient",    value: "gold_gradient",    preview: "linear-gradient(180deg, #F5D478, #C8922A, #F5E6A3, #A67620)" },
  { name: "White",            value: "#FFFFFF",          preview: "#FFFFFF" },
  { name: "Black",            value: "#000000",          preview: "#000000" },
  { name: "Silver",           value: "silver_gradient",  preview: "linear-gradient(180deg, #FFFFFF, #888888, #F0F0F0, #585858)" },
  { name: "Bronze",           value: "bronze_gradient",  preview: "linear-gradient(180deg, #FFD07A, #7A3E0E, #D4904A, #4A2006)" },
  { name: "Rose gold",        value: "rosegold_gradient",preview: "linear-gradient(180deg, #FFD8C0, #B06040, #F0B898, #803828)" },
  { name: "Custom",           value: "custom",           preview: "conic-gradient(red, orange, yellow, green, blue, purple, red)" },
];

// Maps preset gradient names → representative solid hex (used in JSON export only)
const GRADIENT_COLOR_MAP = {
  gold_gradient:     "#C8922A",
  silver_gradient:   "#A0A0A0",
  bronze_gradient:   "#8B5E3C",
  rosegold_gradient: "#C48888",
};

// Build a real canvas linear gradient for PNG export (top→bottom over text box height)
const GRADIENT_STOPS = {
  gold_gradient:     ["#F5D478", "#C8922A", "#F5E6A3", "#A67620"],
  silver_gradient:   ["#FFFFFF", "#888888", "#F0F0F0", "#585858"],
  bronze_gradient:   ["#FFD07A", "#7A3E0E", "#D4904A", "#4A2006"],
  rosegold_gradient: ["#FFD8C0", "#B06040", "#F0B898", "#803828"],
};
function buildCanvasGradient(ctx, colorVal, bx, by, bh) {
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
    font: "'Lora', serif",
    size: 42,
    color: "gold_gradient",
    customColor: "#FFD700",
    bold: true,
    italic: true,
    textAlign: "center",
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
    boxRadius: preset.radius,
    boxPaddingX: preset.paddingX,
    boxPaddingY: preset.paddingY,
    textureImage: null,
  };
};

// Gradient CSS strings, shared between preview and canvas export
const TEXT_GRADIENTS = {
  gold_gradient:     "linear-gradient(180deg, #F5D478 0%, #C8922A 28%, #F5E6A3 52%, #A67620 100%)",
  silver_gradient:   "linear-gradient(180deg, #FFFFFF 0%, #888888 28%, #F0F0F0 52%, #585858 100%)",
  bronze_gradient:   "linear-gradient(180deg, #FFD07A 0%, #7A3E0E 28%, #D4904A 52%, #4A2006 100%)",
  rosegold_gradient: "linear-gradient(180deg, #FFD8C0 0%, #B06040 28%, #F0B898 52%, #803828 100%)",
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

const getTextColorStyle = (item) => {
  if (item.textureImage) {
    return {
      ..._COLOR_BASE,
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

  const colorVal = item.color === "custom" ? item.customColor : item.color;

  if (TEXT_GRADIENTS[colorVal]) {
    return {
      ..._COLOR_BASE,
      color:                "transparent",
      WebkitTextFillColor:  "transparent",
      backgroundImage:      TEXT_GRADIENTS[colorVal],   // gradient via backgroundImage, NOT background shorthand
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
    textShadow: item.shadow
      ? `${item.shadowOffsetX}px ${item.shadowOffsetY}px ${item.shadowBlur}px ${hexToRgba(item.shadowColor, item.shadowOpacity ?? 0.5)}`
      : "none",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    width: "100%",
    height: "100%",
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
  { key: "title",   label: "★ 大标题专用 / Title Display" },
  { key: "fantasy", label: "✦ Fantasy / Storybook (奇幻故事)" },
  { key: "cute",    label: "✦ Cute / Children's Book (可爱儿童)" },
  { key: "script",  label: "✦ Calligraphy / Script (书法手写)" },
  { key: "display", label: "✦ Bold Display / Impact (强势标题)" },
  { key: "body",    label: "— Body / Subtitle (正文内文)" },
  { key: "sans",    label: "— Sans-serif (无衬线)" },
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

  // When picker opens: load all fonts, then scroll to current selection
  useEffect(() => {
    if (!open) return;
    const names = FONT_OPTIONS
      .filter((f) => f.group !== "sans")
      .map((f) => f.value.split(",")[0].trim().replace(/'/g, ""));
    Promise.allSettled(names.map((n) => document.fonts.load(`400 20px "${n}"`))).then(() => {
      forceUpdate((v) => v + 1);
    });
    // Scroll the active item into view after dropdown renders
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
        <span style={{ fontFamily: value, fontSize: 20, lineHeight: 1, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                        padding: "7px 16px",
                        cursor: "pointer",
                        background: isActive ? "#252010" : "transparent",
                        fontFamily: f.value,
                        fontSize: 18,
                        lineHeight: 1.3,
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

// Helper: convert File/Blob URL to base64 data URL
const blobUrlToDataUrl = (blobUrl) =>
  fetch(blobUrl).then((r) => r.blob()).then(
    (blob) => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    })
  );

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
  const [snapGuides, setSnapGuides] = useState([]);
  const [recentColors, setRecentColors] = useState([]);
  const [hoveredPage, setHoveredPage] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // ── Force-preload all custom fonts so previews render correctly ──────────────
  useEffect(() => {
    const names = FONT_OPTIONS
      .filter((f) => f.group !== "sans")
      .map((f) => f.value.split(",")[0].trim().replace(/'/g, ""));
    Promise.allSettled(names.map((n) => document.fonts.load(`400 24px "${n}"`)));
  }, []);

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

  // Auto-save session whenever pages or storyId change (debounced 2s)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!sessionLoaded) return; // don't save until initial load completes
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const api = window.templateEditorDesktop;
      const payload = JSON.stringify({ storyId, pages });
      if (!api?.saveSession) {
        // Web fallback: localStorage
        try { localStorage.setItem('ymi-session', payload); } catch {}
        return;
      }
      api.saveSession(payload).catch(() => {});
    }, 2000);
    return () => clearTimeout(saveTimerRef.current);
  }, [pages, storyId, sessionLoaded]);

  // ── History ────────────────────────────────────────────────────────────────
  const MAX_HISTORY = 40;
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  const saveHistory = useCallback((label) => {
    const snapshot = JSON.parse(JSON.stringify(pagesRef.current));
    const base = historyRef.current.slice(0, historyIdxRef.current + 1);
    const entry = { pages: snapshot, label, time: Date.now() };
    const next = [...base, entry].slice(-MAX_HISTORY);
    historyRef.current = next;
    historyIdxRef.current = next.length - 1;
  }, []);

  const jumpToHistory = useCallback((idx) => {
    if (idx < 0 || idx >= historyRef.current.length) return;
    const entry = historyRef.current[idx];
    historyIdxRef.current = idx;
    setPages(JSON.parse(JSON.stringify(entry.pages)));
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    jumpToHistory(historyIdxRef.current - 1);
  }, [jumpToHistory]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    jumpToHistory(historyIdxRef.current + 1);
  }, [jumpToHistory]);

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
      boxStyle: presetKey,
      boxFillColor: preset.fillColor,
      boxFillOpacity: preset.fillOpacity,
      boxBorderColor: preset.borderColor,
      boxBorderOpacity: preset.borderOpacity,
      boxBorderWidth: preset.borderWidth,
      boxRadius: preset.radius,
      boxPaddingX: preset.paddingX,
      boxPaddingY: preset.paddingY,
    });
  }, [updateText]);

  const handleTextureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      saveHistory("Add texture");
      updateText(sel.id, { textureImage: ev.target.result });
    };
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
    saveHistory("Move text");
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
    saveHistory("Resize text");
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

      // Dragged item's snap points: left / center / right
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

      // Dragged item's snap points: top / center / bottom
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

      setSnapGuides(guides);
      updateText(interaction.id, { x: snappedX, y: snappedY });
      return;
    }

    {
      const dx = (e.clientX - interaction.startX) / interaction.scale;
      const dy = (e.clientY - interaction.startY) / interaction.scale;
      const h = interaction.handle ?? "se";

      let newX = interaction.origX;
      let newY = interaction.origY;
      let newW = interaction.origWidth;
      let newH = interaction.origHeight;

      // East / West (width)
      if (h.includes("e")) {
        newW = clamp(Math.round(interaction.origWidth + dx), MIN_BOX_WIDTH, page.width - interaction.origX);
      }
      if (h.includes("w")) {
        // dragging left = origX decreases, width increases
        const rawX = Math.max(0, interaction.origX + Math.round(dx));
        newX = rawX;
        newW = Math.max(MIN_BOX_WIDTH, interaction.origX + interaction.origWidth - rawX);
      }

      // South / North (height)
      if (h.includes("s")) {
        newH = clamp(Math.round(interaction.origHeight + dy), MIN_BOX_HEIGHT, page.height - interaction.origY);
      }
      if (h.includes("n")) {
        const rawY = Math.max(0, interaction.origY + Math.round(dy));
        newY = rawY;
        newH = Math.max(MIN_BOX_HEIGHT, interaction.origY + interaction.origHeight - rawY);
      }

      updateText(interaction.id, { x: newX, y: newY, boxWidth: newW, maxWidth: newW, boxHeight: newH });
    }
  }, [interaction, page, updateText]);

  const handleMouseUp = useCallback(() => { setInteraction(null); setSnapGuides([]); }, []);

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

  const exportPNG = async () => {
    if (!page || !page.image) { alert("Please upload an image for this page first."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext("2d");

    // Draw background image
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = page.image; });
    ctx.drawImage(img, 0, 0, page.width, page.height);

    for (const item of page.texts) {
      const bx = item.x;
      const by = item.y;
      const bw = item.boxWidth ?? item.maxWidth ?? MIN_BOX_WIDTH;
      const bh = item.boxHeight ?? MIN_BOX_HEIGHT;
      const r = item.boxRadius ?? 0;

      ctx.save();
      ctx.globalAlpha = item.opacity ?? 1;

      // Box fill
      if ((item.boxFillOpacity ?? 0) > 0) {
        ctx.save();
        ctx.globalAlpha = (item.opacity ?? 1) * (item.boxFillOpacity ?? 0);
        ctx.fillStyle = item.boxFillColor ?? "#0F172A";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, r);
        ctx.fill();
        ctx.restore();
      }

      // Box border
      if ((item.boxBorderWidth ?? 0) > 0 && (item.boxBorderOpacity ?? 0) > 0) {
        ctx.save();
        ctx.globalAlpha = (item.opacity ?? 1) * (item.boxBorderOpacity ?? 0);
        ctx.strokeStyle = item.boxBorderColor ?? "#FFFFFF";
        ctx.lineWidth = item.boxBorderWidth ?? 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, r);
        ctx.stroke();
        ctx.restore();
      }

      // Text
      if (item.shadow) {
        ctx.shadowColor = hexToRgba(item.shadowColor ?? "#000000", item.shadowOpacity ?? 0.5);
        ctx.shadowBlur = item.shadowBlur ?? 8;
        ctx.shadowOffsetX = item.shadowOffsetX ?? 2;
        ctx.shadowOffsetY = item.shadowOffsetY ?? 4;
      }

      const colorVal = item.color === "custom" ? (item.customColor ?? "#FFFFFF") : item.color;
      ctx.fillStyle = buildCanvasGradient(ctx, colorVal, bx, by, bh);

      const fontStr = `${item.italic ? "italic " : ""}${item.bold ? "bold " : ""}${item.size}px ${item.font}`;
      ctx.font = fontStr;
      ctx.letterSpacing = `${item.letterSpacing ?? 0}px`;

      const px = item.boxPaddingX ?? 0;
      const py = item.boxPaddingY ?? 0;
      const textX = bx + px;
      const availW = bw - px * 2;
      const lineH = item.size * (item.lineHeight ?? 1.2);
      const content = item.content.replace(/\{name\}/g, previewName);
      const lines = wrapTextCanvas(ctx, content, availW);
      const align = item.textAlign ?? "left";
      ctx.textAlign = align;
      const alignX = align === "center" ? bx + bw / 2 : align === "right" ? bx + bw - px : textX;

      if (item.textureImage) {
        // Render text texture via offscreen canvas + source-in composite
        const off = document.createElement("canvas");
        off.width = bw; off.height = bh;
        const offCtx = off.getContext("2d");
        offCtx.font = fontStr;
        offCtx.letterSpacing = `${item.letterSpacing ?? 0}px`;
        offCtx.textAlign = align;
        const offAlignX = align === "center" ? bw / 2 : align === "right" ? bw - px : px;
        offCtx.fillStyle = "#fff";
        lines.forEach((line, li) => {
          offCtx.fillText(line, offAlignX, py + item.size + li * lineH);
        });
        const texImg = new Image();
        await new Promise((res) => { texImg.onload = res; texImg.src = item.textureImage; });
        offCtx.globalCompositeOperation = "source-in";
        offCtx.drawImage(texImg, 0, 0, bw, bh);
        ctx.shadowColor = "transparent";
        ctx.drawImage(off, bx, by);
      } else {
        lines.forEach((line, li) => {
          ctx.fillText(line, alignX, by + py + item.size + li * lineH);
        });
      }

      ctx.restore();
    }

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${storyId}_page${currentPage + 1}_preview.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const resolveExportColor = (color, customColor) => {
    if (color === "custom") return customColor ?? "#FFFFFF";
    return GRADIENT_COLOR_MAP[color] ?? color;
  };

  const generateExport = () => {
    const config = {
      story_id: storyId,
      generated_at: new Date().toISOString(),
      pages: pages.map((p, i) => ({
        page: i + 1,
        image: p.fileName ?? `page_${i + 1}.png`,
        width: p.width ?? 0,
        height: p.height ?? 0,
        texts: p.texts.map(({ id, customColor, color, ...t }) => ({
          ...t,
          color: resolveExportColor(color, customColor),
        })),
      })),
    };
    const json = JSON.stringify(config, null, 2);
    setExportJSON(json);
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
          setPages(config.pages.map((p) => ({
            image: null,
            fileName: p.image ?? "",
            width: p.width ?? 2480,
            height: p.height ?? 3508,
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
              boxPaddingY: t.boxPaddingY ?? 0,
            })),
          })));
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
    a.download = `${storyId}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sel = page?.texts.find((t) => t.id === selectedText) ?? null;
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
      textShadow: item.shadow
        ? `${item.shadowOffsetX * scale}px ${item.shadowOffsetY * scale}px ${item.shadowBlur * scale}px ${hexToRgba(item.shadowColor, item.shadowOpacity ?? 0.5)}`
        : "none",
    };
    const boxPaddingX = (item.boxPaddingX ?? 0) * scale;
    const boxPaddingY = (item.boxPaddingY ?? 0) * scale;
    const borderWidth = (item.boxBorderWidth ?? 0) * scale;

    return (
      <div
        key={item.id}
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
          background: hexToRgba(item.boxFillColor ?? "#0F172A", item.boxFillOpacity ?? 0),
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
            <span style={getTextColorStyle(item)}>{displayContent}</span>
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
          <label style={{ display: "block", padding: "12px 0", textAlign: "center", border: "2px dashed #333", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#888", marginBottom: 8 }}>
            + Upload pages
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
          </label>
          {pages.map((p, i) => (
            <div key={i}
              onMouseEnter={() => setHoveredPage(i)}
              onMouseLeave={() => setHoveredPage(null)}
              style={{ position: "relative", padding: 4, marginBottom: 6, borderRadius: 6, border: i === currentPage ? "2px solid #F5D478" : "2px solid transparent", opacity: i === currentPage ? 1 : 0.7 }}
            >
              <div onClick={() => setCurrentPage(i)} style={{ cursor: "pointer" }}>
                {p.image
                  ? <img src={p.image} alt={`Page ${i + 1}`} style={{ width: "100%", borderRadius: 4, display: "block" }} />
                  : <div style={{ width: "100%", aspectRatio: "3/4", background: "#1a1a1a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🖼️</div>
                }
                <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 2 }}>Page {i + 1} · {p.texts.length} texts</div>
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
              <textarea value={sel.content} onChange={(e) => updateText(sel.id, { content: e.target.value })} rows={4} style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: 8, color: "#E0E0E0", fontSize: 13, resize: "vertical", marginBottom: 12, fontFamily: "monospace" }} />

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
                    <label style={{ fontSize: 10, color: "#666" }}>Fill opacity</label>
                    <input type="range" min="0" max="1" step="0.05" value={sel.boxFillOpacity ?? 0} onChange={(e) => updateText(sel.id, { boxFillOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Border color</label>
                    <input type="color" value={sel.boxBorderColor ?? "#FFFFFF"} onChange={(e) => updateText(sel.id, { boxBorderColor: e.target.value })} style={{ width: "100%", height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Border opacity</label>
                    <input type="range" min="0" max="1" step="0.05" value={sel.boxBorderOpacity ?? 0} onChange={(e) => updateText(sel.id, { boxBorderOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
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
              {sel.color === "custom" && (
                <input type="color" value={sel.customColor}
                  onChange={(e) => updateText(sel.id, { customColor: e.target.value })}
                  onBlur={(e) => addRecentColor(e.target.value)}
                  style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer", marginBottom: 8 }} />
              )}

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
                    <input type="file" accept="image/*" onChange={handleTextureUpload} style={{ display: "none" }} />
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={() => updateText(sel.id, { bold: !sel.bold })} style={{ flex: 1, background: sel.bold ? "#333" : "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 0", color: sel.bold ? "#F5D478" : "#888", fontSize: 13, cursor: "pointer", fontWeight: "bold" }}>B</button>
                <button onClick={() => updateText(sel.id, { italic: !sel.italic })} style={{ flex: 1, background: sel.italic ? "#333" : "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 0", color: sel.italic ? "#F5D478" : "#888", fontSize: 13, cursor: "pointer", fontStyle: "italic" }}>I</button>
                <button onClick={() => updateText(sel.id, { shadow: !sel.shadow })} style={{ flex: 1, background: sel.shadow ? "#333" : "#1A1A1A", border: "1px solid #444", borderRadius: 6, padding: "6px 0", color: sel.shadow ? "#F5D478" : "#888", fontSize: 13, cursor: "pointer" }}>S</button>
              </div>

              {sel.shadow && (
                <div style={{ background: "#151515", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#888" }}>Shadow settings</label>
                  <div style={{ marginTop: 6, marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: "#666" }}>Shadow opacity</label>
                    <input type="range" min="0" max="1" step="0.05" value={sel.shadowOpacity ?? 0.5} onChange={(e) => updateText(sel.id, { shadowOpacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>Blur</label>
                      <NumericField value={sel.shadowBlur} onCommit={(value) => updateText(sel.id, { shadowBlur: Math.max(0, value) })} min={0} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>Offset X</label>
                      <NumericField value={sel.shadowOffsetX} onCommit={(value) => updateText(sel.id, { shadowOffsetX: value })} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>Offset Y</label>
                      <NumericField value={sel.shadowOffsetY} onCommit={(value) => updateText(sel.id, { shadowOffsetY: value })} step="0.1" style={{ width: "100%", background: "#1A1A1A", border: "1px solid #333", borderRadius: 4, padding: "3px 6px", color: "#E0E0E0", fontSize: 12 }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 10, color: "#666" }}>Shadow color</label>
                    <input type="color" value={sel.shadowColor} onChange={(e) => updateText(sel.id, { shadowColor: e.target.value })} style={{ width: "100%", height: 24, border: "none", borderRadius: 4, cursor: "pointer" }} />
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
                  <input type="range" min="0" max="1" step="0.05" value={sel.opacity} onChange={(e) => updateText(sel.id, { opacity: parseFloat(e.target.value) })} style={{ width: "100%", marginTop: 8 }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input type="checkbox" checked={sel.autoScale} onChange={(e) => updateText(sel.id, { autoScale: e.target.checked })} id="autoscale" />
                <label htmlFor="autoscale" style={{ fontSize: 12, color: "#aaa" }}>Auto-scale long names</label>
              </div>
            </>
          ) : (
            <div style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              {page ? "Click '+ Add text' to create a text box. Once selected, the property panel stays visible until you choose another text box." : "Upload pages to get started."}
            </div>
          )}
        </div>
      </div>

      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowExport(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1A1A1A", borderRadius: 12, padding: 24, width: 600, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#F5D478" }}>Current JSON preview</span>
              <button onClick={() => setShowExport(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer" }}>X</button>
            </div>
            <pre style={{ background: "#111", borderRadius: 8, padding: 16, fontSize: 12, color: "#aaa", overflow: "auto", flex: 1, maxHeight: "50vh", fontFamily: "monospace", lineHeight: 1.5 }}>{exportJSON}</pre>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={downloadJSON} style={{ flex: 2, background: "linear-gradient(135deg, #F5D478, #A67620)", color: "#000", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>⬇ Download {storyId}_template.json</button>
              <button onClick={() => { void copyToClipboard(exportJSON); }} style={{ flex: 1, background: "#333", color: "#E0E0E0", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, cursor: "pointer" }}>Copy JSON</button>
            </div>
            <button onClick={() => { setShowExport(false); void exportPNG(); }} style={{ width: "100%", marginTop: 8, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖼 Export current page as PNG preview</button>
          </div>
        </div>
      )}
    </div>
  );
}
