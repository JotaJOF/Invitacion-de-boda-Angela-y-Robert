const KEY_LABELS = {
  bride_initial: "Inicial de la Novia (a)",
  bride_first_name: "Nombre de la Novia (NGELA)",
  bride_last_name: "Apellido de la Novia (PALMERSTON)",
  groom_initial: "Inicial del Novio (R)",
  groom_first_name: "Nombre del Novio (OBERT)",
  groom_last_name: "Apellido del Novio (WILSON)",
  cover_and: "Conector de nombres (and)",
  cover_place: "Lugar del evento en portada",
  cover_date_fmt: "Fecha del evento en portada",
  couple_names: "Nombres de la pareja",
  couple_heading: "Título principal de la pareja",
  closing_names: "Nombres de despedida",
  closing_text: "Mensaje final",
  venue_name: "Nombre del salón / lugar",
  venue_address: "Dirección del evento",
  venue_time: "Hora de recepción",
  ceremony_location: "Lugar de la ceremonia",
  ceremony_time: "Hora de la ceremonia",
  dress_code: "Código de vestimenta",
  wedding_date: "Fecha completa de boda",
  rsvp_date: "Fecha límite de confirmación",
  rsvp_note: "Nota de pases",
  whatsapp_eyebrow: "Título de WhatsApp",
  whatsapp_button_text: "Botón de WhatsApp",
  whatsapp_note: "Nota de WhatsApp",
  album_copy: "Texto del álbum de fotos",
  album_button_text: "Botón del álbum",
  gift_copy: "Texto de regalos",
  welcome_text: "Texto de bienvenida",
  countdown_heading: "Título cuenta regresiva",
  save_date_label_1: "Texto reserva (Reserva)",
  save_date_label_2: "Texto fecha (ESTA FECHA)",
  save_date_day: "Día de la fecha",
  save_date_month: "Mes de la fecha",
  save_date_year: "Año de la fecha"
};

const pendingChanges = new Map();  
let contentNodes = [];  
const loginDialog = document.querySelector("#login-dialog");  
const loginForm = document.querySelector("#login-form");  
const loginMessage = document.querySelector("#login-message");  
const adminOpen = document.querySelector("#admin-open");  
const adminToolbar = document.querySelector("#admin-toolbar");  
const toolbarMessage = document.querySelector("#toolbar-message");  
const imagePicker = document.querySelector("#image-picker");  
const toast = document.querySelector("#toast");  
  
let authenticated = false;  
let editing = false;  
let activeImage = null;  
let toastTimeout;  
let contentLoadVersion = 0;  
  
// Lista de fuentes disponibles (agregar más aquí cuando se carguen nuevas)    
const FONTS = [  
  { label: "Great Vibes", value: "'Great Vibes', cursive" },  
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', Georgia, serif" },  
  { label: "Montserrat", value: "'Montserrat', Arial, sans-serif" },  
  { label: "Farmstead", value: "'Farmstead', serif" },  
  { label: "Yapari", value: "'Yapari', serif" },  
  { label: "Throhand Ink", value: "'Throhand Ink', serif" },  
  { label: "Gelasio", value: "'Gelasio', Georgia, serif" },    
  { label: "Snell Roundhand", value: '"Snell Roundhand", cursive' },
  { label: "Formale Script", value: '"Formale Script", cursive' },
];  
let styleBar = null;  
let styleBarFor = null;  
  
function showToast(message) {  
  toast.textContent = message;  
  toast.classList.add("is-visible");  
  window.clearTimeout(toastTimeout);  
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);  
}  
  
async function api(path, options = {}) {  
  let url = path;
  if (
    currentWedding &&
    !url.includes("wedding=") &&
    (url.startsWith("/api/content") ||
      url.startsWith("/api/upload") ||
      url.startsWith("/api/guests") ||
      url.startsWith("/api/invites"))
  ) {
    url += (url.includes("?") ? "&" : "?") + `wedding=${encodeURIComponent(currentWedding)}`;
  }

  const response = await fetch(url, {  
    credentials: "same-origin",  
    ...options,  
    headers: {  
      ...(options.body instanceof FormData  
        ? {}  
        : { "content-type": "application/json" }),  
      ...options.headers,  
    },  
  });  
  const result = await response.json().catch(() => ({}));  
  if (!response.ok) throw new Error(result.error || "No se pudo completar la solicitud.");  
  return result;  
}  
  
function isMediaElement(element) {  
  return element instanceof HTMLImageElement || element instanceof HTMLVideoElement;  
}  
  
async function preloadImage(value) {  
  const image = new Image();  
  image.decoding = "async";  
  image.src = value;  
  
  if (typeof image.decode === "function") {  
    await image.decode();  
  } else if (!image.complete) {  
    await new Promise((resolve, reject) => {  
      image.addEventListener("load", resolve, { once: true });  
      image.addEventListener("error", () => reject(new Error("No se pudo cargar la imagen.")), { once: true });  
    });  
  }  
  
  if (image.naturalWidth === 0) throw new Error("No se pudo cargar la imagen.");  
  return image.src;  
}  
  
async function preloadVideo(value) {  
  const video = document.createElement("video");  
  video.preload = "auto";  
  video.muted = true;  
  video.src = value;  
  if (video.readyState >= 2) return value;  
  await new Promise((resolve, reject) => {  
    video.addEventListener("loadeddata", resolve, { once: true });  
    video.addEventListener("error", () => reject(new Error("No se pudo cargar el video.")), { once: true });  
  });  
  return value;  
}  
  
// Un mismo archivo puede estar guardado como ruta relativa ("video.mp4") y
// usado como URL absoluta (R2), así que se comparan resueltas contra la página.
function isAbsoluteMediaUrl(value) {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("data:");
}

