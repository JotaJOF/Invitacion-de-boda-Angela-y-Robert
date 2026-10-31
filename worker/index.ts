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
  role: 'superadmin' | 'couple';  
  wedding_id: string | null;  
  permissions: Record<string, boolean>;  
  expiresAt: number;  
}  
  
const COOKIE_NAME = "__Host-admin_session";  
const SESSION_SECONDS = 60 * 60 * 12;  
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;  
const MIME_EXTENSIONS: Record<string, string> = {  
  "image/avif": "avif",  
  "image/gif": "gif",  
  "image/heic": "heic",  
  "image/heif": "heif",  
  "image/jpeg": "jpg",  
  "image/png": "png",  
  "image/webp": "webp",  
  "video/mp4": "mp4",  
  "video/webm": "webm",  
  "video/quicktime": "mov",  
  "audio/mpeg": "mp3",  
  "audio/mp4": "m4a",  
  "audio/ogg": "ogg",  
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
  
async function generateUniqueCode(client: SupabaseClient): Promise<string> {  
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  
  for (let i = 0; i < 10; i++) {  
    let code = "";  
    const bytes = crypto.getRandomValues(new Uint8Array(6));  
    for (const b of bytes) code += chars[b % chars.length];  
    const { data } = await client.from("guests").select("id").eq("code", code).maybeSingle();  
    if (!data) return code;  
  }  
  return crypto.randomUUID().slice(0, 8).toUpperCase();  
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
  
async function createSession(
  username: string,
  env: Env,
  role: 'superadmin' | 'couple' = 'superadmin',
  wedding_id: string | null = null,
  permissions: Record<string, boolean> = {
    location: true, whatsapp: true, date: true, drive: true,
    music: true, guests: true, invites: true, edit: true, themes: true
  }
): Promise<string> {
  const payload: SessionPayload = {
    username, role, wedding_id, permissions,
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
  weddingId: string = "angela-robert"
): Promise<boolean> {
  const { error } = await client.from("wedding_content").upsert(
    { wedding_id: weddingId, ...row, updated_at: new Date().toISOString() },
    { onConflict: "wedding_id,key" },
  );
  if (weddingId === "angela-robert") {
    await client.from("site_content").upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  }
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
    // ==========================================
    // 1. AUTENTICACIÓN (SUPERADMIN & PAREJAS)
    // ==========================================
    if (path === "/api/login" && method === "POST") {  
      const body = (await request.json()) as Record<string, unknown>;  
      const username =  
        typeof body.username === "string" ? body.username.trim() : "";  
      const password = typeof body.password === "string" ? body.password : "";  
      if (!username || !password || username.length > 120 || password.length > 256) {  
        return json({ error: "Usuario o contraseña incorrectos." }, 401);  
      }  
  
      let authUser: {
        username: string;
        role: "superadmin" | "couple";
        wedding_id: string | null;
        permissions: Record<string, boolean>;
      } | null = null;

      const { data: authData, error: authError } = await supabase(env).rpc(
        "authenticate_user",
        { p_username: username, p_password: password },
      );

      if (!authError && Array.isArray(authData) && authData.length > 0 && authData[0].valid === true) {
        const u = authData[0];
        authUser = {
          username: u.username,
          role: (u.role === "couple" ? "couple" : "superadmin"),
          wedding_id: u.wedding_id || null,
          permissions: (typeof u.permissions === "object" && u.permissions) ? u.permissions : {
            location: true, whatsapp: true, date: true, drive: true,
            music: true, guests: true, invites: true, edit: true, themes: true
          }
        };
      } else {
        const { data: passwordMatches, error: legacyError } = await supabase(env).rpc(
          "verify_admin_login",
          { p_username: username, p_password: password },
        );
        if (!legacyError && passwordMatches === true) {
          authUser = {
            username,
            role: "superadmin",
            wedding_id: null,
            permissions: {
              location: true, whatsapp: true, date: true, drive: true,
              music: true, guests: true, invites: true, edit: true, themes: true
            }
          };
        }
      }

      if (!authUser) {
        return json({ error: "Usuario o contraseña incorrectos." }, 401);
      }

      const token = await createSession(
        authUser.username,
        env,
        authUser.role,
        authUser.wedding_id,
        authUser.permissions
      );
      return json(
        {
          authenticated: true,
          username: authUser.username,
          role: authUser.role,
          wedding_id: authUser.wedding_id,
          permissions: authUser.permissions,
        },
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
      if (!session) {  
        return json({ authenticated: false }, 200);  
      }  
      return json({
        authenticated: true,
        username: session.username,
        role: session.role || "superadmin",
        wedding_id: session.wedding_id || null,
        permissions: session.permissions || {
          location: true, whatsapp: true, date: true, drive: true,
          music: true, guests: true, invites: true, edit: true, themes: true
        }
      }, 200);  
    }  

    // ==========================================
    // 2. GESTIÓN DE BODAS (SUPERADMIN & PÚBLICO)
    // ==========================================
    if (path === "/api/weddings" && method === "GET") {
      const { data, error } = await supabase(env)
        .from("weddings")
        .select("id,names,date_iso,created_at")
        .order("created_at", { ascending: false });
      return json({ weddings: data || [] }, 200);
    }

    if (path === "/api/weddings" && method === "POST") {
      const session = await getSession(request, env);
      if (!session || session.role !== "superadmin") {
        return json({ error: "Inicia sesión como administrador general para crear bodas." }, 401);
      }
      const body = (await request.json()) as Record<string, unknown>;
      const rawId = typeof body.id === "string" ? body.id.trim().toLowerCase() : "";
      const id = rawId.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
      const names = typeof body.names === "string" ? body.names.trim() : "";
      const date_iso = typeof body.date_iso === "string" ? body.date_iso.trim() : "";

      if (!id || !names) {
        return json({ error: "El slug y los nombres son obligatorios." }, 400);
      }

      const db = supabase(env);
      const { data: existing } = await db.from("weddings").select("id").eq("id", id).maybeSingle();
      if (existing) return json({ error: "Ese enlace ya existe. Elige otra terminación." }, 409);

      const { error: wErr } = await db.from("weddings").insert({ id, names, date_iso });
      if (wErr) return json({ error: "No se pudo guardar la boda." }, 502);

      // Start every new invitation from the exact stored Angela & Robert template.
      const { data: template, error: templateError } = await db
        .from("wedding_content").select("key,type,value,updated_at")
        .eq("wedding_id", "angela-robert");
      if (templateError) {
        await db.from("weddings").delete().eq("id", id);
        return json({ error: "No se pudo leer la invitación original para copiarla." }, 502);
      }
      const copied = new Map((template || []).map((row: any) => [row.key, { ...row, wedding_id: id }]));
      const nameParts = names.split(/\s+(?:y|&|e)\s+/i);
      const bride = (nameParts[0] || names).trim();
      const groom = (nameParts[1] || "").trim();
      const splitName = (full: string) => { const [first, ...rest] = full.split(/\s+/); return { first: first || "", last: rest.join(" ") }; };
      const brideParts = splitName(bride), groomParts = splitName(groom);
      const put = (key: string, value: string) => copied.set(key, { wedding_id: id, key, type: "text", value, updated_at: new Date().toISOString() });
      if (bride) { put("bride_initial", brideParts.first.slice(0,1).toUpperCase()); put("bride_first_name", brideParts.first.toUpperCase()); put("bride_last_name", brideParts.last.toUpperCase()); }
      if (groom) { put("groom_initial", groomParts.first.slice(0,1).toUpperCase()); put("groom_first_name", groomParts.first.toUpperCase()); put("groom_last_name", groomParts.last.toUpperCase()); }
      put("couple_heading", names); put("couple_names", `${brideParts.first}${groom ? ` y ${groomParts.first}` : ""}`); put("closing_names", `${brideParts.first}${groom ? ` y ${groomParts.first}` : ""}`);
      if (date_iso) put("cfg_date", date_iso);
      const cloneRows = [...copied.values()];
      if (cloneRows.length) {
        const { error: cloneError } = await db.from("wedding_content").insert(cloneRows);
        if (cloneError) {
          await db.from("weddings").delete().eq("id", id);
          return json({ error: "No se pudo copiar el diseño de la boda original." }, 502);
        }
      }

      if (typeof body.couple_username === "string" && body.couple_username.trim()) {
        const cUser = body.couple_username.trim();
        const cPass = typeof body.couple_password === "string" ? body.couple_password : "";
        const cPerms = (typeof body.permissions === "object" && body.permissions) ? body.permissions : {
          location: true, whatsapp: true, date: true, drive: true,
          music: true, guests: true, invites: true, edit: true, themes: true
        };

        if (cPass) {
          const { error: userError } = await supabase(env).rpc("create_or_update_couple_user", {
            p_username: cUser,
            p_password: cPass,
            p_wedding_id: id,
            p_permissions: cPerms
          });
          if (userError) return json({ error: "La boda se creó, pero no se pudo crear el usuario de pareja." }, 502);
        }
      }

      return json({ ok: true, id, names, date_iso }, 200);
    }

    if (path.startsWith("/api/wedding/") && method === "GET") {  
      const id = decodeURIComponent(path.slice("/api/wedding/".length)).toLowerCase();  
      const { data } = await supabase(env)  
        .from("weddings")  
        .select("id,names,date_iso")  
        .eq("id", id)  
        .maybeSingle();  
      if (!data) return json({ error: "Boda no encontrada." }, 404);  
      return json({ wedding: data });  
    }  

    // ==========================================
    // 3. CONTENIDO DE LA BODA (AISLADO)
    // ==========================================
    if (path === "/api/content" && method === "GET") {  
      const weddingParam = url.searchParams.get("wedding") || "angela-robert";
      const { data: requestedWedding } = await supabase(env).from("weddings").select("id").eq("id", weddingParam).maybeSingle();
      if (!requestedWedding) return json({ error: "Boda no encontrada." }, 404);

      let contentMap: Record<string, { type: string; value: string }> = {};

      const { data: wData, error: wError } = await supabase(env)  
        .from("wedding_content")  
        .select("key,type,value")  
        .eq("wedding_id", weddingParam)
        .order("key");  

      if (!wError && wData && wData.length > 0) {
        contentMap = Object.fromEntries(
          (wData as ContentRow[]).map(({ key, type, value }) => [
            key,
            { type, value },
          ]),
        );
      } else if (weddingParam === "angela-robert") {
        const { data, error } = await supabase(env)  
          .from("site_content")  
          .select("key,type,value")  
          .order("key");  
        if (!error && data) {
          contentMap = Object.fromEntries(
            (data as ContentRow[]).map(({ key, type, value }) => [
              key,
              { type, value },
            ]),
          );
        }
      }

      if (weddingParam === "angela-robert") {
        contentMap["bride_initial"] = { type: "text", value: "A" };
        contentMap["bride_first_name"] = { type: "text", value: "NGELA" };
        contentMap["bride_last_name"] = { type: "text", value: "PALMERSTON" };
        contentMap["groom_initial"] = { type: "text", value: "R" };
        contentMap["groom_first_name"] = { type: "text", value: "OBERT" };
        contentMap["groom_last_name"] = { type: "text", value: "WILSON" };
        contentMap["couple_heading"] = { type: "text", value: "Angela Palmerston y Robert Wilson" };
        contentMap["couple_names"] = { type: "text", value: "Angela y Robert" };
        contentMap["closing_names"] = { type: "text", value: "Angela y Robert" };
        contentMap["cover_and"] = { type: "text", value: "and" };

        for (const corruptKey of ["bride_initial__style", "groom_initial__style", "bride_first_name__style", "bride_last_name__style", "groom_first_name__style", "groom_last_name__style", "cover_date_fmt__style", "cover_place__style"]) {
          if (contentMap[corruptKey]?.value) {
            try {
              const s = JSON.parse(contentMap[corruptKey].value);
              if (s.transform && (s.transform.includes("translate(-10px") || s.transform.includes("translate(10px") || (s.transform.match(/translate/g) || []).length > 1)) {
                delete s.transform;
              }
              if (s.marginLeft === "auto") delete s.marginLeft;
              if (corruptKey === "cover_date_fmt__style" && s.fontFamily && s.fontFamily.includes("Throhand Ink")) {
                delete s.fontFamily;
              }
              contentMap[corruptKey].value = JSON.stringify(s);
            } catch {}
          }
        }
      }
if (weddingParam !== "angela-robert") {
        const { data: wRow } = await supabase(env)
          .from("weddings")
          .select("names,date_iso")
          .eq("id", weddingParam)
          .maybeSingle();
        if (wRow?.names && !contentMap["couple_heading"]) {
          contentMap["couple_heading"] = { type: "text", value: wRow.names };
        }
        if (wRow?.date_iso && !contentMap["cfg_date"]) {
          contentMap["cfg_date"] = { type: "text", value: wRow.date_iso };
        }
      }

      return json({ content: contentMap, wedding: weddingParam });  
    }  

    // ==========================================
    // 4. INVITADOS & CONFIRMACIONES (AISLADO POR BODA)
    // ==========================================
    if (path === "/api/guests" && method === "GET") {  
      const session = await getSession(request, env);  
      if (!session) {  
        return json({ error: "Inicia sesión para ver invitados." }, 401);  
      }  

      let targetWedding = "angela-robert";
      if (session.role === "couple") {
        targetWedding = session.wedding_id || "angela-robert";
        if (session.permissions && session.permissions.guests === false) {
          return json({ error: "No tienes permiso para ver la lista de invitados." }, 403);
        }
      } else {
        targetWedding = url.searchParams.get("wedding") || "angela-robert";
      }

      const { data, error } = await supabase(env)  
        .from("guests")  
        .select("id,code,name,phone,max_passes,confirmed_passes,attendance,attendance_notes,created_at,wedding")  
        .eq("wedding", targetWedding)
        .order("created_at", { ascending: false });  
      if (error) return json({ error: "No se pudo cargar la lista." }, 502);  
      return json({ guests: data ?? [], wedding: targetWedding });  
    }  
  
    if (path === "/api/guests" && method === "POST") {  
      const body = (await request.json()) as Record<string, unknown>;  
      const wedding = (typeof body.wedding === "string" && body.wedding.trim()) ? body.wedding.trim().toLowerCase() : "angela-robert";
      const name = typeof body.name === "string" ? body.name.trim() : "";  
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";  
      const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";  
      const attendance =  
        body.attendance === "yes" || body.attendance === "no"  
          ? body.attendance  
          : null;  
      const rawPasses = typeof body.confirmed_passes === "number" ? body.confirmed_passes : body.passes;  
      const confirmed_passes =    
        typeof rawPasses === "number" && rawPasses >= 0    
          ? Math.floor(rawPasses)    
          : 0;    
      const rawNotes = typeof body.attendance_notes === "string" ? body.attendance_notes : body.message;  
      const attendance_notes =    
        typeof rawNotes === "string" ? rawNotes.trim() : "";  
  
      if (code) {  
        const { error } = await supabase(env)  
          .from("guests")  
          .update({  
            attendance,  
            confirmed_passes,  
            attendance_notes,  
          })  
          .eq("code", code)
          .eq("wedding", wedding);  
        if (error) return json({ error: "No se pudo actualizar el invitado." }, 502);  
        return json({ ok: true });  
      }  
  
      if (!name) return json({ error: "El nombre es obligatorio." }, 400);  
      const newCode = (await generateUniqueCode(supabase(env))).toUpperCase();  
      const { error } = await supabase(env).from("guests").insert({  
        name,  
        phone: phone || null,  
        code: newCode,  
        attendance,  
        confirmed_passes,  
        attendance_notes,  
        wedding,
      });  
      if (error) return json({ error: "No se pudo registrar el invitado: " + error.message }, 502);  
      return json({ ok: true, code: newCode });  
    }  
  
    if (path.startsWith("/api/guests/check/") && method === "GET") {  
      const phone = decodeURIComponent(  
        path.slice("/api/guests/check/".length),  
      ).replace(/\D/g, "");  
      const wedding = url.searchParams.get("wedding") || "angela-robert";
      if (!phone) return json({ guest: null }, 200);  
      const { data } = await supabase(env)  
        .from("guests")  
        .select("id,code,name,phone,max_passes,confirmed_passes,attendance,attendance_notes")  
        .eq("wedding", wedding)
        .ilike("phone", `%${phone.slice(-10)}%`)  
        .limit(1)  
        .maybeSingle();  
      return json({ guest: data ?? null });  
    }  
  
    if (path === "/api/invites" && method === "POST") {  
      const session = await getSession(request, env);  
      if (!session) {  
        return json({ error: "Inicia sesión para generar links." }, 401);  
      }  

      let targetWedding = "angela-robert";
      if (session.role === "couple") {
        targetWedding = session.wedding_id || "angela-robert";
        if (session.permissions && session.permissions.invites === false) {
          return json({ error: "No tienes permiso para generar links." }, 403);
        }
      } else {
        targetWedding = url.searchParams.get("wedding") || "angela-robert";
      }

      const body = (await request.json()) as Record<string, unknown>;  
      // Acepta tanto un invitado {name,...} como una lista {guests:[{name,...}]}  
      const list = Array.isArray(body.guests) ? (body.guests as Record<string, unknown>[]) : [body];  
      const client = supabase(env);  
      const rows = [];  
      for (const g of list) {  
        const name = typeof g.name === "string" ? g.name.trim() : "";  
        const phone = typeof g.phone === "string" ? g.phone.trim() : "";  
        const max_passes =  
          typeof g.max_passes === "number" && g.max_passes > 0  
            ? Math.floor(g.max_passes)  
            : 1;  
        if (!name) continue; // salta líneas vacías en vez de fallar todo  
        rows.push({  
          name,  
          phone: phone || null,  
          max_passes,  
          code: (await generateUniqueCode(client)).toUpperCase(),  
          wedding: targetWedding,  
        });  
      }  
      if (rows.length === 0) return json({ error: "No hay invitados válidos en la lista." }, 400);  
      const { error } = await client.from("guests").insert(rows);  
      if (error) return json({ error: "No se pudo generar el enlace." }, 502);  
      return json({ count: rows.length, wedding: targetWedding });
      }
  
    if (path.startsWith("/api/invite/") && method === "GET") {  
      const code = decodeURIComponent(path.slice("/api/invite/".length)).slice(0, 20).toUpperCase();  
      const { data } = await supabase(env)  
        .from("guests")  
        .select("name,max_passes,confirmed_passes,attendance,attendance_notes,wedding")  
        .eq("code", code)  
        .maybeSingle();  
      return json({ guest: data ?? null });  
    }  
  
    if (path.startsWith("/api/guests/") && method === "DELETE") {  
      const session = await getSession(request, env);  
      if (!session) {  
        return json({ error: "Inicia sesión para eliminar invitados." }, 401);  
      }  
      if (session.role === "couple" && session.permissions?.guests === false) {
        return json({ error: "No tienes permiso para modificar invitados." }, 403);
      }
      const id = path.slice("/api/guests/".length);  
      const { error } = await supabase(env).from("guests").delete().eq("id", id);  
      if (error) return json({ error: "No se pudo eliminar el invitado." }, 502);  
      return json({ ok: true });  
    }  
  
    // ==========================================
    // 5. EDICIÓN DE CONTENIDO Y SUBIDA DE ARCHIVOS
    // ==========================================
    if (  
      (path === "/api/content" && method === "POST") ||  
      (path.startsWith("/api/content/") && method === "PUT") ||  
      (path === "/api/upload" && method === "POST")  
    ) {  
      const session = await getSession(request, env);  
      if (!session) {  
        return json({ error: "Inicia sesión para guardar cambios." }, 401);  
      }  
  
      let targetWedding = "angela-robert";
      if (session.role === "couple") {
        targetWedding = session.wedding_id || "angela-robert";
      } else {
        targetWedding = url.searchParams.get("wedding") || session.wedding_id || "angela-robert";
      }

      const client = supabase(env);  
  
      if (path === "/api/upload") {  
        if (session.role === "couple" && session.permissions?.music === false && session.permissions?.edit === false) {
          return json({ error: "No tienes permiso para subir archivos." }, 403);
        }

        const contentLength = Number(request.headers.get("content-length") ?? 0);  
        if (contentLength > MAX_IMAGE_BYTES + 128 * 1024) {  
          return json({ error: "El archivo supera el límite de 50 MB." }, 413);  
        }  
  
        const form = await request.formData();  
        const file = form.get("file");  
        if (!(file instanceof File) || file.size === 0) {  
          return json({ error: "Selecciona un archivo." }, 400);  
        }  
        if (file.size > MAX_IMAGE_BYTES) {  
          return json({ error: "El archivo supera el límite de 50 MB." }, 413);  
        }  
        const extension = MIME_EXTENSIONS[file.type];  
        if (!extension) {  
          return json(  
            { error: "Usa una imagen JPG, PNG, WebP, GIF, AVIF, un video o un audio MP3." },  
            415,  
          );  
        }  
  
        const storagePath = `media/${targetWedding}/${crypto.randomUUID()}.${extension}`;  
        const { error } = await client.storage.from("media").upload(  
          storagePath,  
          new Blob([await file.arrayBuffer()], { type: file.type }),  
          {  
            cacheControl: "31536000",  
            contentType: file.type,  
            upsert: false,  
          },  
        );  
        if (error) {  
          return json({ error: "No se pudo subir el archivo." }, 502);  
        }  
  
        const { data } = client.storage.from("media").getPublicUrl(storagePath);  
        return json({ url: data.publicUrl }, 201);  
      }  
  
      let row: ContentRow | null = null;  
      if (path === "/api/content" && method === "POST") {  
        row = parseContent((await request.json()) as Record<string, unknown>);  
      } else {  
        const key = decodeURIComponent(path.slice("/api/content/".length));  
        row = parseContent({  
          key,  
          ...((await request.json()) as Record<string, unknown>),  
        });  
      }  
  
      if (!row) {  
        return json({ error: "Clave, tipo o valor no válidos." }, 400);  
      }  

      if (session.role === "couple") {
        const rawKey = row.key.replace(/^cfg_/, "");
        if (session.permissions && rawKey in session.permissions && !session.permissions[rawKey]) {
          return json({ error: "No tienes permiso para modificar esta sección." }, 403);
        }
      }

      if (!(await saveContent(client, row, targetWedding))) {  
        return json({ error: "No se pudo guardar el contenido." }, 502);  
      }  
      return json({ saved: true, key: row.key, wedding: targetWedding });  
    }  
  
    if (path.startsWith("/api/")) {  
      return json({ error: "Ruta no encontrada." }, 404);  
    }  
  
    // ==========================================
    // 6. RUTAS LIMPIAS SPA (SLUGS DE BODA)
    // ==========================================
    if (path !== "/" && !path.includes(".") && path.split("/").filter(Boolean).length === 1) {  
      const slug = decodeURIComponent(path.slice(1)).toLowerCase();  
      const { data: wedding } = await supabase(env)  
        .from("weddings")  
        .select("id")  
        .eq("id", slug)  
        .maybeSingle();  
      if (!wedding) {  
        return new Response("Invitación no encontrada", { status: 404 });  
      }  
      return env.ASSETS.fetch(new URL("/index.html", url).toString(), { headers: request.headers });  
    }  
  
    return env.ASSETS.fetch(request);  
  } catch (err: any) {  
    console.error("Worker API error:", err);  
    return json({ error: err?.message || "No se pudo completar la solicitud." }, 500);  
  }  
}  

export default {  
  fetch(request: Request, env: Env): Promise<Response> {  
    return handleApi(request, env);  
  },  
};
