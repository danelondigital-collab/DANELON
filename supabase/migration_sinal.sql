-- Adiciona campo sinal em agendamentos e comandas
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS sinal numeric DEFAULT 0;
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS sinal numeric DEFAULT 0;
