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
let savingChanges = false;
const imageUploads = new Set();
const imageUploadVersions = new Map();
const previewObjectUrls = new Map();
const previewObjectUrlHistory = new Map();  
  
function updateImageUploadControls() {
  const locked = savingChanges || imageUploads.size > 0;
  document.querySelector("#save-content").disabled = locked;
  document.querySelector("#cancel-edit").disabled = locked;
  document.querySelectorAll(".edit-pencil").forEach((button) => {
    button.disabled = savingChanges;
  });
}

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

async function setElementValue(element, type, value, isCurrent = () => true) {
  if (type === "image" && element instanceof HTMLImageElement) {
    const nextSrc = new URL(value, window.location.href).href;
    const currentSrc = element.currentSrc || element.src;
    if (currentSrc === nextSrc) return;

    try {
      const loadedSrc = await preloadImage(nextSrc);
      if (!isCurrent()) return;
      element.src = loadedSrc;
    } catch (error) {
      // Keep the currently visible image if the replacement fails.
      if (isCurrent()) throw error;
    }
  } else if (type === "text" && isCurrent()) {
    element.textContent = value;
  }
}

function keepPreviewUrls(key, keep) {
  const urls = previewObjectUrlHistory.get(key);
  if (!urls) return;
  for (const url of urls) {
    if (!keep.has(url)) {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }
  }
  if (urls.size === 0) {
    previewObjectUrlHistory.delete(key);
    previewObjectUrls.delete(key);
  }
}

function recordBaseline(element) {
  if (element instanceof HTMLImageElement) {
    const key = element.dataset.key;
    const currentSrc = element.getAttribute("src") ?? "";
    element.dataset.originalSrc = currentSrc;
    if (currentSrc.startsWith("blob:")) {
      previewObjectUrls.set(key, currentSrc);
      keepPreviewUrls(key, new Set([currentSrc]));
    } else {
      previewObjectUrls.delete(key);
      keepPreviewUrls(key, new Set());
    }
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
      if (saved && saved.type === "image" && element instanceof HTMLImageElement) {
        imageLoads.push(
          setElementValue(element, saved.type, saved.value,
            () => loadVersion === contentLoadVersion,
          ).catch(() => {
            if (loadVersion === contentLoadVersion) failedImages = true;
          }),
        );
      } else if (saved && (saved.type === "text" || saved.type === "image")) {
        setElementValue(element, saved.type, saved.value, () => loadVersion === contentLoadVersion);
      }
    }
    await Promise.all(imageLoads);
    for (const element of contentNodes) recordBaseline(element);
    if (failedImages) {
      showToast("No se pudo cargar una imagen; se conserva la imagen anterior.");
    }
  } catch {
    if (loadVersion === contentLoadVersion) {
      showToast("No se pudo cargar el contenido guardado; se mantienen las imágenes disponibles.");
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
      if (element instanceof HTMLImageElement) {  
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
  if (savingChanges) {
    imagePicker.value = "";
    showToast("Espera a que termine el guardado antes de cambiar una imagen.");
    return;
  }
  const file = imagePicker.files?.[0];
  const element = activeImage;
  if (!file || !element) return;

  const key = element.dataset.key;
  const uploadVersion = (imageUploadVersions.get(key) ?? 0) + 1;
  imageUploadVersions.set(key, uploadVersion);
  const previousSrc = element.getAttribute("src") ?? "";
  const previousPending = pendingChanges.get(key);
  const previousPreviewUrl = previewObjectUrls.get(key) ??
    (previousSrc.startsWith("blob:") ? previousSrc : null);
  const previewUrl = URL.createObjectURL(file);

  imagePicker.value = "";
  element.src = previewUrl;
  const previewUrls = previewObjectUrlHistory.get(key) ?? new Set();
  previewUrls.add(previewUrl);
  previewObjectUrlHistory.set(key, previewUrls);
  previewObjectUrls.set(key, previewUrl);
  imageUploads.add(key);
  updateImageUploadControls();
  toolbarMessage.textContent = "Vista previa visible; subiendo imagen en segundo plano…";

  try {
    const form = new FormData();
    form.set("file", file);
    form.set("key", key);
    const { url } = await api("/api/upload", { method: "POST", body: form });
    if (imageUploadVersions.get(key) !== uploadVersion) return;

    pendingChanges.set(key, { element, type: "image", value: url, previewUrl });
  } catch (error) {
    if (imageUploadVersions.get(key) === uploadVersion) {
      if (previousSrc) element.setAttribute("src", previousSrc);
      else element.removeAttribute("src");
      if (previousPreviewUrl) previewObjectUrls.set(key, previousPreviewUrl);
      else previewObjectUrls.delete(key);
      if (previousPending) pendingChanges.set(key, previousPending);
      else pendingChanges.delete(key);
      keepPreviewUrls(key, previousPreviewUrl?.startsWith("blob:")
        ? new Set([previousPreviewUrl])
        : new Set());
      showToast(error.message + " Se conservó la imagen anterior.");
    }
  } finally {
    if (imageUploadVersions.get(key) === uploadVersion) {
      imageUploads.delete(key);
      updateImageUploadControls();
      toolbarMessage.textContent = imageUploads.size
        ? "Vista previa visible; queda otra imagen subiendo…"
        : pendingChanges.size + " cambio" + (pendingChanges.size === 1 ? "" : "s") + " sin guardar";
    }
  }
});
  
document.querySelector("#save-content").addEventListener("click", async () => {  
  if (imageUploads.size > 0 || savingChanges) {
    showToast("Espera a que termine la subida antes de guardar.");
    return;
  }
  if (pendingChanges.size === 0) {  
    showToast("No hay cambios pendientes.");  
    return;  
  }  
  const button = document.querySelector("#save-content");  
  savingChanges = true;
  updateImageUploadControls();
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
    savingChanges = false;
    updateImageUploadControls();  
  }  
});  
  
document.querySelector("#cancel-edit").addEventListener("click", async () => {  
  if (imageUploads.size > 0 || savingChanges) {
    showToast("Espera a que termine la subida antes de salir.");
    return;
  }
  if (pendingChanges.size && !window.confirm("¿Descartar los cambios que aún no guardaste?")) {  
    return;  
  }  
  pendingChanges.forEach(({ element }) => {  
    const key = element.dataset.key;  
    if (element instanceof HTMLImageElement) {  
      const originalSrc = element.dataset.originalSrc ?? "";
      const currentSrc = element.getAttribute("src") ?? "";
      if (originalSrc) element.setAttribute("src", originalSrc);
      else element.removeAttribute("src");
      if (originalSrc.startsWith("blob:")) previewObjectUrls.set(key, originalSrc);
      else previewObjectUrls.delete(key);
      keepPreviewUrls(key, originalSrc.startsWith("blob:")
        ? new Set([originalSrc])
        : new Set());  
    } else {  
      element.textContent = element.dataset.originalText ?? "";  
    }  
    stopInlineEditing(element);  
    pendingChanges.delete(key);  
  });  
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});  
  authenticated = false;  
  setEditingMode(false);  
  showToast("Sesión cerrada.");  
});  
  
adminOpen.addEventListener("click", async () => {  
  if (authenticated) {  
    setEditingMode(true);  
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
    setEditingMode(true);  
    showToast("Sesión iniciada. Pulsa los lápices para editar.");  
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
