const table = document.querySelector("#guest-table");  
const input = document.querySelector("#guest-input");  
const message = document.querySelector("#panel-message");  
const BASE = window.location.origin;  
  
async function api(path, options = {}) {  
  const res = await fetch(path, {  
    credentials: "same-origin",  
    ...options,  
    headers: { "content-type": "application/json", ...options.headers },  
  });  
  const data = await res.json().catch(() => ({}));  
  if (!res.ok) throw new Error(data.error || "Error");  
  return data;  
}  
  
function esc(text) {  
  return String(text ?? "").replace(/[&<>"]/g, (c) =>  
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],  
  );  
}  
  
async function load() {  
  table.innerHTML = "";  
  const { guests } = await api("/api/guests", { method: "GET" });  
  for (const g of guests) {  
    const link = g.code ? `${BASE}/?c=${g.code}` : "—";  
    const wa = g.phone  
      ? `https://wa.me/${g.phone}?text=${encodeURIComponent(  
          `Hola, aquí está tu invitación a nuestra boda: ${link}`,  
        )}`  
      : "";  
    table.insertAdjacentHTML(  
      "beforeend",  
      `<tr>  
        <td>${esc(g.name)}</td>  
        <td>${g.max_passes ?? 0}</td>  
        <td>${  
          g.code  
            ? `<button type="button" data-link="${link}">Copiar</button>`  
            : ""  
        }</td>  
        <td>${g.opened_at ? "✔" : ""}</td>  
        <td>${esc(g.attendance || "")}</td>  
        <td>${wa ? `<a class="wa" href="${wa}" target="_blank">Enviar</a>` : ""}</td>  
      </tr>`,  
    );  
  }  
}  
  
table.addEventListener("click", (event) => {  
  const btn = event.target.closest("button[data-link]");  
  if (!btn) return;  
  navigator.clipboard.writeText(btn.dataset.link);  
  btn.textContent = "Copiado";  
});  
  
document.querySelector("#add-guests").addEventListener("click", async () => {  
  const guests = input.value  
    .split("\n")  
    .map((line) => {  
      const [name, passes, phone] = line.split(",").map((s) => s.trim());  
      return name  
        ? { name, max_passes: Number(passes) || 0, phone: phone || "" }  
        : null;  
    })  
    .filter(Boolean);  
  try {  
    const { created } = await api("/api/invites", {  
      method: "POST",  
      body: JSON.stringify({ guests }),  
    });  
    input.value = "";  
    message.textContent = `${created?.length ?? 0} invitados agregados.`;  
    await load();  
  } catch (e) {  
    message.textContent = e.message;  
  }  
});  
  
document.querySelector("#reload").addEventListener("click", load);  
  
load().catch(() => {  
  message.textContent =  
    "Inicia sesión primero: ve a la página principal, pulsa ADMINISTRAR SITIO y entra.";  
});
