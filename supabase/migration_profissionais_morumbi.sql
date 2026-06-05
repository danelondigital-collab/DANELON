DO $$
DECLARE
  morumbi_id UUID;
BEGIN
  SELECT id INTO morumbi_id FROM unidades WHERE nome ILIKE '%morumbi%' LIMIT 1;

  IF morumbi_id IS NULL THEN
    RAISE EXCEPTION 'Unidade Morumbi não encontrada';
  END IF;

  INSERT INTO profissionais (nome, telefone, email, comissao_padrao, cor_agenda, unidade_id, ativo) VALUES
    ('Sarah da Silva Lopes',           '+55 (11) 91636-8812', 'silvaalopes011@gmail.com',          0, '#6366f1', morumbi_id, true),
    ('Andressa da Silva Mequelino',    '+55 (11) 94394-7803', 'andressa.dasilva3412@gmail.com',    0, '#ec4899', morumbi_id, true),
    ('Karen Eloiza de Lima Martins',   '+55 (11) 96463-0066', 'eloizak39@gmail.com',               0, '#f59e0b', morumbi_id, true),
    ('Ana Luyza da Silva Campos Cardoso', '+55 (21) 98208-6641', 'analuyzacampos2@gmail.com',      0, '#10b981', morumbi_id, true),
    ('Mirella Vitoria Oliveira Souza', '+55 (11) 98608-2606', 'mirelasouza2004@icloud.com',        0, '#3b82f6', morumbi_id, true),
    ('Bruna Sousa Dos Reis',           '+55 (11) 98188-2013', NULL,                                0, '#ef4444', morumbi_id, true),
    ('Laudeci Maria de Almeida',       '+55 (11) 96072-0531', 'laudeci.almeida08@gmail.com',       0, '#8b5cf6', morumbi_id, true),
    ('Recepcão Morumbi',               '+55 (11) 11111-1111', 'recepcao.morumbi@rededanelon.com',  0, '#06b6d4', morumbi_id, true),
    ('Helloiza Eugelbi Martins',       '+55 (11) 98934-3061', 'eugelbimartins@outlook.com',        0, '#6366f1', morumbi_id, true),
    ('Martha Helena Silva',            '+55 (11) 98141-5886', 'martha.helena@grupodanelon.com',    0, '#ec4899', morumbi_id, true),
    ('Ketlin Ashley',                  '+55 (11) 94000-7615', 'ashleyketlin@gmail.com',            0, '#f59e0b', morumbi_id, true),
    ('Lais Cunha Oliveira',            '+55 (11) 98321-1173', 'cunhalaiscunha09@gmail.com',        0, '#10b981', morumbi_id, true),
    ('ADM - DANELON',                  '+55 (11) 94499-1519', 'admmoema@grupodanelon.com',         0, '#3b82f6', morumbi_id, true);

END $$;
