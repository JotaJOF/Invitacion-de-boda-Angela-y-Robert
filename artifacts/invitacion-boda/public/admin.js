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
  }  
}  
  
function recordBaseline(element) {  
  if (isMediaElement(element)) {  
    element.dataset.originalSrc = element.getAttribute("src") ?? "";  
  } else {  
    element.dataset.originalText = element.textContent ?? "";  
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
  document.querySelectorAll(".edit-pencil").forEach((button) => {  
    const element = document.querySelector(`[data-key="${CSS.escape(button.dataset.forKey)}"]`);  
    if (!element) return;  
    const bounds = element.getBoundingClientRect();  
    button.style.left = `${Math.max(4, Math.min(window.innerWidth - 38, bounds.right - 12))}px`;  
    button.style.top = `${Math.max(4, bounds.top - 12)}px`;  
    button.hidden = bounds.bottom < 0 || bounds.top > window.innerHeight;  
  });  
}  
  
function stopInlineEditing(element) {  
  element.contentEditable = "false";  
  element.classList.remove("is-editing");  
}  
  
function beginTextEdit(element) {  
  document.querySelectorAll('[data-key].is-editing').forEach(stopInlineEditing);  
  element.contentEditable = "true";  
  element.classList.add("is-editing");  
  element.focus();  
  const selection = window.getSelection();  
  if (selection) {  
    const range = document.createRange();  
    range.selectNodeContents(element);  
    selection.removeAllRanges();  
    selection.addRange(range);  
  }  
  toolbarMessage.textContent = `Editando: ${element.dataset.key}`;  
}  
  
function addPencils() {  
  document.querySelectorAll(".edit-pencil").forEach((button) => button.remove());  
  if (!editing) return;  
  
  contentNodes.forEach((element) => {  
    const button = document.createElement("button");  
    button.className = "edit-pencil";  
    button.type = "button";  
    button.dataset.forKey = element.dataset.key;  
    button.setAttribute("aria-label", `Editar ${element.dataset.key}`);  
    button.innerHTML = pencilMarkup();  
    button.addEventListener("click", () => {  
      if (isMediaElement(element)) {  
        activeImage = element;  
        imagePicker.value = "";  
        imagePicker.click();  
      } else {  
        beginTextEdit(element);  
      }  
    });  
    document.body.append(button);  
  });  
  positionPencils();  
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
    toolbarMessage.textContent = "Pulsa un lápiz para editar textos o imágenes.";  
  }  
}  
  
document.addEventListener("input", (event) => {  
  const target = event.target;  
  if (!(target instanceof HTMLElement) || !target.matches("[data-key].is-editing")) return;  
  pendingChanges.set(target.dataset.key, {  
    element: target,  
    type: "text",  
    value: target.textContent ?? "",  
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
        body: JSON.stringify({ type: change.type, value: change.value }),  
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
    }  
    stopInlineEditing(element);  
    pendingChanges.delete(key);  
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
  
window.addEventListener("scroll", positionPencils, { passive: true });  
window.addEventListener("resize", positionPencils);  
  
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
