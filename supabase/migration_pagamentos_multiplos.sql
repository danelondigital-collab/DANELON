-- Adiciona coluna para múltiplos pagamentos na comanda
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS pagamentos jsonb DEFAULT '[]';
