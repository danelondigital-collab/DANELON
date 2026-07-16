-- Remove bloqueios de agenda cadastrados em sábados e domingos
-- DOW: 0 = domingo, 6 = sábado (padrão PostgreSQL/Supabase)
DELETE FROM public.bloqueios_agenda
WHERE EXTRACT(DOW FROM data) IN (0, 6);
