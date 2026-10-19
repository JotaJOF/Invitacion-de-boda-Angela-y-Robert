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
          if (style.transform) element.style.transform = style.transform;  
          if (style.marginLeft) element.style.marginLeft = style.marginLeft;  
          if (style.marginRight) element.style.marginRight = style.marginRight;  
          if (style.marginTop) element.style.marginTop = style.marginTop;  
          if (style.marginBottom) element.style.marginBottom = style.marginBottom;  
        } catch { /* estilo inválido, se ignora */ }  
      } 
    }  
    await Promise.all(imageLoads);  
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
      transform: element.style.transform || "",  
      marginLeft: element.style.marginLeft || "",  
      marginRight: element.style.marginRight || "",  
      marginTop: element.style.marginTop || "",  
      marginBottom: element.style.marginBottom || "",  
    }),  
  });  
  toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`;  
}  
  
function showStyleBar(element) {  
  hideStyleBar();  
  styleBarFor = element;  
  styleBar = document.createElement("div");  
  styleBar.className = "style-bar";  
  
  // --- Botón de fuente ---  
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
  
  // --- Tamaño: flechitas − numero + (sin ventana emergente) ---  
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
  
  // --- Flechas para mover el elemento: ◀ ▲ ▼ ▶ (10px por toque) ---  
  const moveWrap = document.createElement("div");  
  moveWrap.className = "style-move";  
  
  const mkArrow = (txt, side) => {  
    const b = document.createElement("button");  
    b.type = "button";  
    b.className = "style-btn style-btn-mini";  
    b.textContent = txt;  
    b.addEventListener("click", () => {  
      const prop = { left: "marginLeft", right: "marginRight", up: "marginTop", down: "marginBottom" }[side];  
      const cur = parseFloat(element.style[prop] || "0") || 0;  
      const next = cur - 10; // margen negativo = estira ese borde hacia afuera  
      element.style[prop] = `${next}px`;  
      markStyleChange(element);  
    });  
    return b;  
  };  
  moveWrap.append(  
    mkArrow("◀", "left"),  
    mkArrow("▲", "up"),  
    mkArrow("▼", "down"),  
    mkArrow("▶", "right"),  
  );  
  
  styleBar.append(fontBtn, sizeWrap, moveWrap);  
  document.body.append(styleBar);  
  positionStyleBar();  
}
  
function positionStyleBar() {  
  if (!styleBar || !styleBarFor) return;  
  styleBar.style.left = "8px";  
  styleBar.style.right = "auto";  
  styleBar.style.top = "50%";  
  styleBar.style.transform = "translateY(-50%)";  
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
    element.addEventListener("click", () => {  
      if (!editing) return;  
      if (element.classList.contains("is-editing")) return; // ya editando: deja mover el cursor  
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
  
function setEditingMode(enabled) {  
  editing = enabled;  
  adminToolbar.hidden = !enabled;  
  adminOpen.hidden = enabled;  
  contentNodes.forEach((element) => {  
    element.classList.toggle("editable-target", enabled);  
    if (!enabled) stopInlineEditing(element);  
  });  
  addPencils();  
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
    await api("/api/login", {  
      method: "POST",  
      body: JSON.stringify({  
        username: form.get("username"),  
        password: form.get("password"),  
      }),  
    });  
    authenticated = true;  
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
  
// Los lápices ya no existen; no hace falta reposicionar en scroll.  
  
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
  
api("/api/me", { method: "GET" })  
  .then((session) => {  
    authenticated = session.authenticated === true;  
  })  
  .catch(() => {  
    authenticated = false;  
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
    const { content = {} } = await api("/api/content", { method: "GET" });  
    for (const [key, sel] of Object.entries(PANEL_KEYS)) {  
      const input = document.querySelector(sel);  
      if (input && content[key]) input.value = content[key].value;  
    }  
  } catch { /* sin datos previos */ }  
}  
  
function showAdminPanel() {  
  adminPanel.hidden = false;  
  adminFloatBar.hidden = true;  
  adminToolbar.hidden = true;  
  loadPanel();  
}  
  
document.querySelector("#panel-save").addEventListener("click", async () => {  
  panelMessage.textContent = "";  
  try {  
    for (const [key, sel] of Object.entries(PANEL_KEYS)) {  
      const value = document.querySelector(sel).value.trim();  
      if (!value) continue;  
      await api(`/api/content/${key}`, {  
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
    if (musicStatus) musicStatus.textContent = musicUrl ? "Canción cargada ✔" : "Sin canción";  
    if (musicTestBtn) musicTestBtn.hidden = !musicUrl;  
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
