-- Adiciona campo de classificação aos produtos
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS classificacao text;

-- Apenas valores permitidos
ALTER TABLE produtos
  ADD CONSTRAINT produtos_classificacao_check CHECK (
    classificacao IS NULL OR classificacao IN (
      'revenda_alimenticia',
      'revenda_cosmeticos',
      'materiais_servicos',
      'consumo_interno',
      'consumo_clientes',
      'consumo_administrativo',
      'produtos_cabelos',
      'produtos_servicos'
    )
  );
