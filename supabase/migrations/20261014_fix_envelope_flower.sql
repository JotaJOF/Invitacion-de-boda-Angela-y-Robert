-- Ejecutar una vez en Supabase → SQL Editor.
-- Corrige el registro de la flor inferior solo si todavía apunta al afiche equivocado.
-- El valor destino es el recurso floral incluido en los assets públicos del Worker.
UPDATE public.site_content
SET value = '/assets/florals-bouquet.png',
    updated_at = now()
WHERE key = 'envelope_flower_bottom'
  AND type = 'image'
  AND value = 'https://uvlkpywshlipkowtueoi.supabase.co/storage/v1/object/public/media/envelope_flower_bottom.jpg';
