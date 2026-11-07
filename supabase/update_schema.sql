-- ============================================================
-- Migración Multi-Bodas y Control de Acceso por Pareja
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabla de bodas
CREATE TABLE IF NOT EXISTS public.weddings (
    id TEXT PRIMARY KEY,
    names TEXT NOT NULL,
    date_iso TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Asegurar bodas iniciales
INSERT INTO public.weddings (id, names, date_iso)
VALUES 
    ('angela-robert', 'Angela Palmerston y Robert Wilson', '2027-03-13T19:00:00'),
    ('erick-erika', 'Erick y Erika', '2027-05-20T18:00:00')
ON CONFLICT (id) DO UPDATE SET names = EXCLUDED.names, date_iso = EXCLUDED.date_iso;

-- 2. Tabla de contenido por boda
CREATE TABLE IF NOT EXISTS public.wedding_content (
    wedding_id TEXT NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'image')),
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (wedding_id, key)
);

-- Migrar contenido global previo a angela-robert si existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_content') THEN
        INSERT INTO public.wedding_content (wedding_id, key, type, value, updated_at)
        SELECT 'angela-robert', key, type, value, updated_at
        FROM public.site_content
        ON CONFLICT (wedding_id, key) DO UPDATE
        SET type = EXCLUDED.type,
            value = EXCLUDED.value,
            updated_at = EXCLUDED.updated_at;
    END IF;
END $$;

-- 3. Vincular invitados a boda
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'wedding'
    ) THEN
        ALTER TABLE public.guests ADD COLUMN wedding TEXT NOT NULL DEFAULT 'angela-robert';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guests_wedding_code ON public.guests(wedding, code);
CREATE INDEX IF NOT EXISTS idx_guests_wedding_name ON public.guests(wedding, name);

-- 4. Tabla de usuarios del sistema (Superadmin y Parejas)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'couple')),
    wedding_id TEXT REFERENCES public.weddings(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{"location": true, "whatsapp": true, "date": true, "drive": true, "music": true, "guests": true, "invites": true, "edit": true, "themes": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migrar admin previo a superadmin
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
        INSERT INTO public.app_users (username, password_hash, role, permissions)
        SELECT username, password_hash, 'superadmin', '{"location": true, "whatsapp": true, "date": true, "drive": true, "music": true, "guests": true, "invites": true, "edit": true, "themes": true}'::jsonb
        FROM public.admin_users
        ON CONFLICT (username) DO NOTHING;
    END IF;
END $$;

-- 5. Función RPC de autenticación
CREATE OR REPLACE FUNCTION public.authenticate_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    valid BOOLEAN,
    username TEXT,
    role TEXT,
    wedding_id TEXT,
    permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user app_users%ROWTYPE;
BEGIN
    SELECT * INTO v_user
    FROM public.app_users
    WHERE app_users.username = p_username;

    IF NOT FOUND THEN
        -- Si no existe en app_users, intentar con admin_users (migración pendiente)
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB;
        RETURN;
    END IF;

    IF v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
        RETURN QUERY SELECT TRUE, v_user.username, v_user.role, v_user.wedding_id, v_user.permissions;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB;
    END IF;
END;
$$;

-- 6. Función RPC para crear o actualizar usuario de pareja
CREATE OR REPLACE FUNCTION public.create_or_update_couple_user(
    p_username TEXT,
    p_password TEXT,
    p_wedding_id TEXT,
    p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.app_users (username, password_hash, role, wedding_id, permissions)
    VALUES (p_username, crypt(p_password, gen_salt('bf')), 'couple', p_wedding_id, p_permissions)
    ON CONFLICT (username) DO UPDATE
    SET password_hash = CASE WHEN p_password <> '' THEN crypt(p_password, gen_salt('bf')) ELSE app_users.password_hash END,
        wedding_id = EXCLUDED.wedding_id,
        permissions = EXCLUDED.permissions;
END;
$$;

-- ============================================================
-- 7. Columnas que el Worker usa y faltaban en el esquema
-- ============================================================
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS confirmed_passes int NOT NULL DEFAULT 0;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS attendance_notes text DEFAULT '';
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- ============================================================
-- 8. RLS en las tablas nuevas (el Worker usa service_role, que lo omite)
-- Sin esto, la clave anónima podía leer password_hash de app_users.
-- ============================================================
ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. Las funciones SECURITY DEFINER solo debe ejecutarlas el Worker
-- (service_role). Sin el REVOKE, la clave anónima podía llamar a
-- create_or_update_couple_user y cambiar la contraseña de cualquier usuario.
-- ============================================================
REVOKE ALL ON FUNCTION public.authenticate_user(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_user(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_or_update_couple_user(text, text, text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_update_couple_user(text, text, text, jsonb) TO service_role;
