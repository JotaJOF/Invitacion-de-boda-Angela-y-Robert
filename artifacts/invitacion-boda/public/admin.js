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
  const response = await fetch(path, {  
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
  
async function setElementValue(element, type, value, isCurrent = () => true) {  
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
        setElementValue(element, saved.type, saved.value, () => loadVersion === contentLoadVersion);  
      }  
      const styleSaved = key ? content[`${key}__style`] : null;  
      if (styleSaved && !isMediaElement(element)) {  
        try {  
          const style = JSON.parse(styleSaved.value);  
          if (style.fontFamily) element.style.fontFamily = style.fontFamily;  
          if (style.fontSize) element.style.fontSize = style.fontSize;  
          if (style.maxWidth) element.style.maxWidth = style.maxWidth;  
          if (style.width) element.style.width = style.width;  
          if (style.display === "inline-block") element.style.display = "inline-block";  
          if (style.whiteSpace) element.style.whiteSpace = style.whiteSpace;  
          if (style.transform) element.style.transform = style.transform;  
          if (style.marginLeft) element.style.marginLeft = style.marginLeft;  
          if (style.marginRight) element.style.marginRight = style.marginRight;  
          if (style.marginTop) element.style.marginTop = style.marginTop;  
          if (style.marginBottom) element.style.marginBottom = style.marginBottom;  
        } catch { /* estilo inválido, se ignora */ }  
      } 
    }  
    await Promise.all(imageLoads);  
    applySavedBackgrounds(content);  
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
  
function markStyleChange(element) {  
  pendingChanges.set(`${element.dataset.key}__style`, {  
    element,  
    type: "style",  
    value: JSON.stringify({  
      fontFamily: element.style.fontFamily || "",  
      fontSize: element.style.fontSize || "",  
      maxWidth: element.style.maxWidth || "",
      width: element.style.width || "",  
      display: element.style.display || "",  
      whiteSpace: element.style.whiteSpace || "",
      transform: element.style.transform || "",  
      marginLeft: element.style.marginLeft || "",  
      marginRight: element.style.marginRight || "",  
      marginTop: element.style.marginTop || "",  
      marginBottom: element.style.marginBottom || "",  
    }),  
  });  
  toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`; 
  document.querySelectorAll(`[data-key="${element.dataset.key}"]`).forEach((el) => {  
    if (el === element) return;  
    ["fontFamily", "fontSize", "maxWidth", "width", "display", "whiteSpace", "transform", "marginLeft", "marginRight", "marginTop", "marginBottom"].forEach((p) => {  
      el.style[p] = element.style[p];  
    });  
  });
}  
  
let resizeHandles = [];  
let resizeRaf = 0;  
  
function removeResizeHandles() {  
  resizeHandles.forEach((h) => h.remove());  
  resizeHandles = [];  
  if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }  
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
    const top = offY + r.top + r.height / 2 - 14;  
    h.style.top = `${top}px`;  
    h.style.left = h.dataset.side === "left"  
      ? `${offX + r.left - 18}px`  
      : `${offX + r.right + 4}px`;  
  });  
  resizeRaf = requestAnimationFrame(positionResizeHandles);  
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
      const rect = element.getBoundingClientRect();  
const startX = e.clientX;  
const startW = rect.width;  
const cs = getComputedStyle(element);  
const startML = parseFloat(cs.marginLeft) || 0;  
const startMR = parseFloat(cs.marginRight) || 0;  
const onMove = (ev) => {  
  const dx = ev.clientX - startX;  
  element.style.display = "inline-block";  
  element.style.whiteSpace = "normal";  
  if (side === "right") {  
    // fija el borde IZQUIERDO, solo crece a la derecha  
    element.style.marginLeft = `${startML}px`;  
    element.style.marginRight = "auto";  
    element.style.width = `${Math.max(60, startW + dx)}px`;  
  } else {  
    // fija el borde DERECHO, solo crece a la izquierda  
    element.style.marginRight = `${startMR}px`;  
    element.style.marginLeft = "auto";  
    element.style.width = `${Math.max(60, startW - dx)}px`;  
  }  
  positionResizeHandles();  
};  
      const onUp = () => {  
        window.removeEventListener("pointermove", onMove);  
        window.removeEventListener("pointerup", onUp);  
        markStyleChange(element);  
      };  
      window.addEventListener("pointermove", onMove);  
      window.addEventListener("pointerup", onUp);  
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
  styleBar.addEventListener("pointerdown", (e) => e.preventDefault());  
  
  const fontBtn = document.createElement("button");  
  fontBtn.type = "button";  
  fontBtn.className = "style-btn style-btn-font";  
  fontBtn.textContent = currentFontLabel(element);  
  
  fontBtn.addEventListener("click", () => {  
    styleBar.querySelectorAll(".style-menu").forEach((m) => m.remove());  
    const menu = document.createElement("div");  
    menu.className = "style-menu";  
    FONTS.forEach((f) => {  
      const opt = document.createElement("button");  
      opt.type = "button";  
      opt.className = "style-menu-item";  
      opt.textContent = f.label;  
      opt.style.fontFamily = f.value;  
      opt.addEventListener("click", () => {  
        element.style.fontFamily = f.value;  
        fontBtn.textContent = f.label;  
        markStyleChange(element);  
        menu.remove();  
      });  
      menu.append(opt);  
    });  
    styleBar.append(menu);  
  });  
  
  const sizeWrap = document.createElement("div");  
  sizeWrap.className = "style-size";  
  
  const sizeDown = document.createElement("button");  
  sizeDown.type = "button";  
  sizeDown.className = "style-btn style-btn-mini";  
  sizeDown.textContent = "−";  
  
  const sizeNum = document.createElement("span");  
  sizeNum.className = "style-size-num";  
  sizeNum.textContent = `${Math.round(parseFloat(getComputedStyle(element).fontSize)) || 0}`;  
  
  const sizeUp = document.createElement("button");  
  sizeUp.type = "button";  
  sizeUp.className = "style-btn style-btn-mini";  
  sizeUp.textContent = "+";  
  
  const bumpSize = (delta) => {  
    const actual = Math.round(parseFloat(getComputedStyle(element).fontSize)) || 0;  
    const next = Math.max(6, actual + delta);  
    element.style.fontSize = `${next}px`;  
    sizeNum.textContent = `${next}`;  
    markStyleChange(element);  
  };  
  sizeDown.addEventListener("click", () => bumpSize(-1));  
  sizeUp.addEventListener("click", () => bumpSize(1));  
  
  sizeWrap.append(sizeDown, sizeNum, sizeUp);  
  
  const moveWrap = document.createElement("div");  
  moveWrap.className = "style-move";  
  
  if (!element.dataset.baseTransform) {  
    element.dataset.baseTransform = element.style.transform || "";  
  }  
  
  const mkArrow = (txt, dx, dy) => {  
    const b = document.createElement("button");  
    b.type = "button";  
    b.className = "style-btn style-btn-mini";  
    b.textContent = txt;  
    b.addEventListener("click", () => {  
      const x = (parseFloat(element.dataset.shiftX || "0") || 0) + dx;  
      const y = (parseFloat(element.dataset.shiftY || "0") || 0) + dy;  
      element.dataset.shiftX = String(x);  
      element.dataset.shiftY = String(y);  
      element.style.transform = `${element.dataset.baseTransform} translate(${x}px, ${y}px)`;  
      markStyleChange(element);  
    });  
    return b;  
  };  
  moveWrap.append(  
  mkArrow("◀", -5, 0),  
  mkArrow("▲", 0, -5),  
  mkArrow("▼", 0, 5),  
  mkArrow("▶", 5, 0),  
);  
  
  styleBar.append(fontBtn, sizeWrap, moveWrap);  
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
function beginTextEdit(element) {  
  document.querySelectorAll('[data-key].is-editing').forEach(stopInlineEditing);  
  element.contentEditable = "true";  
  element.classList.add("is-editing");  
  element.focus();  
  toolbarMessage.textContent = `Editando: ${element.dataset.key}`;  
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
  // No bloquear la barra de estilo, los tiradores de tamaño ni el panel admin:  
  if (!e.target.closest("#root")) return;  
  const keyEl = e.target.closest("[data-key]");  
  const btn = e.target.closest("button, a");  
  // FAQ: dejar que se despliegue  
  if (btn && (btn.classList.contains("faq-question") || btn.querySelector('[data-key^="faq_question"]'))) return;  
  if (!keyEl) {  
    if (btn) { e.preventDefault(); e.stopPropagation(); }  
    return;  
  }  
  if (btn) { e.preventDefault(); e.stopPropagation(); }  
  if (keyEl.classList.contains("is-editing")) return;  
  if (isMediaElement(keyEl)) {  
    activeImage = keyEl;  
    imagePicker.value = "";  
    imagePicker.click();  
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
    await setElementValue(activeImage, "image", url);  
    pendingChanges.set(activeImage.dataset.key, {  
      element: activeImage,  
      type: "image",  
      value: url,  
    });  
    toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`;  
  } catch (error) {  
    showToast(error.message);  
    toolbarMessage.textContent = "No se pudo subir el archivo.";  
  }  
});  
  
