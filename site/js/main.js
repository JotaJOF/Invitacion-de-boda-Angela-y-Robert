// Identificador de boda: la ruta /erick-erika (la raíz "/" es la demo "angela-robert")  
// También acepta ?boda= por compatibilidad  
const WEDDING_ID = (() => {  
  const param = new URLSearchParams(window.location.search).get("boda");  
  if (param && /^[a-z0-9-]+$/i.test(param)) return param.toLowerCase();  
  const path = window.location.pathname.replace(/\/+$/, "");  
  if (path && path !== "/" && !path.includes(".") && path.split("/").filter(Boolean).length === 1) {  
    return decodeURIComponent(path.slice(1)).toLowerCase();  
  }  
  return "angela-robert";  
})();  
// Clave de contenido: la boda por defecto usa la clave tal cual;  
// las demás bodas la prefijan con su id (ej. maria-juan_envelope_image)  
const k = (key) => (WEDDING_ID === "angela-robert" ? key : `${WEDDING_ID}_${key}`);  
  
const pendingChanges = new Map();  
const contentNodes = [...document.querySelectorAll("[data-key]")];
const loginDialog = document.querySelector("#login-dialog");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const adminOpen = document.querySelector("#admin-open");
const adminToolbar = document.querySelector("#admin-toolbar");
const toolbarMessage = document.querySelector("#toolbar-message");
const imagePicker = document.querySelector("#image-picker");
const toast = document.querySelector("#toast");
const countdown = document.querySelector("#countdown");  
// Configuración de la boda: se trae de Supabase (/api/wedding/<id>)  
let WEDDING_CFG = { date: countdown.dataset.targetDate, names: document.title };  
let countdownTarget = Date.parse(countdown.dataset.targetDate);  
  
async function loadWeddingConfig() {  
  try {  
    const { wedding } = await api(`/api/wedding/${encodeURIComponent(WEDDING_ID)}`, { method: "GET" });  
    if (wedding) {  
      WEDDING_CFG = { date: wedding.date_iso, names: wedding.names };  
      countdown.dataset.targetDate = WEDDING_CFG.date;  
      document.title = WEDDING_CFG.names;  
      countdownTarget = Date.parse(WEDDING_CFG.date);  
      updateCountdown();  
    }  
  } catch {  
    /* boda no existe en la tabla: se queda con los valores del HTML */  
  }  
}
const countdownFields = {
  days: document.querySelector("#countdown-days"),
  hours: document.querySelector("#countdown-hours"),
  minutes: document.querySelector("#countdown-minutes"),
  seconds: document.querySelector("#countdown-seconds"),
};

let authenticated = false;
let editing = false;
let activeImage = null;
let toastTimeout;

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

function cacheBustedImageUrl(value) {
  const url = new URL(value, window.location.href);
  url.searchParams.set("v", String(Date.now()));
  return url.href;
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
    element.style.visibility = "hidden";
    try {
      const nextSrc = cacheBustedImageUrl(value);
      const loadedSrc = await preloadImage(nextSrc);
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
  if (element instanceof HTMLImageElement) {
    element.dataset.originalSrc = element.getAttribute("src") ?? "";
  } else {
    element.dataset.originalText = element.textContent ?? "";
  }
}

async function loadContent() {
  try {
    const { content = {} } = await api("/api/content", { method: "GET" });
    let failedImages = false;
    const imageLoads = [];
    for (const element of contentNodes) {
      const key = element.dataset.key;
      const saved = key ? content[k(key)] : null;
      if (saved && saved.type === "image" && element instanceof HTMLImageElement) {
        imageLoads.push(
          setElementValue(element, saved.type, saved.value,
          ).catch(() => {
            failedImages = true;
            element.removeAttribute("src");
            element.style.visibility = "hidden";
          }),
        );
      } else if (saved && (saved.type === "text" || saved.type === "image")) {
        setElementValue(element, saved.type, saved.value);
      }
    }
    await Promise.all(imageLoads);
    for (const element of contentNodes) recordBaseline(element);
    if (failedImages) {
      showToast("No se pudo cargar una imagen; se ocultó para no mostrar una versión anterior.");
    }
  } catch {
    for (const element of contentNodes) {
      if (element instanceof HTMLImageElement) {
        element.removeAttribute("src");
        element.style.visibility = "hidden";
      }
    }
    showToast("No se pudo cargar el contenido guardado; se ocultaron las imágenes anteriores.");
  } finally {
    document.documentElement.classList.remove("is-loading-content");
  }
}

function updateCountdown() {
  const remaining = Math.max(0, countdownTarget - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  countdownFields.days.textContent = String(days);
  countdownFields.hours.textContent = String(hours).padStart(2, "0");
  countdownFields.minutes.textContent = String(minutes).padStart(2, "0");
  countdownFields.seconds.textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
window.setInterval(updateCountdown, 1000);

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
  pendingChanges.set(k(target.dataset.key), {
    element: target,
    type: "text",
    value: target.textContent ?? "",
  });
  toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`;
});

imagePicker.addEventListener("change", async () => {
  const file = imagePicker.files?.[0];
  if (!file || !activeImage) return;
  toolbarMessage.textContent = "Subiendo imagen…";
  try {
    const form = new FormData();
    form.set("file", file);
    const { url } = await api("/api/upload", { method: "POST", body: form });
    await setElementValue(activeImage, "image", url);
    pendingChanges.set(k(activeImage.dataset.key), {
      element: activeImage,
      type: "image",
      value: url,
    });
    toolbarMessage.textContent = `${pendingChanges.size} cambio${pendingChanges.size === 1 ? "" : "s"} sin guardar`;
  } catch (error) {
    showToast(error.message);
    toolbarMessage.textContent = "No se pudo subir la imagen.";
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
    const key = k(element.dataset.key);
    if (element instanceof HTMLImageElement) {
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

for (const element of contentNodes) recordBaseline(element);

if (WEDDING_ID === "angela-robert") {  
  // Raíz = previa FIJA: siempre muestra Angela & Robert (el HTML).  
  // No carga ni aplica contenido guardado, así nunca cambia.  
  document.documentElement.classList.remove("is-loading-content");  
} else {  
  loadWeddingConfig();  
  loadContent();  
}
api("/api/me", { method: "GET" })
  .then((session) => {
    authenticated = session.authenticated === true;
    if (authenticated) setEditingMode(true);
  })
  .catch(() => {
    authenticated = false;
  });
// ===== Invitado personalizado por ?c=CODIGO =====  
(async function loadInvite() {  
  const code = new URLSearchParams(window.location.search).get("c");  
  if (!code) return;  
  try {  
    const { guest } = await api(`/api/invite/${encodeURIComponent(code)}?boda=${encodeURIComponent(WEDDING_ID)}`, {  
      method: "GET",  
    });  
    if (!guest) return;  
    const greeting = document.querySelector("#guest-greeting");  
    const nameEl = document.querySelector("#guest-name");  
    const passesEl = document.querySelector("#guest-passes");  
    if (!greeting || !nameEl || !passesEl) return;  
    nameEl.textContent = guest.name;  
    passesEl.textContent =  
      guest.max_passes > 0 ? ` · Pases: ${guest.max_passes}` : "";  
    greeting.hidden = false;  
    document.title = `${guest.name} — ${WEDDING_CFG.names}`;  
  } catch {  
    /* sin invitado válido: la página sigue normal */  
  }  
})();
