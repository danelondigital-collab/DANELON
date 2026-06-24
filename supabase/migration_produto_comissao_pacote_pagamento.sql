-- Comissão percentual por produto
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS comissao_produto NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Forma de pagamento do pacote (reaproveita o enum forma_pagamento já usado em comandas)
ALTER TABLE pacotes
  ADD COLUMN IF NOT EXISTS forma_pagamento forma_pagamento;
