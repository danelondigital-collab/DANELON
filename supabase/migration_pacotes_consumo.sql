-- Controle de consumo dos itens de pacote nas comandas
ALTER TABLE pacote_itens
  ADD COLUMN IF NOT EXISTS quantidade_usada INTEGER NOT NULL DEFAULT 0;

ALTER TABLE comanda_itens
  ADD COLUMN IF NOT EXISTS pacote_item_id UUID REFERENCES pacote_itens(id);
