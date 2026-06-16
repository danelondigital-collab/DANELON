-- Espelho de Ponto: tabelas de importação e registros por profissional

CREATE TABLE IF NOT EXISTS ponto_importacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  total_registros INTEGER NOT NULL DEFAULT 0,
  importado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ponto_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  importacao_id UUID REFERENCES ponto_importacoes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  entrada TEXT,
  saida_almoco TEXT,
  retorno_almoco TEXT,
  saida TEXT,
  horas_trabalhadas NUMERIC(5,2),
  atraso_minutos INTEGER NOT NULL DEFAULT 0,
  falta BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ponto_profissional ON ponto_registros(profissional_id);
CREATE INDEX IF NOT EXISTS idx_ponto_unidade ON ponto_registros(unidade_id);
CREATE INDEX IF NOT EXISTS idx_ponto_data ON ponto_registros(data DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_importacao ON ponto_registros(importacao_id);
