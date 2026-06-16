-- App Mobile: campos para controle de acesso das profissionais
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS app_acesso BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_user_id UUID,
  ADD COLUMN IF NOT EXISTS app_email TEXT;

CREATE INDEX IF NOT EXISTS idx_profissionais_app_user_id ON profissionais(app_user_id);
