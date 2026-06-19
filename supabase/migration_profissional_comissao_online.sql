ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS recebe_comissao BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disponivel_agendamento_online BOOLEAN NOT NULL DEFAULT false;
