CREATE TABLE IF NOT EXISTS comissoes_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL,
  vencimento DATE NOT NULL,
  item TEXT NOT NULL DEFAULT 'Comissão',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  historico TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissoes_historico_profissional ON comissoes_historico(profissional_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_historico_vencimento ON comissoes_historico(vencimento DESC);

ALTER TABLE comissoes_historico DISABLE ROW LEVEL SECURITY;
