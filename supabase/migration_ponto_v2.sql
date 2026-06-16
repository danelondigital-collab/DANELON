-- Espelho de Ponto v2: horário por profissional + campos calculados

-- Campos de horário contratual na tabela de profissionais
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS horario_entrada TIME,
  ADD COLUMN IF NOT EXISTS horario_saida TIME,
  ADD COLUMN IF NOT EXISTS intervalo_minutos INTEGER NOT NULL DEFAULT 60;

-- Recriar ponto_registros com campos calculados
DROP TABLE IF EXISTS ponto_registros CASCADE;
DROP TABLE IF EXISTS ponto_importacoes CASCADE;

CREATE TABLE ponto_importacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  total_dias_trabalhados INTEGER NOT NULL DEFAULT 0,
  he50_minutos INTEGER NOT NULL DEFAULT 0,
  he100_minutos INTEGER NOT NULL DEFAULT 0,
  intervalo_suprimido_minutos INTEGER NOT NULL DEFAULT 0,
  horas_negativas_minutos INTEGER NOT NULL DEFAULT 0,
  faltas_sem_justificativa INTEGER NOT NULL DEFAULT 0,
  importado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ponto_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  importacao_id UUID NOT NULL REFERENCES ponto_importacoes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  dia_semana TEXT,
  -- Marcações brutas do Gênio
  e1 TEXT,
  s1 TEXT,
  e2 TEXT,
  s2 TEXT,
  marcacoes_raw TEXT,
  -- Tipo do dia
  tipo_dia TEXT NOT NULL DEFAULT 'normal'
    CHECK (tipo_dia IN ('normal', 'feriado', 'folga', 'falta', 'atestado', 'declaracao_horas', 'recesso')),
  ocorrencia_descricao TEXT,
  -- Valores do Gênio (para referência)
  genyo_previstas TEXT,
  genyo_trabalhadas TEXT,
  genyo_abonos TEXT,
  genyo_saldo TEXT,
  -- Valores calculados pelo sistema Danelon
  delta_entrada_min INTEGER NOT NULL DEFAULT 0,
  delta_saida_min INTEGER NOT NULL DEFAULT 0,
  saldo_dia_min INTEGER NOT NULL DEFAULT 0,
  intervalo_real_min INTEGER,
  intervalo_suprimido_min INTEGER NOT NULL DEFAULT 0,
  he100_min INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ponto_v2_profissional ON ponto_registros(profissional_id);
CREATE INDEX IF NOT EXISTS idx_ponto_v2_unidade ON ponto_registros(unidade_id);
CREATE INDEX IF NOT EXISTS idx_ponto_v2_data ON ponto_registros(data DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_v2_importacao ON ponto_registros(importacao_id);
