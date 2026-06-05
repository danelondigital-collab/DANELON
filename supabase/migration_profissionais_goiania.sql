DO $$
DECLARE
  goiania_id UUID;
BEGIN
  SELECT id INTO goiania_id FROM unidades WHERE nome ILIKE '%goi%' LIMIT 1;

  IF goiania_id IS NULL THEN
    RAISE EXCEPTION 'Unidade Goiânia não encontrada';
  END IF;

  INSERT INTO profissionais (nome, telefone, email, comissao_padrao, cor_agenda, unidade_id, ativo) VALUES
    ('Maria Eduarda Ferreira do Nascimento', '+55 (62) 93065-481',  'meduardaferreiranascimento@gmail.com', 0, '#6366f1', goiania_id, true),
    ('Bruna Rolins dos Santos',             '+55 (63) 91269-944',  'brunnarolins@gmail.com',               0, '#ec4899', goiania_id, true),
    ('Bruna Marchi Da Cruz Anjos',          '+55 (62) 91820-860',  'bruna-marchi12@hotmail.com',           0, '#f59e0b', goiania_id, true),
    ('Lorrany Silvestre Honório',           '+55 (62) 82391-505',  'lorranysilvestre22@gmail.com',         0, '#10b981', goiania_id, true),
    ('Jane Rodrigues',                      '+55 (62) 99503-4000', 'janerodrigues@gmail.com',              0, '#3b82f6', goiania_id, true),
    ('Cibele Souza da Cunha',               '+55 (62) 99327-9362', 'cibelis952@gmail.com',                 0, '#ef4444', goiania_id, true),
    ('Raksonia Alves Pereira do Nascimento','+55 (94) 94949-494',  'raksoniaalvesalves@gmail.com',         0, '#8b5cf6', goiania_id, true),
    ('Recepção Goiânia',                    '+55 (33) 33333-3333', 'recepcao.goiania@rededanelon.com',     0, '#06b6d4', goiania_id, true),
    ('Atendimento Goiânia',                 '+55 (55) 55555-5555', 'atendimentogoiania@grupodanelon.com',  0, '#6366f1', goiania_id, true),
    ('ADM - DANELON',                       '+55 (11) 55555-5555', 'admgoiania@grupodanelon.com',          0, '#ec4899', goiania_id, true),
    ('T.I - DANELON',                       '+55 (11) 97440-0937', 'ti.danelon@grupodanelon.com',          0, '#f59e0b', goiania_id, true),
    ('Diretoria Financeira',                '+55 (11) 94499-1512', 'romulo.goiania@rededanelon.com',       0, '#10b981', goiania_id, true),
    ('RH - ADM',                            '+55 (88) 88888-8888', 'rh.goiania@rededanelon.com',           0, '#3b82f6', goiania_id, true),
    ('Diretoria Operacional',               '+55 (11) 95020-2710', 'elaine.goiania@rededanelon.com',       0, '#8b5cf6', goiania_id, true),
    ('Empresa DANELON',                     '+55 (21) 21212-1212', NULL,                                   0, '#ef4444', goiania_id, true);

END $$;
