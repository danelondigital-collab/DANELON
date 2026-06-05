ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS gerar_agenda BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contratado_lei_salao_parceiro BOOLEAN NOT NULL DEFAULT false;
