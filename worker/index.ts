import { createClient, type SupabaseClient } from "@supabase/supabase-js";  
  
interface Env {  
  SUPABASE_URL: string;  
  SUPABASE_SERVICE_ROLE_KEY: string;  
  ASSETS: { fetch(request: Request): Promise<Response> };  
}  
  
interface ContentRow {  
  key: string;  
  type: "text" | "image";  
  value: string;  
}  
  
interface SessionPayload {  
  username: string;  
  expiresAt: number;  
}  
  
const COOKIE_NAME = "__Host-admin_session";  
const SESSION_SECONDS = 60 * 60 * 12;  
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;  
const MIME_EXTENSIONS: Record<string, string> = {  
  "image/avif": "avif",  
  "image/gif": "gif",  
  "image/jpeg": "jpg",  
  "image/png": "png",  
  "image/webp": "webp",  
  "video/mp4": "mp4",  
  "video/webm": "webm",  
  "video/quicktime": "mov",  
};  
  
function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {  
  return new Response(JSON.stringify(data), {  
    status,  
    headers: {  
      "content-type": "application/json; charset=utf-8",  
      "cache-control": "no-store",  
      "x-content-type-options": "nosniff",  
      ...headers,  
    },  
  });  
}  
  
function supabase(env: Env): SupabaseClient {  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {  
    throw new Error("Supabase is not configured.");  
  }  
  
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {  
    auth: {  
      autoRefreshToken: false,  
      detectSessionInUrl: false,  
      persistSession: false,  
    },  
  });  
}  
  
function encodeBase64Url(bytes: Uint8Array): string {  
  let binary = "";  
  for (const byte of bytes) binary += String.fromCharCode(byte);  
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");  
}  
  
function decodeBase64Url(value: string): Uint8Array {  
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");  
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));  
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));  
}  
  
function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {  
  const copy = new Uint8Array(bytes.byteLength);  
  copy.set(bytes);  
  return copy.buffer;  
}  
  
async function signingKey(env: Env): Promise<CryptoKey> {  
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {  
    throw new Error("Supabase is not configured.");  
  }  
  
  return crypto.subtle.importKey(  
    "raw",  
    new TextEncoder().encode(env.SUPABASE_SERVICE_ROLE_KEY),  
    { name: "HMAC", hash: "SHA-256" },  
    false,  
    ["sign", "verify"],  
  );  
}  
  
async function createSession(username: string, env: Env): Promise<string> {  
  const payload: SessionPayload = {  
    username,  
    expiresAt: Date.now() + SESSION_SECONDS * 1000,  
  };  
  const encodedPayload = encodeBase64Url(  
    new TextEncoder().encode(JSON.stringify(payload)),  
  );  
  const signature = await crypto.subtle.sign(  
    "HMAC",  
    await signingKey(env),  
    new TextEncoder().encode(encodedPayload),  
  );  
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;  
}  
  
async function getSession(request: Request, env: Env): Promise<SessionPayload | null> {  
  const cookie = request.headers.get("cookie");  
  const token = cookie  
    ?.split(";")  
    .map((part) => part.trim())  
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))  
    ?.slice(COOKIE_NAME.length + 1);  
  if (!token) return null;  
  
  const [encodedPayload, encodedSignature, extra] = token.split(".");  
  if (!encodedPayload || !encodedSignature || extra !== undefined) return null;  
  
  try {  
    const valid = await crypto.subtle.verify(  
      "HMAC",  
      await signingKey(env),  
      copyToArrayBuffer(decodeBase64Url(encodedSignature)),  
      new TextEncoder().encode(encodedPayload),  
    );  
    if (!valid) return null;  
  
    const payload = JSON.parse(  
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),  
    ) as SessionPayload;  
    if (  
      typeof payload.username !== "string" ||  
      typeof payload.expiresAt !== "number" ||  
      payload.expiresAt <= Date.now()  
    ) {  
      return null;  
    }  
    return payload;  
  } catch {  
    return null;  
  }  
}  
  
function cookieHeader(token: string): string {  
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;  
}  
  
function clearCookieHeader(): string {  
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;  
}  
  
function originIsAllowed(request: Request): boolean {  
  const origin = request.headers.get("origin");  
  return !origin || origin === new URL(request.url).origin;  
}  
  
function validContentKey(key: string): boolean {  
  return key.length <= 120 && /^[a-z0-9][a-z0-9_-]*$/iu.test(key);  
}  
  
function parseContent(value: unknown): ContentRow | null {  
  if (!value || typeof value !== "object") return null;  
  const row = value as Record<string, unknown>;  
  if (  
    typeof row.key !== "string" ||  
    !validContentKey(row.key) ||  
    (row.type !== "text" && row.type !== "image") ||  
    typeof row.value !== "string" ||  
    row.value.length > 30_000  
  ) {  
    return null;  
  }  
  return { key: row.key, type: row.type, value: row.value };  
}  
  