function sameMediaSrc(element, value) {
  const current = element.getAttribute("src") || "";
  if (!current || !value) return false;
  if (current === value) return true;
  const resolve = (raw) => {
    try { return new URL(raw, document.baseURI).href; } catch { return raw; }
  };
  const clean = (raw) => resolve(raw).split(/[?#]/)[0];
  if (isAbsoluteMediaUrl(current) && isAbsoluteMediaUrl(value)) {
    return clean(current) === clean(value);
  }
  return clean(current).split("/").pop() === clean(value).split("/").pop();
}

async function setElementValue(element, type, value, isCurrent = () => true) {  
  // Si el elemento ya está mostrando ese mismo archivo no se toca: ocultarlo y
  // volver a asignar el src reiniciaba el video (en el móvil desaparecía y
  // reaparecía justo después de abrir el sobre).
  if (type === "image" && isMediaElement(element) && sameMediaSrc(element, value)) {
    element.style.removeProperty("visibility");
    return;
  }
  if (type === "image" && element instanceof HTMLImageElement) {  
    element.style.visibility = "hidden";  
    try {  
      const loadedSrc = await preloadImage(value);  
      if (!isCurrent()) return;  
      element.src = loadedSrc;  
      element.style.removeProperty("visibility");  
    } catch (error) {  
      element.removeAttribute("src");  
      element.style.visibility = "hidden";  
      throw error;  
    }  
  } else if (type === "image" && element instanceof HTMLVideoElement) {  
    element.style.visibility = "hidden";  
    try {  
      const loadedSrc = await preloadVideo(value);  
      if (!isCurrent()) return;  
      element.src = loadedSrc;  
      element.style.removeProperty("visibility");  
    } catch (error) {  
      element.removeAttribute("src");  
      element.style.visibility = "hidden";  
      throw error;  
    }  
  } else if (type === "text" && isCurrent()) {    
    element.textContent = value;    
    element.style.whiteSpace = "pre-wrap";    
  }  
}  
  
function recordBaseline(element) {  
  if (isMediaElement(element)) {  
    element.dataset.originalSrc = element.getAttribute("src") ?? "";  
  } else {  
    element.dataset.originalText = element.textContent ?? "";  
    element.dataset.originalFontFamily = element.style.fontFamily ?? "";  
    element.dataset.originalFontSize = element.style.fontSize ?? "";  
    element.dataset.originalMaxWidth = element.style.maxWidth ?? "";  
    element.dataset.originalTransform = element.style.transform ?? "";  
  }  
}  
  
async function loadContent() {  
  const loadVersion = ++contentLoadVersion;  
  try {  
    const { content = {} } = await api("/api/content", { method: "GET" });  
    if (loadVersion !== contentLoadVersion) return;  
    let failedImages = false;  
    const imageLoads = [];  
    for (const element of contentNodes) {  
      const key = element.dataset.key;  
      const saved = key ? content[key] : null;  
      if (saved && saved.type === "image" && isMediaElement(element)) {  
        imageLoads.push(  
          setElementValue(element, saved.type, saved.value,  
            () => loadVersion === contentLoadVersion,  
          ).catch(() => {  
            if (element.dataset.originalSrc) element.src = element.dataset.originalSrc;  
            element.style.removeProperty("visibility");  
          }),  
        );  
              } else if (saved && (saved.type === "text" || saved.type === "image")) {  
        if (!(saved.type === "text" && (element.dataset.styleOnly || element.dataset.computed))) {
          setElementValue(element, saved.type, saved.value, () => loadVersion === contentLoadVersion);  
        }
      }      
      const styleSaved = key ? content[`${key}__style`] : null;  
      if (styleSaved) {  
        try {  
          const style = normalizeCanvasStyle(JSON.parse(styleSaved.value));  
          if (style.fontFamily) element.style.fontFamily = style.fontFamily;  
          if (style.fontSize) element.style.fontSize = style.fontSize;  
          if (style.maxWidth) element.style.maxWidth = style.maxWidth;  
          if (style.width) element.style.width = style.width;  
          if (style.display === "inline-block") element.style.display = "inline-block";  
          if (style.whiteSpace) element.style.whiteSpace = style.whiteSpace;  
          if (style.transform) {
            element.style.transform = style.transform;
            const re = /translate\(\s*(-?[\d.]+)(px|cqw)?(?:\s*,\s*(-?[\d.]+)(px|cqw)?)?\s*\)/;
            const m = re.exec(style.transform);
            if (m) {
              const uX = m[2] || "cqw";
              const uY = m[4] || uX;
              const cW = canvasWidth(element);
              element.dataset.shiftX = String(Number(m[1]) * (uX === "px" ? 100 / cW : 1));
              element.dataset.shiftY = String((m[3] !== undefined ? Number(m[3]) : 0) * (uY === "px" ? 100 / cW : 1));
            }
          }  
          if (style.marginLeft) element.style.marginLeft = style.marginLeft;  
          if (style.marginRight) element.style.marginRight = style.marginRight;  
          if (style.marginTop) element.style.marginTop = style.marginTop;  
          if (style.marginBottom) element.style.marginBottom = style.marginBottom;  
        } catch { /* estilo inválido, se ignora */ }  
      } 
    }  
    await Promise.all(imageLoads);  
    applySavedBackgrounds(content);

    // Mismas reglas que la página publicada. Antes aquí se generaba una segunda
    // hoja con el selector [data-key], mientras la app usaba #root [data-key]:
    // la vista de edición y la invitación publicada no aplicaban lo mismo.
    for (const [k, item] of Object.entries(content)) {
      if (k.endsWith("__style") && item && item.value) {
        try {
          updateDynamicCssRule(k.replace(/__style$/, ""), normalizeCanvasStyle(JSON.parse(item.value)));
        } catch {}
      }
    }

    for (const element of contentNodes) recordBaseline(element);  
    if (failedImages) {  
      showToast("No se pudo cargar una imagen; se ocultó para no mostrar una versión anterior.");  
    }  
  } catch {  
    if (loadVersion === contentLoadVersion) {  
      showToast("No se pudo cargar el contenido guardado; se muestran las imágenes locales.");  
    }  
  } finally {  
    if (loadVersion === contentLoadVersion) {  
      document.documentElement.classList.remove("is-loading-content");  
    }  
  }  
}  
  
function normalizeCanvasStyle(raw) {
  const style = { ...raw };
  for (const key of ["width", "maxWidth", "fontSize", "marginLeft", "marginRight", "marginTop", "marginBottom"]) {
    if (typeof style[key] === "string" && /^-?(\d+(?:\.\d+)?)px$/.test(style[key])) {
      style[key] = `${(parseFloat(style[key]) * 100 / 540).toFixed(4)}cqw`;
    }
  }
  if (typeof style.transform === "string") {
    style.transform = style.transform.replace(
      /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/g,
      (_match, x, y) => `translate(${(Number(x) * 100 / 540).toFixed(4)}cqw, ${(Number(y) * 100 / 540).toFixed(4)}cqw)`,
    );
  }
  return style;
}

function canvasWidth(element) {  
  return element.closest(".save-date-wrapper, .invite-shell")?.getBoundingClientRect().width || 540;  
}
function canvasLength(px, element) {
  return `${(px * 100 / canvasWidth(element)).toFixed(4)}cqw`;
}
function readCanvasShift(element) {
  let x = Number(element.dataset.shiftX);
  let y = Number(element.dataset.shiftY);
  if (Number.isFinite(x) && Number.isFinite(y) && (element.dataset.shiftX || element.dataset.shiftY)) {
    return { x, y };
  }

  const cWidth = canvasWidth(element);
  const existing = element.style.transform || "";
  if (existing) {
    const re = /translate\(\s*(-?[\d.]+)(px|cqw)?(?:\s*,\s*(-?[\d.]+)(px|cqw)?)?\s*\)/g;
    let match; x = 0; y = 0;
    let found = false;
    while ((match = re.exec(existing)) !== null) {
      found = true;
      const uX = match[2] || "cqw";
      const uY = match[4] || uX;
      x += Number(match[1]) * (uX === "px" ? 100 / cWidth : 1);
      y += (match[3] !== undefined ? Number(match[3]) : 0) * (uY === "px" ? 100 / cWidth : 1);
    }
    if (found) {
      element.dataset.shiftX = String(x);
      element.dataset.shiftY = String(y);
      return { x, y };
    }
  }

  const key = element.dataset.key;
  if (key) {
    const styleTag = document.getElementById("dynamic-content-styles");
    if (styleTag && styleTag.textContent) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchRule = styleTag.textContent.match(new RegExp(`\[data-key="${escapedKey}"\][^}]*transform:\s*translate\(\s*(-?[\d.]+)(px|cqw)?(?:\s*,\s*(-?[\d.]+)(px|cqw)?)?\s*\)`, "i"));
      if (matchRule) {
        const uX = matchRule[2] || "cqw";
        const uY = matchRule[4] || uX;
        x = Number(matchRule[1]) * (uX === "px" ? 100 / cWidth : 1);
        y = (matchRule[3] !== undefined ? Number(matchRule[3]) : 0) * (uY === "px" ? 100 / cWidth : 1);
        element.dataset.shiftX = String(x);
        element.dataset.shiftY = String(y);
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
}

function pencilMarkup() {  
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';  
}  
  
function positionPencils() {  
  // Ya no hay lápices flotantes; solo reposiciona la barra de estilo.  
  positionStyleBar();  
}  
  
function stopInlineEditing(element) {  
  element.contentEditable = "false";  
  element.classList.remove("is-editing");  
  if (styleBarFor === element) hideStyleBar();  
}  
  
function hideStyleBar() {  
  if (styleBar) styleBar.remove();  
  styleBar = null;  
  styleBarFor = null;  
  removeResizeHandles();  
}  
  
function currentFontLabel(element) {  
  const family = getComputedStyle(element).fontFamily.toLowerCase();  
  const match = FONTS.find((f) => family.includes(f.label.toLowerCase()));  
  return match ? match.label : family.split(",")[0].replace(/["']/g, "").trim();  
}  
  
function toKebabCase(str) {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function updateDynamicCssRule(key, s) {
  let styleTag = document.getElementById("dynamic-content-styles");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "dynamic-content-styles";
    document.head.appendChild(styleTag);
  }
  const rules = [];
  if (s.fontFamily) rules.push(`font-family: ${s.fontFamily} !important;`);
  if (s.fontSize) rules.push(`font-size: ${s.fontSize} !important;`);
  if (s.maxWidth) rules.push(`max-width: ${s.maxWidth} !important;`);
  if (s.width) rules.push(`width: ${s.width} !important;`);
  if (s.display) rules.push(`display: ${s.display} !important;`);
  if (s.whiteSpace) rules.push(`white-space: ${s.whiteSpace} !important;`);
  if (s.transform) rules.push(`transform: ${s.transform} !important;`);
  if (s.marginLeft) rules.push(`margin-left: ${s.marginLeft} !important;`);
  if (s.marginRight) rules.push(`margin-right: ${s.marginRight} !important;`);
  if (s.marginTop) rules.push(`margin-top: ${s.marginTop} !important;`);
  if (s.marginBottom) rules.push(`margin-bottom: ${s.marginBottom} !important;`);

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rulePattern = new RegExp(`(?:#root\\s+)?\\[data-key="${escapedKey}"\\]\\s*\\{[^}]*\\}`, "g");
  const newRule = rules.length ? `#root [data-key="${key}"] { ${rules.join(" ")} }` : "";
  let currentCss = styleTag.textContent || "";
  // Un RegExp con /g conserva lastIndex entre llamadas: .test() fallaba y se
  // añadían reglas duplicadas en vez de reemplazar la anterior.
  if (new RegExp(rulePattern.source).test(currentCss)) {
    styleTag.textContent = currentCss.replace(rulePattern, newRule);
  } else if (newRule) {
    styleTag.textContent = (currentCss.trim() ? currentCss.trim() + "\n" : "") + newRule;
  }
}

function applyStyleToElement(el, s) {
  const map = {
    fontFamily: "font-family",
    fontSize: "font-size",
    maxWidth: "max-width",
    width: "width",
    display: "display",
    whiteSpace: "white-space",
    transform: "transform",
    marginLeft: "margin-left",
    marginRight: "margin-right",
    marginTop: "margin-top",
    marginBottom: "margin-bottom",
  };
  for (const [prop, cssProp] of Object.entries(map)) {
    const val = s[prop];
    if (val) {
      el.style.setProperty(cssProp, val, "important");
    } else {
      el.style.removeProperty(cssProp);
    }
  }
}

function markStyleChange(element) {  
  const styleObj = {  
    fontFamily: element.style.fontFamily || "",  
    fontSize: normalizeCanvasStyle({ fontSize: element.style.fontSize || "" }).fontSize,  
    maxWidth: normalizeCanvasStyle({ maxWidth: element.style.maxWidth || "" }).maxWidth,
    width: normalizeCanvasStyle({ width: element.style.width || "" }).width,  
    // Antes se guardaba "inline-block" por defecto en CADA guardado (incluso al
    // editar solo el texto), y eso movía el elemento en la página publicada.
    display: element.style.display || "",  
    whiteSpace: element.style.whiteSpace || "",
    transform: normalizeCanvasStyle({ transform: element.style.transform || "" }).transform,  
    marginLeft: normalizeCanvasStyle({ marginLeft: element.style.marginLeft || "" }).marginLeft,  
    marginRight: normalizeCanvasStyle({ marginRight: element.style.marginRight || "" }).marginRight,  
    marginTop: normalizeCanvasStyle({ marginTop: element.style.marginTop || "" }).marginTop,  
    marginBottom: normalizeCanvasStyle({ marginBottom: element.style.marginBottom || "" }).marginBottom,  
  };
  pendingChanges.set(`${element.dataset.key}__style`, {  
    element,  
    type: "style",  
    value: JSON.stringify(styleObj),  
  });  
  toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`; 

  updateDynamicCssRule(element.dataset.key, styleObj);

  document.querySelectorAll(`[data-key="${element.dataset.key}"]`).forEach((el) => {  
    applyStyleToElement(el, styleObj);
  });
}  
  
let resizeHandles = [];  
let resizeRaf = 0;  
function removeResizeHandles() {  
  resizeHandles.forEach((h) => h.remove());  
  resizeHandles = [];  
  if (resizeRaf) {  
    cancelAnimationFrame(resizeRaf);  
    resizeRaf = 0;  
  }  
}  
  
function addResizeHandles(element) {  
  removeResizeHandles();  
  ["left", "right"].forEach((side) => {  
    const h = document.createElement("div");  
    h.className = "rs-handle";  
    h.dataset.side = side;  
    document.body.append(h);  
    resizeHandles.push(h);  
    h.addEventListener("pointerdown", (e) => {  
      e.preventDefault();  
      e.stopPropagation();  
      try { h.setPointerCapture(e.pointerId); } catch {}
      const startPointerX = e.clientX;  
      const startRect = element.getBoundingClientRect();  
      const startLeft = startRect.left;
      const startRight = startRect.right;
      const startW = startRect.width;  

      const { x: startShiftX, y: startShiftY } = readCanvasShift(element);
      const cWidth = canvasWidth(element);

      const onMove = (ev) => {  
        ev.preventDefault();
        const deltaX = ev.clientX - startPointerX;  
        element.style.setProperty("display", "inline-block", "important");  
        element.style.setProperty("white-space", "normal", "important");  
        
        if (side === "right") {  
          // Borde izquierdo queda 100% inmóvil; estira el lado derecho con el cursor
          const targetW = Math.max(24, Math.round(startW + deltaX));  
          element.style.setProperty("width", canvasLength(targetW, element), "important");  
          element.style.setProperty("max-width", canvasLength(targetW, element), "important");  
          
          const curLeft = element.getBoundingClientRect().left;
          const leftDriftPx = curLeft - startLeft;
          const newShiftX = startShiftX - (leftDriftPx * 100 / cWidth);
          element.dataset.shiftX = String(newShiftX);
          element.dataset.shiftY = String(startShiftY);
          element.style.setProperty("transform", `translate(${newShiftX.toFixed(4)}cqw, ${startShiftY.toFixed(4)}cqw)`, "important");  
        } else {  
          // Borde derecho queda 100% inmóvil; estira el lado izquierdo con el cursor
          const targetW = Math.max(24, Math.round(startW - deltaX));  
          element.style.setProperty("width", canvasLength(targetW, element), "important");  
          element.style.setProperty("max-width", canvasLength(targetW, element), "important");  
          
          const curRight = element.getBoundingClientRect().right;
          const rightDriftPx = curRight - startRight;
          const newShiftX = startShiftX - (rightDriftPx * 100 / cWidth);
          element.dataset.shiftX = String(newShiftX);
          element.dataset.shiftY = String(startShiftY);
          element.style.setProperty("transform", `translate(${newShiftX.toFixed(4)}cqw, ${startShiftY.toFixed(4)}cqw)`, "important");  
        }  
        markStyleChange(element);
        positionResizeHandles();  
        positionStyleBar();
      };  

      const onUp = (ev) => {  
        try { h.releasePointerCapture(ev.pointerId); } catch {}
        window.removeEventListener("pointermove", onMove);  
        window.removeEventListener("pointerup", onUp);  
        window.removeEventListener("pointercancel", onUp);  
        h.removeEventListener("pointermove", onMove);  
        h.removeEventListener("pointerup", onUp);  
        h.removeEventListener("pointercancel", onUp);  
        markStyleChange(element);  
        positionResizeHandles();
        positionStyleBar();
      };  

      window.addEventListener("pointermove", onMove);  
      window.addEventListener("pointerup", onUp);  
      window.addEventListener("pointercancel", onUp);  
      h.addEventListener("pointermove", onMove);  
      h.addEventListener("pointerup", onUp);  
      h.addEventListener("pointercancel", onUp);  
    });  
  });    
  const loop = () => {    
    positionResizeHandles();    
    resizeRaf = requestAnimationFrame(loop);    
  };    
  loop();    
}  
  
function showStyleBar(element) {
  hideStyleBar();
  styleBarFor = element;
  styleBar = document.createElement("div");
  styleBar.className = "style-bar";
  styleBar.addEventListener("pointerdown", (e) => e.stopPropagation());
  const media = isMediaElement(element);

  const move = document.createElement("div");
  move.className = "style-move";
  const moveBy = (dx, dy) => {
    const { x: curX, y: curY } = readCanvasShift(element);
    const scale = 100 / canvasWidth(element);
    const nextX = curX + dx * scale;
    const nextY = curY + dy * scale;
    element.dataset.shiftX = String(nextX);
    element.dataset.shiftY = String(nextY);
    element.style.setProperty("display", "inline-block", "important");
    element.style.setProperty("transform", `translate(${nextX.toFixed(4)}cqw, ${nextY.toFixed(4)}cqw)`, "important");
    markStyleChange(element);
    positionStyleBar();
    positionResizeHandles();
  };
  [["◀", -5, 0], ["▲", 0, -5], ["▼", 0, 5], ["▶", 5, 0]].forEach(([label, dx, dy]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "style-btn style-btn-mini";
    b.textContent = label;
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveBy(dx, dy);
    });
    move.append(b);
  });

  if (media) {
    const replace = document.createElement("button");
    replace.type = "button";
    replace.className = "style-btn";
    replace.textContent = "Cambiar imagen";
    replace.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeImage = element;
      imagePicker.value = "";
      imagePicker.click();
    });
    const smaller = document.createElement("button");
    smaller.type = "button";
    smaller.className = "style-btn style-btn-mini";
    smaller.textContent = "−";
    smaller.title = "Reducir";
    smaller.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const w = element.offsetWidth || 80;
      if (w > 24) {
        element.style.setProperty("width", canvasLength(w - 8, element), "important");
        element.style.setProperty("max-width", canvasLength(w - 8, element), "important");
        markStyleChange(element);
        positionStyleBar();
        positionResizeHandles();
      }
    });
    const larger = document.createElement("button");
    larger.type = "button";
    larger.className = "style-btn style-btn-mini";
    larger.textContent = "+";
    larger.title = "Aumentar";
    larger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const w = element.offsetWidth || 80;
      element.style.setProperty("width", canvasLength(w + 8, element), "important");
      element.style.setProperty("max-width", canvasLength(w + 8, element), "important");
      markStyleChange(element);
      positionStyleBar();
      positionResizeHandles();
    });
    styleBar.append(replace, smaller, larger, move);
  } else {
    const fontBtn = document.createElement("button");
    fontBtn.type = "button";
    fontBtn.className = "style-btn style-btn-font";
    fontBtn.textContent = currentFontLabel(element);
    fontBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      styleBar.querySelectorAll(".style-menu").forEach((m) => m.remove());
      const menu = document.createElement("div");
      menu.className = "style-menu";
      FONTS.forEach((f) => {
        const opt = document.createElement("button");
        opt.type = "button";
        opt.className = "style-menu-item";
        opt.textContent = f.label;
        opt.style.fontFamily = f.value;
        opt.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          element.style.setProperty("font-family", f.value, "important");
          fontBtn.textContent = f.label;
          markStyleChange(element);
          menu.remove();
          positionStyleBar();
          positionResizeHandles();
        });
        menu.append(opt);
      });
      styleBar.append(menu);
    });

    const sizeWrap = document.createElement("div");
    sizeWrap.className = "style-size";
    const down = document.createElement("button");
    down.type = "button";
    down.className = "style-btn style-btn-mini";
    down.textContent = "−";
    const value = document.createElement("span");
    value.className = "style-size-num";
    value.textContent = String(Math.round(parseFloat(getComputedStyle(element).fontSize)) || 16);
    const up = document.createElement("button");
    up.type = "button";
    up.className = "style-btn style-btn-mini";
    up.textContent = "+";
    const bump = (d) => {
      const cur = parseFloat(getComputedStyle(element).fontSize) || 16;
      const n = Math.max(8, Math.min(140, Math.round(cur + d * 2)));
      element.style.setProperty("font-size", canvasLength(n, element), "important");
      value.textContent = String(n);
      markStyleChange(element);
      positionStyleBar();
      positionResizeHandles();
    };
    down.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      bump(-1);
    });
    up.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      bump(1);
    });
    sizeWrap.append(down, value, up);
    styleBar.append(fontBtn, sizeWrap, move);
  }
  document.body.append(styleBar);
  positionStyleBar();
  addResizeHandles(element);
}

function positionStyleBar() {  
  if (!styleBar || !styleBarFor) return;  
  const vv = window.visualViewport;  
  const top = vv ? vv.offsetTop + 8 : 8;  
  styleBar.style.left = "8px";  
  styleBar.style.right = "auto";  
  styleBar.style.top = `${top}px`;  
  styleBar.style.transform = "none";  
}    
if (window.visualViewport) {    
  window.visualViewport.addEventListener("resize", positionStyleBar);    
  window.visualViewport.addEventListener("scroll", positionStyleBar);    
}
function positionResizeHandles() {
  if (!styleBarFor || !resizeHandles.length) {
    if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
    return;
  }
  const r = styleBarFor.getBoundingClientRect();
  const vv = window.visualViewport;
  const offX = vv ? vv.offsetLeft : 0;
  const offY = vv ? vv.offsetTop : 0;
  resizeHandles.forEach((h) => {
    const top = offY + r.top + r.height / 2 - 16;
    h.style.top = `${top}px`;
    h.style.left = h.dataset.side === "left"
      ? `${offX + r.left - 18}px`
      : `${offX + r.right + 4}px`;
  });
}

function beginTextEdit(element) {  
  document.querySelectorAll('[data-key].is-editing').forEach(stopInlineEditing);  
  element.contentEditable = "true";  
  element.style.whiteSpace = "pre-wrap";
  element.onkeydown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.execCommand("insertText", false, "\n");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  element.classList.add("is-editing");  
  element.focus();  
  toolbarMessage.textContent = `Editando: ${KEY_LABELS[element.dataset.key] || element.dataset.key}`;  
  showStyleBar(element);  
}   
  
function addPencils() {  
  document.querySelectorAll(".edit-pencil").forEach((button) => button.remove());  
  if (!editing) return;  
  
  contentNodes.forEach((element) => {  
    if (element.dataset.tapEdit) return;  
    element.dataset.tapEdit = "1";  
    element.addEventListener("click", (e) => {  
      if (!editing) return;  
      if (element.classList.contains("is-editing")) return; // ya editando: deja mover el cursor  
      // Bloquea la acción del botón padre (subir foto, abrir link) al editar,  
      // EXCEPTO los botones de FAQ (niños, estacionamiento) que deben desplegar.  
      const btn = element.closest("button, a");  
      if (btn && !btn.closest('[data-key^="button-faq-"]') && !btn.classList.contains("faq-question")) {  
        e.preventDefault();  
        e.stopPropagation();  
      }  
      if (isMediaElement(element)) {  
        activeImage = element;  
        imagePicker.value = "";  
        imagePicker.click();  
      } else if (element.dataset.styleOnly) {  
        showStyleBar(element);  
      } else {  
        beginTextEdit(element);  
      }  
    });  
  });  
}  
document.addEventListener("click", (e) => {
  if (!editing) return;
  if (!e.target.closest("#root")) return;
  const envelope = e.target.closest(".envelope-button");
  const keyEl = e.target.closest("[data-key]") || (envelope && envelope.querySelector('[data-key="envelope_base_img"]'));
  const btn = e.target.closest("button, a");  
  // FAQ: dejar que se despliegue  
  if (btn && (btn.classList.contains("faq-question") || btn.querySelector('[data-key^="faq_question"]'))) return;  
  if (!keyEl) {  
    if (btn) { e.preventDefault(); e.stopPropagation(); }  
    return;  
  }  
  if (keyEl.classList.contains("is-editing")) {
    return;
  }
  if (btn) e.preventDefault();
  e.stopPropagation();  
  if (isMediaElement(keyEl)) {
    showStyleBar(keyEl);
  } else if (keyEl.dataset.styleOnly) {  
    showStyleBar(keyEl);  
  } else {  
    beginTextEdit(keyEl);  
  }  
}, true);

function setEditingMode(enabled) {  
  editing = enabled;  
  adminToolbar.hidden = !enabled;  
  adminOpen.hidden = enabled;  
  contentNodes.forEach((element) => {  
    element.classList.toggle("editable-target", enabled);  
    if (!enabled) stopInlineEditing(element);  
  });  
  addPencils();    
  document.querySelectorAll(".music-fab").forEach((b) => { b.style.display = enabled ? "none" : ""; });    
  if (enabled) {    
    toolbarMessage.textContent = "Toca un texto o imagen para editarlo.";    
  }  
}  
  
document.addEventListener("input", (event) => {  
  const target = event.target;  
  if (!(target instanceof HTMLElement) || !target.matches("[data-key].is-editing")) return;  
  pendingChanges.set(target.dataset.key, {  
    element: target,  
    type: "text",  
    value: target.innerText ?? "",  
  });  
  toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`;  
});  
  
imagePicker.addEventListener("change", async () => {  
  const file = imagePicker.files?.[0];  
  if (!file || !activeImage) return;  
  toolbarMessage.textContent = "Subiendo archivo…";  
  try {  
    const form = new FormData();  
    form.set("file", file);  
    form.set("key", activeImage.dataset.key);  
    const { url } = await api("/api/upload", { method: "POST", body: form });  
    pendingChanges.set(activeImage.dataset.key, {  
      element: activeImage,  
      type: "image",  
      value: url,  
    });  
    toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`;  
    const esVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);  
    try {  
      if (esVideo && !(activeImage instanceof HTMLVideoElement)) {  
        showToast("Video subido. Pulsa GUARDAR y recarga para verlo.");  
      } else {  
        await setElementValue(activeImage, "image", url);  
      }  
    } catch {  
      showToast("Archivo subido, pero la vista previa no se pudo mostrar. Pulsa GUARDAR.");  
    }  
  } catch (error) {  
    showToast(error.message);  
    toolbarMessage.textContent = "No se pudo subir el archivo.";  
  }  
});  
  
document.querySelector("#save-content").addEventListener("click", async () => {  
  const activeEl = document.querySelector("[data-key].is-editing");
  if (activeEl) {
    if (!isMediaElement(activeEl)) {
      pendingChanges.set(activeEl.dataset.key, {
        element: activeEl,
        type: "text",
        value: activeEl.innerText ?? "",
      });
    }
    markStyleChange(activeEl);
  }

  if (pendingChanges.size === 0) {  
    showToast("No hay cambios pendientes.");  
    return;  
  }  
  const button = document.querySelector("#save-content");  
  button.disabled = true;  
  const savedKeys = [];  
  try {  
    for (const [key, change] of pendingChanges) {  
      await api(`/api/content/${encodeURIComponent(key)}`, {  
        method: "PUT",  
        body: JSON.stringify({ type: change.type === "style" ? "text" : change.type, value: change.value }),  
      });  
      savedKeys.push(key);  
    }  
    for (const key of savedKeys) {  
      const change = pendingChanges.get(key);  
      if (change) {  
        if (change.type === "text") setElementValue(change.element, change.type, change.value);  
        stopInlineEditing(change.element);  
        recordBaseline(change.element);  
        pendingChanges.delete(key);  
      }  
    }  
    showToast("Cambios guardados.");  
    toolbarMessage.textContent = "Edición activada";  
  } catch (error) {  
    savedKeys.forEach((key) => {  
      const change = pendingChanges.get(key);  
      if (change) {  
        recordBaseline(change.element);  
        pendingChanges.delete(key);  
      }  
    });  
    showToast(error.message);  
    toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} pendiente${pendingChanges.size === 1 ? "" : "s"}`;  
  } finally {  
    button.disabled = false;  
  }  
});  
  
document.querySelector("#cancel-edit").addEventListener("click", async () => {  
  if (pendingChanges.size && !window.confirm("¿Descartar los cambios que aún no guardaste?")) {  
    return;  
  }  
  pendingChanges.forEach(({ element }) => {  
    const key = element.dataset.key;  
    if (isMediaElement(element)) {  
      if (element.dataset.originalSrc) {  
        element.src = element.dataset.originalSrc;  
        element.style.removeProperty("visibility");  
      } else {  
        element.removeAttribute("src");  
        element.style.visibility = "hidden";  
      }  
    } else {  
      element.textContent = element.dataset.originalText ?? "";  
      element.style.fontFamily = element.dataset.originalFontFamily ?? "";  
      element.style.fontSize = element.dataset.originalFontSize ?? "";  
      element.style.maxWidth = element.dataset.originalMaxWidth ?? "";  
      element.style.transform = element.dataset.originalTransform ?? "";  
    }  
    stopInlineEditing(element);  
    pendingChanges.delete(key);  
    pendingChanges.delete(`${key}__style`);  
  });
  adminFloatBar.hidden = true;  
  adminPanel.hidden = true;
  
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});  
  authenticated = false;  
  setEditingMode(false);  
  showToast("Sesión cerrada.");  
});  
  
adminOpen.addEventListener("click", async () => {  
  if (authenticated) {  
    showAdminPanel();  
    return;  
  }  
  loginMessage.textContent = "";  
  loginDialog.showModal();  
});  
  
document.querySelector("#login-close").addEventListener("click", () => loginDialog.close());  
loginDialog.addEventListener("click", (event) => {  
  if (event.target === loginDialog) loginDialog.close();  
});  
  
loginForm.addEventListener("submit", async (event) => {  
  event.preventDefault();  
  loginMessage.textContent = "";  
  const submit = loginForm.querySelector('[type="submit"]');  
  submit.disabled = true;  
  const form = new FormData(loginForm);  
  try {  
    const loginRes = await api("/api/login", {  
      method: "POST",  
      body: JSON.stringify({  
        username: form.get("username"),  
        password: form.get("password"),  
      }),  
    });  
    authenticated = true;  
    currentSession = loginRes;
    if (loginRes.wedding_id) {
      currentWedding = loginRes.wedding_id;
    }
    loginDialog.close();  
    loginForm.reset();  
    showAdminPanel();  
    showToast("Sesión iniciada.");  
  } catch (error) {  
    loginMessage.textContent = error.message;  
  } finally {  
    submit.disabled = false;  
  }  
});  
  
// Las manijas de resize siguen al elemento al hacer scroll o resize.  
window.addEventListener("scroll", positionResizeHandles, { passive: true });  
window.addEventListener("resize", positionResizeHandles);  
  
const inviteRoot = document.querySelector("#root");  
  
function refreshNodes() {  
  const nodes = [...document.querySelectorAll("[data-key]")];  
  if (nodes.length === contentNodes.length && nodes.every((node, index) => node === contentNodes[index])) return;  
  contentNodes = nodes;  
  if (!contentNodes.length) return;  
  loadContent();  
  if (editing) setEditingMode(true);  
}  
  
if (inviteRoot) {  
  new MutationObserver(refreshNodes).observe(inviteRoot, {  
    childList: true,  
    subtree: true,  
  });  
}  
refreshNodes();  
  
function getActiveWeddingSlug() {
  const parts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const first = parts[0] || "";
  if (!first || first === "index.html" || first === "admin.html" || first === "invitados.html") {
    return "angela-robert";
  }
  return first.toLowerCase();
}

let currentSession = null;
let currentWedding = getActiveWeddingSlug();

api("/api/me", { method: "GET" })  
  .then((session) => {  
    authenticated = session.authenticated === true;  
    currentSession = session.authenticated ? session : null;
    if (currentSession && currentSession.wedding_id) {
      currentWedding = currentSession.wedding_id;
    }
    if (authenticated && new URLSearchParams(window.location.search).get("edit") === "1") {
      setTimeout(() => {
        if (adminPanel) adminPanel.hidden = true;
        if (adminFloatBar) adminFloatBar.hidden = false;
        setEditingMode(true);
      }, 300);
    }
  })  
  .catch(() => {  
    authenticated = false;  
    currentSession = null;
  });
const adminPanel = document.querySelector("#admin-panel");  
const panelMessage = document.querySelector("#panel-message");  
const adminFloatBar = document.querySelector("#admin-float-bar");  
const PANEL_KEYS = {  
  cfg_location_url: "#cfg-location",  
  cfg_whatsapp: "#cfg-whatsapp",  
  cfg_date: "#cfg-date",  
  cfg_drive_url: "#cfg-drive",  
};  
  
async function loadPanel() {  
  try {  
    const target = (currentSession?.role === "superadmin" && currentWedding) ? currentWedding : (currentSession?.wedding_id || "angela-robert");
    const { content = {} } = await api(`/api/content?wedding=${encodeURIComponent(target)}`, { method: "GET" });  
    for (const [key, sel] of Object.entries(PANEL_KEYS)) {  
      const input = document.querySelector(sel);  
      if (input) input.value = content[key] ? content[key].value : "";  
    }  
  } catch { /* sin datos previos */ }  
}  

function applyPermissionsAndNav() {
  const homeBtn = document.querySelector(".panel-home");
  if (homeBtn) {
    const targetSlug = currentSession?.role === "superadmin" ? currentWedding : (currentSession?.wedding_id || "angela-robert");
    homeBtn.href = (targetSlug === "angela-robert" ? "/" : `/${targetSlug}`);
    homeBtn.target = "_self";
  }

  const isCouple = currentSession?.role === "couple";
  const perms = currentSession?.permissions || {};

  const toggleControl = (selector, allowed) => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.style.display = allowed ? "" : "none";
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) label.style.display = allowed ? "" : "none";
  };

  if (isCouple) {
    toggleControl("#cfg-location", perms.location !== false);
    toggleControl("#cfg-whatsapp", perms.whatsapp !== false);
    toggleControl("#cfg-date", perms.date !== false);
    toggleControl("#cfg-drive", perms.drive !== false);
    toggleControl("#music-upload", perms.music !== false);
    toggleControl("#music-test", perms.music !== false);
    toggleControl("#guests-list", perms.guests !== false);
    toggleControl("#invites-open", perms.invites !== false);
    toggleControl("#panel-edit", perms.edit !== false);
    toggleControl("#panel-themes", perms.themes !== false);
    
    const saBox = document.querySelector("#superadmin-box");
    if (saBox) saBox.style.display = "none";
  } else {
    // Superadmin: todo visible
    document.querySelectorAll("#admin-panel input, #admin-panel label, #admin-panel .button").forEach(el => {
      if (el.id !== "music-file" && el.id !== "music-test") el.style.display = "";
    });
    renderSuperadminControls();
  }
}

async function initWeddingManagement() {
  const selector=document.querySelector("#admin-wedding-selector");
  const toggleBtn=document.querySelector("#btn-toggle-new-wedding");
  const formBox=document.querySelector("#new-wedding-form");
  const slugInput=document.querySelector("#nw-slug");
  const namesInput=document.querySelector("#nw-names");
  const preview=document.querySelector("#nw-link-preview");
  const saveBtn=document.querySelector("#btn-save-new-wedding");
  const homeBtn=document.querySelector("#panel-home-btn");
  const label=document.querySelector("#wedding-selected-name-label");
  if(!selector) return;
  const update=()=>{
    const opt=selector.options[selector.selectedIndex];
    if(label) label.textContent=opt?.textContent || currentWedding;
    if(homeBtn){homeBtn.href=currentWedding==="angela-robert"?"/":`/${currentWedding}`;homeBtn.target="_self";}
  };
  try {
    const {weddings=[]}=await api("/api/weddings");
    selector.innerHTML='<option value="angela-robert">Angela Palmerston y Robert Wilson (Principal - /)</option>';
    weddings.forEach(w=>{if(w.id==="angela-robert"||w.id==="erick-erika")return;const o=document.createElement("option");o.value=w.id;o.textContent=`${w.names} (/${w.id})`;selector.append(o);});
    selector.value=currentWedding; update();
  } catch {}
  selector.onchange=()=>{currentWedding=selector.value;update();loadPanel();applyPermissionsAndNav();showToast(`Boda seleccionada: ${currentWedding}`);};
  if(toggleBtn&&formBox) toggleBtn.onclick=()=>{const open=formBox.style.display==="none";formBox.style.display=open?"block":"none";toggleBtn.textContent=open?"✕ CERRAR":"+ NUEVA BODA";};
  if(namesInput&&slugInput&&preview){namesInput.oninput=()=>{if(!slugInput.dataset.manual){slugInput.value=namesInput.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");preview.textContent=`${location.origin}/${slugInput.value}`;}};slugInput.oninput=()=>{slugInput.dataset.manual="1";preview.textContent=`${location.origin}/${slugInput.value.trim()}`;};}
  if(saveBtn) saveBtn.onclick=async()=>{
    const names=namesInput?.value.trim();const slug=slugInput?.value.trim().toLowerCase();
    if(!names||!slug){alert("Por favor ingresa los nombres y el slug.");return;}
    saveBtn.disabled=true;saveBtn.textContent="CREANDO COPIA…";
    const permissions={location:document.querySelector("#perm-loc")?.checked??true,whatsapp:document.querySelector("#perm-ws")?.checked??true,date:document.querySelector("#perm-date")?.checked??true,drive:document.querySelector("#perm-drive")?.checked??true,music:document.querySelector("#perm-music")?.checked??true,guests:document.querySelector("#perm-guests")?.checked??true,invites:document.querySelector("#perm-invites")?.checked??true,edit:true,themes:true};
    try {
      await api("/api/weddings",{method:"POST",body:JSON.stringify({id:slug,names,date_iso:document.querySelector("#nw-date")?.value,couple_username:document.querySelector("#nw-user")?.value.trim()||null,couple_password:document.querySelector("#nw-pass")?.value||null,permissions})});
      const opt=document.createElement("option");opt.value=slug;opt.textContent=`${names} (/${slug})`;selector.append(opt);selector.value=slug;currentWedding=slug;update();
      loadPanel();applyPermissionsAndNav();showToast(`Copia de Angela y Robert creada: ${names}`);
      if(formBox)formBox.style.display="none";if(toggleBtn)toggleBtn.textContent="+ NUEVA BODA";
      if(namesInput)namesInput.value="";if(slugInput){slugInput.value="";delete slugInput.dataset.manual;}
      const date=document.querySelector("#nw-date");if(date)date.value="";
      ["#nw-user","#nw-pass"].forEach(sel=>{const el=document.querySelector(sel);if(el)el.value="";});
    } catch(err){alert(`Error al crear boda: ${err.message}`);} finally{saveBtn.disabled=false;saveBtn.textContent="CREAR BODA Y ACTIVAR ENLACE";}
  };
}

function renderSuperadminControls() {
  initWeddingManagement();
}

function showAdminPanel() {  
  adminPanel.hidden = false;  
  adminFloatBar.hidden = true;  
  adminToolbar.hidden = true;  
  applyPermissionsAndNav();
  loadPanel();  
}  
  
document.querySelector("#panel-save").addEventListener("click", async () => {  
  panelMessage.textContent = "";  
  try {  
    const targetSlug = currentSession?.role === "superadmin" ? currentWedding : (currentSession?.wedding_id || "angela-robert");
    for (const [key, sel] of Object.entries(PANEL_KEYS)) {  
      const input = document.querySelector(sel);
      if (!input || input.style.display === "none") continue;  
      const value = input.value.trim();  
      if (!value) continue;  
      await api(`/api/content/${key}?wedding=${encodeURIComponent(targetSlug)}`, {  
        method: "PUT",  
        body: JSON.stringify({ type: "text", value }),  
      });  
    }  
    showToast("Datos guardados.");  
  } catch (error) {  
    panelMessage.textContent = error.message;  
  }  
});  
  
document.querySelector("#panel-edit").addEventListener("click", () => {
  const active=getActiveWeddingSlug();
  if(currentSession?.role==="superadmin" && currentWedding!==active){
    window.location.assign(`${currentWedding==="angela-robert"?"/":`/${currentWedding}`}?edit=1`);
    return;
  }
  adminPanel.hidden=true; adminFloatBar.hidden=false; setEditingMode(true);
});  
  
document.querySelector("#float-back").addEventListener("click", () => {  
  setEditingMode(false);  
  setThemesMode(false);  
  adminFloatBar.hidden = true;  
  showAdminPanel();  
});  
  
document.querySelector("#float-save").addEventListener("click", () => {  
  document.querySelector("#save-content").click();  
});
const guestsModal = document.querySelector("#guests-modal");  
const guestsBody = document.querySelector("#guests-body");  
const guestsTotals = document.querySelector("#guests-totals");  
  
async function loadGuestsList() {    
  guestsBody.innerHTML = "<tr><td colspan='8'>Cargando…</td></tr>";  
  try {  
    const { guests = [] } = await api("/api/guests", { method: "GET" });  
let yes = 0, no = 0, pases = 0;  
guestsBody.innerHTML = guests.map((r, i) => {  
  if (r.attendance === 'yes') { yes++; pases += r.confirmed_passes || 0; }  
  else if (r.attendance === 'no') no++;  
  const fecha = new Date(r.created_at).toLocaleString("es-MX");  
  const mod = r.modified ? `Sí · ${new Date(r.modified_at).toLocaleString("es-MX")}` : "No";  
  const conf = r.attendance === 'yes' ? "CONFIRMADO" : r.attendance === 'no' ? "NO ASISTE" : "PENDIENTE";  
  const via = r.source === "whatsapp" ? `WhatsApp ${r.phone || ""}` : "Formulario";  
  return `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${conf}</td><td>${r.confirmed_passes ?? r.passes ?? "—"}</td><td>${esc(r.attendance_notes ?? r.message ?? "")}</td><td>${fecha}</td><td>${mod}</td><td>${esc(via)}</td></tr>`;
}).join("") || "<tr><td colspan='8'>Sin confirmaciones todavía.</td></tr>";  
    guestsTotals.innerHTML = `<div><strong>${yes}</strong> CONFIRMADOS</div><div><strong>${no}</strong> NO PODRÁN ASISTIR</div><div><strong>${pases}</strong> PASES CONFIRMADOS</div>`;  
  } catch (e) { guestsBody.innerHTML = `<tr><td colspan='8'>${e.message}</td></tr>`; }    
}    
    
document.querySelector("#guests-list").addEventListener("click", () => {    
  guestsModal.hidden = false;    
  loadGuestsList();    
});    
document.querySelector("#guests-refresh").addEventListener("click", () => loadGuestsList());    
document.querySelector("#guests-close").addEventListener("click", () => { guestsModal.hidden = true; });    
document.querySelector("#guests-print").addEventListener("click", () => {    
  document.body.classList.add("printing-guests");    
  window.print();    
  setTimeout(() => document.body.classList.remove("printing-guests"), 500);    
});
// ===== Generar links personalizados =====  
const invitesModal = document.querySelector("#invites-modal");  
const invitesBody = document.querySelector("#invites-body");  
const invitesInput = document.querySelector("#invites-input");  
const invitesFile = document.querySelector("#invites-file");  
let invitesData = [];  
  
function esc(text) {  
  return String(text ?? "").replace(/[&<>"]/g, (c) =>  
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));  
}  
  
async function loadInvites() {  
  invitesBody.innerHTML = "<tr><td colspan='6'>Cargando…</td></tr>";  
  const { guests = [] } = await api("/api/guests", { method: "GET" });  
  invitesData = guests.filter((g) => g.code);  
  invitesBody.innerHTML = invitesData.map((g) => {  
    const invitePath = currentWedding === "angela-robert" ? "/" : `/${currentWedding}`;
    const link = `${location.origin}${invitePath}?c=${g.code}`;  
    const conf = g.attendance === "yes" ? "CONFIRMADO" : g.attendance === "no" ? "NO ASISTE" : "PENDIENTE";  
    const wa = g.phone  
      ? `<a href="https://wa.me/${g.phone}?text=${encodeURIComponent(`Hola, aquí está tu invitación a nuestra boda: ${link}`)}" target="_blank">Enviar</a>`  
      : "—";  
    return `<tr><td>${esc(g.name)}</td><td>${g.max_passes ?? 0}</td><td><button type="button" class="copy-link" data-link="${link}">Copiar</button></td><td>${g.opened_at ? "✔" : ""}</td><td>${conf}</td><td>${wa}</td></tr>`;  
  }).join("") || "<tr><td colspan='6'>Sin invitados con link todavía.</td></tr>";  
}  
  
invitesBody.addEventListener("click", (event) => {  
  const btn = event.target.closest(".copy-link");  
  if (!btn) return;  
  navigator.clipboard.writeText(btn.dataset.link);  
  btn.textContent = "Copiado";  
});  
  
document.querySelector("#invites-open").addEventListener("click", () => {  
  invitesModal.hidden = false;  
  loadInvites().catch((e) => { invitesBody.innerHTML = `<tr><td colspan='6'>${e.message}</td></tr>`; });  
});  
  
document.querySelector("#invites-close").addEventListener("click", () => { invitesModal.hidden = true; });  
  
document.querySelector("#invites-refresh").addEventListener("click", () => {  
  loadInvites().catch((e) => { invitesBody.innerHTML = `<tr><td colspan='6'>${e.message}</td></tr>`; });  
});  
  
function parseInviteLines(text) {  
  return text.split(/\r?\n/).map((line) => {  
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());  
    const [name, passes, phone] = cols;  
    if (!name || name.toLowerCase() === "nombre") return null;  
    return { name, max_passes: Number(passes) || 0, phone: phone || "" };  
  }).filter(Boolean);  
}  
  
async function addInvites(guests) {  
  if (guests.length === 0) return;  
  await api("/api/invites", { method: "POST", body: JSON.stringify({ guests }) });  
  invitesInput.value = "";  
  await loadInvites();  
}  
  
document.querySelector("#invites-add").addEventListener("click", () => {  
  addInvites(parseInviteLines(invitesInput.value)).catch((e) => alert(e.message));  
});  
  
// Importar Excel/CSV  
document.querySelector("#invites-import").addEventListener("click", () => invitesFile.click());  
invitesFile.addEventListener("change", () => {  
  const file = invitesFile.files[0];  
  if (!file) return;  
  const reader = new FileReader();  
  reader.onload = () => {  
    addInvites(parseInviteLines(String(reader.result)))  
      .then(() => { invitesFile.value = ""; })  
      .catch((e) => alert(e.message));  
  };  
  reader.readAsText(file);  
});  
  
// Exportar Excel/CSV (nombres, pases, teléfono + links)  
document.querySelector("#invites-export").addEventListener("click", () => {  
  const rows = [["Nombre", "Pases", "Teléfono", "Link", "Abrió", "Confirmó"]];  
  for (const g of invitesData) {  
    rows.push([  
      g.name, g.max_passes ?? 0, g.phone || "",  
      `${location.origin}${currentWedding === "angela-robert" ? "/" : `/${currentWedding}`}?c=${g.code}`,
      g.opened_at ? "Sí" : "No",  
      g.attendance || "pendiente",  
    ]);  
  }  
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");  
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });  
  const a = document.createElement("a");  
  a.href = URL.createObjectURL(blob);  
  a.download = "invitados.csv";  
  a.click();  
});

// ===== Canción de fondo =====  
const musicUploadBtn = document.querySelector("#music-upload");  
const musicFileInput = document.querySelector("#music-file");  
const musicTestBtn = document.querySelector("#music-test");  
const musicStatus = document.querySelector("#music-status");  
let musicUrl = "";  
let musicPreview = null;  
  
async function refreshMusicStatus() {    
  try {    
    const { content = {} } = await api("/api/content", { method: "GET" });    
    musicUrl = content.cfg_music_url ? content.cfg_music_url.value : "";      
  } catch { /* sin datos */ }    
  if (musicStatus) {  
    musicStatus.textContent = musicUrl  
      ? decodeURIComponent(musicUrl.split("/").pop().split("?")[0])  
      : "Sin canción";  
  }  
}    
  
const musicDeleteBtn = document.querySelector("#music-delete");  
if (musicDeleteBtn) {  
  musicDeleteBtn.addEventListener("click", async () => {  
    if (!musicUrl) return showToast("No hay canción para borrar.");  
    if (!confirm("¿Borrar la canción de fondo?")) return;  
    try {  
      await api("/api/content/cfg_music_url", {  
        method: "PUT",  
        body: JSON.stringify({ type: "text", value: "" }),  
      });  
      if (musicPreview) { musicPreview.pause(); musicPreview = null; }  
      musicUrl = "";  
      musicStatus.textContent = "Sin canción";  
      musicTestBtn.hidden = true;  
      showToast("Canción borrada.");  
    } catch (error) {  
      showToast(error.message);  
    }  
  });  
} 
  
if (musicUploadBtn && musicFileInput) {  
  musicUploadBtn.addEventListener("click", () => musicFileInput.click());  
  musicFileInput.addEventListener("change", async () => {  
    const file = musicFileInput.files?.[0];  
    if (!file) return;  
    musicStatus.textContent = "Subiendo canción…";  
    try {  
      const form = new FormData();  
      form.set("file", file);  
      form.set("key", "cfg_music_url");  
      const { url } = await api("/api/upload", { method: "POST", body: form });  
      await api("/api/content/cfg_music_url", {  
        method: "PUT",  
        body: JSON.stringify({ type: "text", value: url }),  
      });  
      musicUrl = url;  
      musicStatus.textContent = `Guardada: ${file.name}`;  
      musicTestBtn.hidden = false;  
      showToast("Canción guardada.");  
    } catch (error) {  
      musicStatus.textContent = "Error al subir.";  
      showToast(error.message);  
    }  
    musicFileInput.value = "";  
  });  
}  
  
if (musicTestBtn) {  
  musicTestBtn.addEventListener("click", () => {  
    if (!musicUrl) return;  
    if (musicPreview && !musicPreview.paused) {  
      musicPreview.pause();  
      musicTestBtn.textContent = "▶ PROBAR CANCIÓN";  
      return;  
    }  
    if (!musicPreview) musicPreview = new Audio(musicUrl);  
    musicPreview.play();  
    musicTestBtn.textContent = "⏸ PAUSAR PRUEBA";  
  });  
}  
  
if (adminPanel) {  
  new MutationObserver(() => {  
    if (!adminPanel.hidden) refreshMusicStatus();  
  }).observe(adminPanel, { attributes: true, attributeFilter: ["hidden"] });  
}
// ===== TEMAS (edición de fondos) =====  
const bgPicker = document.querySelector("#bg-picker");  
let editingThemes = false;  
let activeBg = null;  
  
function isVideoUrl(url) {  
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);  
}  
  
