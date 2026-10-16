-- Ejecuta este archivo en Supabase → SQL Editor.
-- Antes de ejecutarlo, reemplaza el nombre de usuario y la contraseña
-- del bloque "Administrador inicial" por tus propios datos.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.site_content (
  key text primary key,
  type text not null check (type in ('text', 'image')),
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  username text primary key,
  password_hash text not null
);

create or replace function public.verify_admin_login(
  p_username text,
  p_password text
)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.admin_users
    where username = p_username
      and password_hash = extensions.crypt(p_password, password_hash)
  );
$function$;

revoke all on function public.verify_admin_login(text, text) from public;
revoke all on function public.verify_admin_login(text, text) from anon;
revoke all on function public.verify_admin_login(text, text) from authenticated;
grant execute on function public.verify_admin_login(text, text) to service_role;

alter table public.site_content enable row level security;
alter table public.admin_users enable row level security;

-- Tabla de invitados / confirmaciones (RSVP)  
create table if not exists public.guests (  
  id uuid primary key default gen_random_uuid(),  
  name text not null,                          -- nombre del invitado (NUNCA editable)  
  phone text default '',                       -- numero de WhatsApp asociado  
  attendance text not null default ''          -- 'yes' = confirma, 'no' = no puede, '' = pendiente  
    check (attendance in ('', 'yes', 'no')),  
  passes int not null default 0,               -- numero de pases/personas  
  message text default '',                     -- mensaje del invitado  
  source text not null default 'form',         -- 'form' o 'whatsapp'  
  created_at timestamptz not null default now(), -- fecha y hora de envio  
  modified boolean not null default false,     -- señal: si se modifico  
  modified_at timestamptz                      -- fecha de la ultima modificacion  
);    
  
alter table public.guests enable row level security;  
  
-- ===== Personalización por link (Opción 2) =====  
alter table public.guests  
  add column if not exists code text,          -- código corto del link (?c=A7F3K2)  
  add column if not exists max_passes int not null default 0, -- pases que TÚ asignas  
  add column if not exists opened_at timestamptz; -- cuándo abrió su link  
  
create unique index if not exists guests_code_key  
  on public.guests (code) where code is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)  
values (  
  'media',  
  'media',  
  true,  
  52428800,  
  array[  
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',  
    'video/mp4', 'video/webm', 'video/quicktime'  
  ]  
)  
on conflict (id) do update set  
  public = excluded.public,  
  file_size_limit = excluded.file_size_limit,  
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.site_content (key, type, value)
values
  ('couple_names', 'text', 'Angela y Robert'),
  ('invitation_note', 'text', 'Tenemos la alegría de invitarte a celebrar el comienzo de nuestra vida juntos.'),
  ('wedding_date', 'text', '13 de marzo de 2027'),
  ('welcome_text', 'text', 'Nos hace mucha ilusión compartir contigo este día tan especial. Esperamos celebrar, reír y crear recuerdos que nos acompañen siempre.'),
  ('ceremony_location', 'text', 'Quinta El Edén'),
  ('ceremony_time', 'text', '7:00 PM'),
  ('venue_address', 'text', 'P.º de las Gardenias 602, Nueva Castilla, Escobedo, Nuevo León'),
  ('event_date_short', 'text', 'Sábado · 13 de junio'),
  ('dress_code', 'text', 'Formal · elegante vaquero'),
  ('schedule', 'text', '7:00 PM · ceremonia
8:00 PM · recepción'),
  ('closing_text', 'text', 'Gracias por acompañarnos en un día que llevaremos siempre en el corazón.'),
  ('closing_names', 'text', 'Angela y Robert'),
  ('footer_note', 'text', 'CON CARIÑO · ANGELA & ROBERT · 13.06.2026'),
  ('hero_image', 'image', '/assets/hero-couple.png'),
  ('venue_image', 'image', '/assets/venue-garden.jpg'),
  ('closing_image', 'image', '/assets/closing-photo.jpg'),
  ('invitation_heading_line_1', 'text', 'QUEREMOS COMPARTIR CONTIGO LA'),
  ('invitation_heading_line_2', 'text', 'ALEGRÍA DE CELEBRAR'),
  ('invitation_heading_line_3', 'text', 'NUESTRA BODA'),
  ('calendar_cta', 'text', 'AGENDAR EN CALENDARIO'),
  ('countdown_title_script', 'text', 'Solo'),
  ('countdown_title_word', 'text', 'FALTAN'),
  ('countdown_days_label', 'text', 'DÍAS'),
  ('countdown_hours_label', 'text', 'HORAS'),
  ('countdown_minutes_label', 'text', 'MINUTOS'),
  ('countdown_seconds_label', 'text', 'SEGUNDOS'),
  ('envelope_image', 'image', '/assets/envelope-couple.webp'),
  ('date_card_image', 'image', '/assets/save-the-date.webp'),
  ('countdown_background', 'image', '/assets/roses-countdown.webp'),
  ('closing_photo', 'image', '/assets/couple-veil.webp'),
  ('rsvp_confirm_yes_image', 'image', '/assets/closing-photo.jpg'),  
  ('rsvp_confirm_no_image', 'image', '/assets/envelope-couple.webp'),  
  ('rsvp_thanks_title', 'text', 'GRACIAS POR SU RESPUESTA'),  
  ('rsvp_thanks_text', 'text', 'Hemos recibido su confirmación.'),  
  ('rsvp_modify_prompt', 'text', '¿Desea modificar su respuesta?'),  
  ('rsvp_confirm_prompt', 'text', '¿Está seguro de la información que enviará?')
on conflict (key) do nothing;

-- Reemplaza username y password antes de ejecutar.
-- Supabase genera un hash bcrypt ($2a$); nunca almacena la contraseña en claro.
insert into public.admin_users (username, password_hash)
values (
  'CAMBIA_ESTE_USUARIO',
  extensions.crypt('CAMBIA_ESTA_CONTRASENA_POR_UNA_LARGA_Y_UNICA', extensions.gen_salt('bf', 12))
)
on conflict (username) do nothing;