function validImageUrl(value: string, request: Request): boolean {  
  try {  
    const url = new URL(value, request.url);  
    return (  
      (url.protocol === "https:" || url.origin === new URL(request.url).origin) &&  
      !url.username &&  
      !url.password  
    );  
  } catch {  
    return false;  
  }  
}  
  
async function saveContent(  
  client: SupabaseClient,  
  row: ContentRow,  
): Promise<boolean> {  
  const { error } = await client.from("site_content").upsert(  
    { ...row, updated_at: new Date().toISOString() },  
    { onConflict: "key" },  
  );  
  return !error;  
}  
  
async function handleApi(request: Request, env: Env): Promise<Response> {  
  const url = new URL(request.url);  
  const path = url.pathname;  
  const method = request.method.toUpperCase();  
  
  if ((method === "POST" || method === "PUT") && !originIsAllowed(request)) {  
    return json({ error: "Origen no permitido." }, 403);  
  }  
  
  try {  
    if (path === "/api/login" && method === "POST") {  
      const body = (await request.json()) as Record<string, unknown>;  
      const username =  
        typeof body.username === "string" ? body.username.trim() : "";  
      const password = typeof body.password === "string" ? body.password : "";  
      if (!username || !password || username.length > 120 || password.length > 256) {  
        return json({ error: "Usuario o contraseña incorrectos." }, 401);  
      }  
  
      const { data: passwordMatches, error } = await supabase(env).rpc(  
        "verify_admin_login",  
        { p_username: username, p_password: password },  
      );  
      if (error || passwordMatches !== true) {  
        return json({ error: "Usuario o contraseña incorrectos." }, 401);  
      }  
  
      const token = await createSession(username, env);  
      return json(  
        { authenticated: true, username },  
        200,  
        { "set-cookie": cookieHeader(token) },  
      );  
    }  
  
    if (path === "/api/logout" && method === "POST") {  
      return json(  
        { authenticated: false },  
        200,  
        { "set-cookie": clearCookieHeader() },  
      );  
    }  
  
    if (path === "/api/me" && method === "GET") {  
      const session = await getSession(request, env);  
      return json(  
        session  
          ? { authenticated: true, username: session.username }  
          : { authenticated: false },  
      );  
    }  
  
    if (path === "/api/content" && method === "GET") {  
      const { data, error } = await supabase(env)  
        .from("site_content")  
        .select("key,type,value")  
        .order("key");  
      if (error) return json({ error: "No se pudo cargar el contenido." }, 502);  
  
      const content = Object.fromEntries(  
        (data as ContentRow[]).map(({ key, type, value }) => [  
          key,  
          { type, value },  
        ]),  
      );  
      return json({ content });  
    }  
  
    // ===== Lista de invitados (solo admin) =====  
    if (path === "/api/guests" && method === "GET") {  
      const session = await getSession(request, env);  
      if (!session) return json({ error: "Inicia sesión." }, 401);  
  
      const { data, error } = await supabase(env)  
        .from("guests")  
        .select("id,name,phone,attendance,passes,message,source,created_at,modified,modified_at")  
        .order("created_at");  
      if (error) return json({ error: "No se pudo cargar la lista." }, 502);  
      return json({ guests: data });  
    }  
  
    // ===== Confirmación de invitado (público) =====  
    if (path === "/api/guests" && method === "POST") {  
      const body = (await request.json()) as Record<string, unknown>;  
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";  
      if (!name) return json({ error: "El nombre es obligatorio." }, 400);  
      const attendance =  
        body.attendance === "yes" || body.attendance === "no"  
          ? body.attendance  
          : "";  
      const passes = Math.max(0, Math.min(20, Number(body.passes) || 0));  
      const message =  
        typeof body.message === "string" ? body.message.slice(0, 1000) : "";  
      const phone =  
        typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";  
      const source = body.source === "whatsapp" ? "whatsapp" : "form";  
  
      const client = supabase(env);  
      const { data: existing } = await client  
        .from("guests")  
        .select("id")  
        .eq("name", name)  
        .maybeSingle();  
  
      const row = existing  
        ? {  
            attendance,  
            passes,  
            message,  
            phone,  
            source,  
            modified: true,  
            modified_at: new Date().toISOString(),  
          }  
        : { name, attendance, passes, message, phone, source };  
  
      const { error } = existing  
        ? await client.from("guests").update(row).eq("id", existing.id)  
        : await client.from("guests").insert(row);  
      if (error) return json({ error: "No se pudo guardar la confirmación." }, 502);  
      return json({ saved: true, modified: !!existing });  
    }  
  
    // ===== Consultar si un nombre ya confirmó (público) =====  
    if (path.startsWith("/api/guests/check/") && method === "GET") {  
      const name = decodeURIComponent(  
        path.slice("/api/guests/check/".length),  
      ).slice(0, 200);  
      const { data } = await supabase(env)  
        .from("guests")  
        .select("name,attendance,passes,message,phone")  
        .eq("name", name)  
        .maybeSingle();  
      return json({ guest: data ?? null });  
    }  
  
    // ===== Editar invitado manualmente (solo admin) =====  
    if (/^\/api\/guests\/[0-9a-f-]{36}$/iu.test(path) && method === "PUT") {  
      const session = await getSession(request, env);  
      if (!session) return json({ error: "Inicia sesión." }, 401);  
  
      const id = path.slice("/api/guests/".length);  
      const body = (await request.json()) as Record<string, unknown>;  
      const attendance =  
        body.attendance === "yes" || body.attendance === "no"  
          ? body.attendance  
          : "";  
      const passes = Math.max(0, Math.min(20, Number(body.passes) || 0));  
      const name =  
        typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";  
      const phone =  
        typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";  
      const message =  
        typeof body.message === "string" ? body.message.slice(0, 1000) : "";  
  
      const { error } = await supabase(env)  
        .from("guests")  
        .update({ attendance, passes, name, phone, message })  
        .eq("id", id);  
      if (error) return json({ error: "No se pudo actualizar." }, 502);  
      return json({ saved: true });  
    }  
  
    if (  
      (path === "/api/content" && method === "POST") ||  
      (/^\/api\/content\/[^/]+$/u.test(path) && method === "PUT") ||  
      (path === "/api/upload" && method === "POST")  
    ) {  
      const session = await getSession(request, env);  
      if (!session) return json({ error: "Inicia sesión como administrador." }, 401);  
      const client = supabase(env);  
  
      if (path === "/api/upload") {  
        const contentLength = Number(request.headers.get("content-length") ?? 0);  
        if (contentLength > MAX_IMAGE_BYTES + 128 * 1024) {  
          return json({ error: "La imagen supera el límite de 50 MB." }, 413);  
        }  
  
        const form = await request.formData();  
        const file = form.get("file");  
        if (!(file instanceof File) || file.size === 0) {  
          return json({ error: "Selecciona una imagen." }, 400);  
        }  
        if (file.size > MAX_IMAGE_BYTES) {  
          return json({ error: "La imagen supera el límite de 50 MB." }, 413);  
        }  
        const extension = MIME_EXTENSIONS[file.type];  
        if (!extension) {  
          return json(  
            { error: "Usa una imagen JPG, PNG, WebP, GIF o AVIF." },  
            415,  
          );  
        }  
  
        const path = `media/${crypto.randomUUID()}.${extension}`;  
        const { error } = await client.storage.from("media").upload(  
          path,  
          new Blob([await file.arrayBuffer()], { type: file.type }),  
          {  
            cacheControl: "60",  
            contentType: file.type,  
            upsert: false,  
          },  
        );  
        if (error) return json({ error: `No se pudo subir el archivo: ${error.message}` }, 502);  
  
        const { data } = client.storage.from("media").getPublicUrl(path);  
        return json({ url: data.publicUrl, path }, 201);  
      }  
  
      let input: unknown;  
      try {  
        input = await request.json();  
      } catch {  
        return json({ error: "El cuerpo de la solicitud no es válido." }, 400);  
      }  
  
      if (path === "/api/content" && method === "POST") {  
        const row = parseContent(input);  
        if (!row) return json({ error: "El contenido no es válido." }, 400);  
        if (row.type === "image" && !validImageUrl(row.value, request)) {  
          return json({ error: "La dirección de la imagen no es válida." }, 400);  
        }  
        if (!(await saveContent(client, row))) {  
          return json({ error: "No se pudo guardar el contenido." }, 502);  
        }  
        return json({ saved: true, key: row.key });  
      }  
  
      const key = decodeURIComponent(path.slice("/api/content/".length));  
      const row = parseContent(  
        input && typeof input === "object"  
          ? { ...(input as Record<string, unknown>), key }  
          : input,  
      );  
      if (!row) return json({ error: "El contenido no es válido." }, 400);  
      if (row.type === "image" && !validImageUrl(row.value, request)) {  
        return json({ error: "La dirección de la imagen no es válida." }, 400);  
      }  
      if (!(await saveContent(client, row))) {  
        return json({ error: "No se pudo guardar el contenido." }, 502);  
      }  
      return json({ saved: true, key: row.key });  
    }  
  
    if (path.startsWith("/api/")) {  
      return json({ error: "Ruta no encontrada." }, 404);  
    }  
    return env.ASSETS.fetch(request);  
  } catch {  
    return json({ error: "No se pudo completar la solicitud." }, 500);  
  }  
}  
  
export default {  
  fetch(request: Request, env: Env): Promise<Response> {  
    return handleApi(request, env);  
  },  
};