document.querySelector("#save-content").addEventListener("click", async () => {  
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
  
let currentSession = null;
let currentWedding = "angela-robert";

api("/api/me", { method: "GET" })  
  .then((session) => {  
    authenticated = session.authenticated === true;  
    currentSession = session.authenticated ? session : null;
    if (currentSession && currentSession.wedding_id) {
      currentWedding = currentSession.wedding_id;
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

async function renderSuperadminControls() {
  const saBox = document.querySelector("#superadmin-box");
  if (!saBox) return;

  if (!currentSession || currentSession.role !== "superadmin") {
    saBox.style.display = "none";
    saBox.innerHTML = "";
    return;
  }

  try {
    const { weddings = [] } = await api("/api/weddings");
    let optionsHtml = weddings.map(w => `<option value="${w.id}" ${w.id === currentWedding ? "selected" : ""}>${w.names} (${w.id})</option>`).join("");
    if (!weddings.some(w => w.id === "angela-robert")) {
      optionsHtml = `<option value="angela-robert" ${currentWedding === "angela-robert" ? "selected" : ""}>Angela Palmerston y Robert Wilson (angela-robert)</option>` + optionsHtml;
    }

    saBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:11px; font-weight:700; color:#5c5040; text-transform:uppercase; letter-spacing:0.08em;">Control Maestro Superadmin</span>
        <span style="font-size:10px; background:#4a5438; color:#fff; padding:2px 8px; border-radius:10px; font-weight:600;">Acceso Total</span>
      </div>
      <label style="font-size:12px; margin-bottom:4px; display:block; font-weight:600;">Boda activa en edición:</label>
      <select id="sa-wedding-select" style="width:100%; min-height:40px; padding:8px 12px; border-radius:10px; border:1px solid #d4cbbd; background:#fff; font-size:13px; margin-bottom:12px; color:#2b241c;">
        ${optionsHtml}
      </select>
      <div style="display:flex; gap:8px;">
        <button id="sa-new-wedding-btn" type="button" class="button button-secondary" style="padding:8px 14px; font-size:11px; flex:1; min-height:36px; border-radius:8px;">+ NUEVA BODA / PAREJA</button>
      </div>
      <div id="sa-create-form" style="display:none; margin-top:14px; padding-top:14px; border-top:1px dashed #dcd3c5;">
        <p style="font-size:12px; font-weight:700; color:#3a3228; margin-bottom:10px;">Crear enlace y credenciales para nueva pareja:</p>
        <input id="new-w-slug" type="text" placeholder="Slug / Terminación de URL (ej. carlos-maria)" style="width:100%; margin-bottom:8px;" />
        <input id="new-w-names" type="text" placeholder="Nombres (ej. Carlos y María)" style="width:100%; margin-bottom:8px;" />
        <input id="new-w-user" type="text" placeholder="Usuario para la pareja" style="width:100%; margin-bottom:8px;" />
        <input id="new-w-pass" type="password" placeholder="Contraseña para la pareja" style="width:100%; margin-bottom:10px;" />
        <p style="font-size:11px; color:#6b5f51; margin-bottom:8px; font-weight:600;">Permisos autorizados a la pareja:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px; margin-bottom:12px;">
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-loc" checked /> Ubicación</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-ws" checked /> WhatsApp</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-date" checked /> Fecha</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-drive" checked /> Google Drive</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-music" checked /> Música</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-guests" checked /> Invitados</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-invites" checked /> Links</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-edit" checked /> Editar</label>
          <label style="font-weight:normal; display:flex; align-items:center; gap:5px;"><input type="checkbox" id="perm-themes" checked /> Temas</label>
        </div>
        <button id="sa-save-client-btn" type="button" class="button button-primary button-olive" style="width:100%; font-size:11px; min-height:40px; border-radius:8px;">CREAR BODA Y USUARIO</button>
      </div>
    `;

    saBox.style.display = "block";

    document.querySelector("#sa-wedding-select")?.addEventListener("change", (e) => {
      currentWedding = e.target.value;
      loadPanel();
      applyPermissionsAndNav();
      showToast(`Administrando: ${currentWedding}`);
    });

    document.querySelector("#sa-new-wedding-btn")?.addEventListener("click", () => {
      const form = document.querySelector("#sa-create-form");
      if (form) form.style.display = form.style.display === "none" ? "block" : "none";
    });

    document.querySelector("#sa-save-client-btn")?.addEventListener("click", async () => {
      const slug = document.querySelector("#new-w-slug").value.trim().toLowerCase();
      const names = document.querySelector("#new-w-names").value.trim();
      const cUser = document.querySelector("#new-w-user").value.trim();
      const cPass = document.querySelector("#new-w-pass").value;

      if (!slug || !names) {
        alert("El slug y nombres son obligatorios.");
        return;
      }

      const permissions = {
        location: document.querySelector("#perm-loc").checked,
        whatsapp: document.querySelector("#perm-ws").checked,
        date: document.querySelector("#perm-date").checked,
        drive: document.querySelector("#perm-drive").checked,
        music: document.querySelector("#perm-music").checked,
        guests: document.querySelector("#perm-guests").checked,
        invites: document.querySelector("#perm-invites").checked,
        edit: document.querySelector("#perm-edit").checked,
        themes: document.querySelector("#perm-themes").checked,
      };

      try {
        await api("/api/weddings", {
          method: "POST",
          body: JSON.stringify({
            id: slug,
            names,
            couple_username: cUser || null,
            couple_password: cPass || null,
            permissions
          })
        });
        showToast(`Cliente ${names} creado.`);
        currentWedding = slug;
        renderSuperadminControls();
        loadPanel();
        applyPermissionsAndNav();
      } catch (err) {
        alert(err.message);
      }
    });
  } catch (err) {
    console.error("Error loading weddings for superadmin:", err);
    saBox.style.display = "none";
  }
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
  adminPanel.hidden = true;  
  adminFloatBar.hidden = false;  
  setEditingMode(true);  
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
  
document.querySelector("#guests-list").addEventListener("click", async () => {  
  guestsModal.hidden = false;  
  guestsBody.innerHTML = "<tr><td colspan='8'>Cargando…</td></tr>";  
  try {  
    const { guests = [] } = await api("/api/guests", { method: "GET" });  
let yes = 0, no = 0, pases = 0;  
guestsBody.innerHTML = guests.map((r, i) => {  
  if (r.attendance === 'yes') { yes++; pases += r.passes || 0; }  
  else if (r.attendance === 'no') no++;  
  const fecha = new Date(r.created_at).toLocaleString("es-MX");  
  const mod = r.modified ? `Sí · ${new Date(r.modified_at).toLocaleString("es-MX")}` : "No";  
  const conf = r.attendance === 'yes' ? "CONFIRMADO" : r.attendance === 'no' ? "NO ASISTE" : "PENDIENTE";  
  const via = r.source === "whatsapp" ? `WhatsApp ${r.phone || ""}` : "Formulario";  
  return `<tr><td>${i + 1}</td><td>${r.name}</td><td>${conf}</td><td>${r.passes || "—"}</td><td>${r.message || ""}</td><td>${fecha}</td><td>${mod}</td><td>${via}</td></tr>`;  
}).join("") || "<tr><td colspan='8'>Sin confirmaciones todavía.</td></tr>";  
    guestsTotals.innerHTML = `<div><strong>${yes}</strong> CONFIRMADOS</div><div><strong>${no}</strong> NO PODRÁN ASISTIR</div><div><strong>${pases}</strong> PASES CONFIRMADOS</div>`;  
  } catch (e) { guestsBody.innerHTML = `<tr><td colspan='8'>${e.message}</td></tr>`; }  
});  
  
document.querySelector("#guests-close").addEventListener("click", () => { guestsModal.hidden = true; });  
document.querySelector("#guests-print").addEventListener("click", () => window.print());
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
    const link = `${location.origin}/?c=${g.code}`;  
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
      `${location.origin}/?c=${g.code}`,  
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
  el.querySelectorAll("video.bg-video").forEach((v) => v.remove());  
  if (value.startsWith("color:")) {  
    el.style.backgroundImage = "none";  
    el.style.backgroundColor = value.slice(6);  
    return;  
  }  
  el.style.backgroundColor = "";  
  if (isVideoUrl(value)) {  
    el.style.position = "relative";  
    el.style.overflow = "hidden";  
    el.style.backgroundImage = "none";  
    const v = document.createElement("video");  
    v.className = "bg-video";  
    v.src = value;  
    v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;  
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");  
    v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;";  
    el.prepend(v);  
    el.querySelectorAll(":scope > :not(video.bg-video)").forEach((child) => {  
      child.style.position = child.style.position || "relative";  
      child.style.zIndex = "1";  
    });  
  } else {  
    el.style.backgroundImage = `url(${value})`;  
    el.style.backgroundSize = "cover";  
    el.style.backgroundPosition = "center";  
    el.style.backgroundRepeat = "no-repeat";  
  }  
}  
  
function applySavedBackgrounds(content) {  
  document.querySelectorAll("[data-bg]").forEach((el) => {  
    const saved = content[`bg_${el.dataset.bg}`];  
    if (saved && saved.value) applyBg(el, saved.value);  
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
