CREATE TABLE IF NOT EXISTS comissoes_profissional_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('servico', 'produto')),
  servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissao_prof_profissional ON comissoes_profissional_item(profissional_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comissao_prof_servico ON comissoes_profissional_item(profissional_id, servico_id) WHERE servico_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comissao_prof_produto ON comissoes_profissional_item(profissional_id, produto_id) WHERE produto_id IS NOT NULL;
