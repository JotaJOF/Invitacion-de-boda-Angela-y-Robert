# Invitación Angela & Robert · Cloudflare Worker + Supabase

Esta versión es una página única en HTML, CSS y JavaScript. El Worker publica
los archivos de `site/` y ofrece el login, la lectura y la edición protegida del
contenido en Supabase. La invitación original de Replit se conserva aparte.

## Carpetas principales

- `worker/index.ts` — páginas API y sesión de administración.
- `site/` — HTML, estilos, JavaScript y fotos de la página pública.
- `supabase/setup.sql` — tablas, contenido de ejemplo, bucket y primer admin.
- `scripts/create-admin.mjs` — crea SQL con un hash bcrypt para agregar o cambiar admins.
- `wrangler.toml` — Worker y carpeta de archivos públicos.

## 1. Preparar Supabase

1. Abre `supabase/setup.sql`.
2. Cambia `CAMBIA_ESTE_USUARIO` y la contraseña de ejemplo por tus propios
   datos. Esa contraseña se transforma en un hash bcrypt al ejecutar el script;
   no queda almacenada en texto legible.
3. En Supabase, abre **SQL Editor**, pega el archivo completo y ejecútalo.

El script crea `site_content` y `admin_users`, guarda algunos textos e imágenes
iniciales y crea el bucket público `media`. Las tablas tienen RLS activado y no
permiten lectura o escritura anónima; el Worker accede con la clave de servicio.
El bucket permite que las imágenes subidas se puedan mostrar públicamente, pero
las subidas se hacen únicamente desde el Worker después del login de admin.
Si ya ejecutaste una versión anterior de este archivo, vuelve a ejecutarlo para
agregar las claves de la nueva composición; `ON CONFLICT DO NOTHING` conserva
los valores que ya hayas editado.

Para crear otro admin o generar de nuevo su contraseña bcrypt, ejecuta
`pnpm run admin:sql -- nombre-de-usuario` en una terminal. Escribe la contraseña
cuando se solicite; no se muestra en pantalla. Copia el `INSERT` que imprime y
ejecútalo en el SQL Editor de Supabase.

## 2. Configurar Cloudflare

Inicia sesión en Cloudflare una vez:

```sh
pnpm exec wrangler login
```

Publica una vez para crear el Worker en tu cuenta:

```sh
pnpm run worker:deploy
```

Hasta configurar las variables, la página pública muestra los ejemplos y la
API aún no puede conectarse a Supabase.

En **Workers & Pages → Workers → Settings → Variables and Secrets**, configura
estas dos variables para el Worker:

- `SUPABASE_URL` — Project URL de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — clave `service_role` del proyecto. Es un secreto:
  nunca la pongas en `site/`, en el HTML ni en JavaScript del navegador.

También puedes ingresarlas sin escribirlas en un archivo local con:

```sh
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Cada `secret put` publica una nueva versión del Worker. Si usas esos comandos,
ejecútalos después de la primera publicación.

El Worker firma una cookie de administración de 12 horas usando internamente
la clave de servicio; no hace falta configurar una tercera variable. Para que
el login funcione también con el límite de CPU del plan gratuito de Cloudflare,
el Worker pide a la función protegida `verify_admin_login` de Supabase que
compruebe el hash bcrypt. El Worker sigue gestionando el login y la sesión.

## 3. Comandos

Instalar las dependencias:

```sh
pnpm install
```

**Build / comprobación de Cloudflare:**

```sh
pnpm run worker:build
```

**Publicar en Cloudflare:**

```sh
pnpm run worker:deploy
```

El comando de desarrollo local es `pnpm run worker:dev`. La carpeta `site/` se
publica como archivos estáticos y las solicitudes `/api/*` se procesan primero
por el Worker.

## 4. Editar textos e imágenes

1. Abre la invitación y pulsa **ADMINISTRAR SITIO** al pie de la página.
2. Inicia sesión con el usuario y la contraseña creados en Supabase.
3. En **GUARDAR**, elige el lápiz junto a un texto para editarlo en la página.
   Para una imagen, el lápiz abre el selector de archivos.
4. Pulsa **GUARDAR** para guardar los cambios en Supabase.

Al cargar, `site/js/main.js` llama a `loadContent()` y solicita
`GET /api/content`. El Worker devuelve los valores y el navegador los aplica a
los elementos que tienen `data-key`. Los textos se asignan como texto plano;
las imágenes reciben su URL. Una imagen subida se guarda en `media` y luego se
guarda su URL en `site_content`.

Para hacer otra parte de la página editable, añade `data-key="mi_clave"` al
texto o imagen en `site/index.html` y agrega su valor inicial a
`supabase/setup.sql`. Una imagen debe ser un `<img>`; sus claves se guardan con
el tipo `image`, y el resto de claves con el tipo `text`.

## Seguridad y límites

- Supabase comprueba el hash bcrypt mediante `verify_admin_login`, una función
  disponible solo para `service_role`. La sesión usa una cookie `HttpOnly`,
  `Secure` y `SameSite=Lax`.
- Las rutas de escritura y subida requieren sesión; `GET /api/content` es
  público para visitantes.
- Las imágenes permitidas son JPG, PNG, WebP, GIF y AVIF, de hasta 8 MB.
- No compartas ni publiques `SUPABASE_SERVICE_ROLE_KEY`.