function applyBg(el, value) {  
  const cur = el.dataset.bgValue;  
  if (cur && cur === value) return;  
  el.querySelectorAll("video.bg-video").forEach((v) => v.remove());  
  if (value.startsWith("color:")) {  
    el.style.backgroundImage = "none";  
    el.style.backgroundColor = value.slice(6);  
    el.dataset.bgValue = value;  
    return;  
  }  
  el.style.backgroundColor = "";    
  if (isVideoUrl(value)) {
  el.style.position = "relative";
  el.style.overflow = "hidden";
  el.style.backgroundImage = "none";
  const v = el.querySelector("video.bg-video");
  if (!v) {
    const newV = document.createElement("video");
    newV.className = "bg-video";
    newV.src = value;
    newV.autoplay = true;
    newV.muted = true;
    newV.loop = true;
    newV.playsInline = true;
    newV.setAttribute("muted", "");
    newV.setAttribute("playsinline", "");
    newV.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;";
    el.prepend(newV);
  }
  el.querySelectorAll(":scope > :not(video.bg-video)").forEach((child) => {
    child.style.position = child.style.position || "relative";
    child.style.zIndex = "1";
  });
} else {
  el.style.backgroundImage = `url(${value})`;
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";
  el.style.backgroundRepeat = "no-repeat";
  el.dataset.bgValue = value;
} 
  
function applySavedBackgrounds(content) {  
  document.querySelectorAll("[data-bg]").forEach((el) => {  
    const saved = content[`bg_${el.dataset.bg}`];  
    if (saved && saved.value) {  
      const cur = el.dataset.bgValue;  
      if (cur && cur === saved.value) return;  
      el.dataset.bgValue = saved.value;  
      applyBg(el, saved.value);  
    }  
  });  
}  
  
async function saveBg(sec, value) {  
  applyBg(sec, value);  
  await api(`/api/content/bg_${sec.dataset.bg}`, {  
    method: "PUT",  
    body: JSON.stringify({ type: "text", value }),  
  });  
  showToast("Fondo guardado.");  
}  
  
function openBgChooser(sec) {  
  document.querySelector("#bg-chooser")?.remove();  
  const box = document.createElement("div");  
  box.id = "bg-chooser";  
  box.innerHTML = `  
    <div class="bg-chooser-card">  
      <p>¿Qué fondo quieres para esta sección?</p>  
      <button type="button" data-act="file">Subir imagen o video</button>  
      <label class="bg-chooser-color">Elegir color  
        <input type="color" id="bg-color-input" value="#506443" />  
      </label>  
      <input type="text" id="bg-color-name" placeholder="o escribe el color (ej: crema, #f3ece0)" />  
      <button type="button" data-act="color">Aplicar color</button>  
      <button type="button" data-act="cancel">Cancelar</button>  
    </div>`;  
  document.body.appendChild(box);  
  box.addEventListener("click", async (e) => {  
    const act = e.target.dataset.act;  
    if (!act) return;  
    if (act === "file") { box.remove(); bgPicker.value = ""; bgPicker.click(); }  
    else if (act === "color") {  
      const name = document.querySelector("#bg-color-name").value.trim();  
      const picked = document.querySelector("#bg-color-input").value;  
      box.remove();  
      await saveBg(sec, `color:${name || picked}`);  
    }  
    else if (act === "cancel") box.remove();  
  });  
}  
  
function setThemesMode(enabled) {  
  editingThemes = enabled;  
  adminFloatBar.hidden = !enabled;  
  adminOpen.hidden = enabled;  
  document.body.classList.toggle("themes-active", enabled);  
  document.querySelectorAll("[data-bg]").forEach((el) => el.classList.toggle("bg-editable", enabled));  
  if (!enabled) document.querySelector("#bg-chooser")?.remove();  
  if (enabled) showToast("Toca una sección para cambiar su fondo.");  
}  
  
document.querySelector("#panel-themes").addEventListener("click", () => {  
  adminPanel.hidden = true;  
  setThemesMode(true);  
});  
  
document.addEventListener("click", (e) => {  
  if (!editingThemes) return;  
  if (e.target.closest("#bg-chooser")) return;  
  const sec = e.target.closest("[data-bg]");  
  if (!sec) return;  
  e.preventDefault();  
  e.stopPropagation();  
  activeBg = sec;  
  openBgChooser(sec);  
}, true);  
  
bgPicker.addEventListener("change", async () => {  
  const file = bgPicker.files?.[0];  
  if (!file || !activeBg) return;  
  showToast("Subiendo fondo…");  
  try {  
    const form = new FormData();  
    form.set("file", file);  
    form.set("key", `bg_${activeBg.dataset.bg}`);  
    const { url } = await api("/api/upload", { method: "POST", body: form });  
    await saveBg(activeBg, url);  
  } catch (error) {  
    showToast(error.message);  
  }  
});

document.querySelector("#panel-close-btn")?.addEventListener("click", () => {
  adminPanel.hidden = true;
});
