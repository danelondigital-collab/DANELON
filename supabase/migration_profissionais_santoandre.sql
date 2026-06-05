DO $$
DECLARE
  santoandre_id UUID;
BEGIN
  SELECT id INTO santoandre_id FROM unidades WHERE nome ILIKE '%santo andr%' LIMIT 1;

  IF santoandre_id IS NULL THEN
    RAISE EXCEPTION 'Unidade Santo André não encontrada';
  END IF;

  INSERT INTO profissionais (nome, telefone, email, comissao_padrao, cor_agenda, unidade_id, ativo) VALUES
    ('Dileide Viana dos Santos',          '+55 (11) 96125-7146', 'dileideviana1@hotmail.com',              0, '#6366f1', santoandre_id, true),
    ('Vitória Maria do Nascimento',        '+55 (11) 98440-6989', 'vitoriamariadonascimento234@gmail.com',  0, '#ec4899', santoandre_id, true),
    ('Talita da Silva Gomes Santos',       '+55 (11) 97606-0762', 'gomes.silva.talita3@gmail.com',          0, '#f59e0b', santoandre_id, true),
    ('Jessyca Islayne Gomes dos Santos',   '+55 (11) 98336-1068', 'jessycayslanemiranda@gmail.com',         0, '#10b981', santoandre_id, true),
    ('Giovanna Lyssa Silva de Oliveira',   '+55 (11) 97631-6681', 'giovannalyssa99@icloud.com',             0, '#3b82f6', santoandre_id, true),
    ('Lilian Soares',                      '+55 (11) 97589-8060', NULL,                                     0, '#ef4444', santoandre_id, true),
    ('Sueli Barbosa da Silva',             '+55 (11) 97741-3983', 'bsueli441@gmail.com',                    0, '#8b5cf6', santoandre_id, true),
    ('Giovanna Alves Adorno',              '+55 (11) 98880-4950', 'giovannaalvesadorno2020@gmail.com',      0, '#06b6d4', santoandre_id, true),
    ('Recepção Santo André',               '+55 (11) 96462-4969', 'recepcao.santoandre@rededanelon.com',    0, '#6366f1', santoandre_id, true),
    ('ADM - DANELON',                      '+55 (11) 91347-0088', 'admabc@grupodanelon.com',                0, '#ec4899', santoandre_id, true),
    ('Atendimento ABC',                    '+55 (44) 44444-4444', 'atendimentoabc@grupodanelon.com',        0, '#f59e0b', santoandre_id, true),
    ('RH - ADM',                           '+55 (88) 88888-8888', 'rh.santoandre@rededanelon.com',          0, '#10b981', santoandre_id, true),
    ('Diretoria Operacional',              '+55 (11) 95020-2710', 'elaine.santoandre@rededanelon.com',      0, '#3b82f6', santoandre_id, true),
    ('Diretoria Financeira',               '+55 (11) 94499-1512', 'romulo.santoandre@rededanelon.com',      0, '#8b5cf6', santoandre_id, true),
    ('Empresa DANELON',                    '+55 (21) 21212-1212', NULL,                                     0, '#ef4444', santoandre_id, true);

  RAISE NOTICE 'Profissionais do Santo André inseridos com sucesso.';
END $$;
