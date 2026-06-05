ALTER TABLE comandas ADD COLUMN IF NOT EXISTS numero TEXT;
CREATE INDEX IF NOT EXISTS idx_comandas_numero ON comandas(numero);
