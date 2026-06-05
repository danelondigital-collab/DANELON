DO $$
DECLARE
  morumbi_id UUID;
BEGIN
  SELECT id INTO morumbi_id FROM unidades WHERE nome ILIKE '%morumbi%' LIMIT 1;

  IF morumbi_id IS NULL THEN
    RAISE EXCEPTION 'Unidade Morumbi não encontrada';
  END IF;

  -- Sarah da Silva Lopes
  UPDATE profissionais SET
    cargo            = 'Aux. cabeleireiro',
    data_nascimento  = '2006-03-05',
    cpf              = '475.020.158-84',
    rg               = '53362585-8'
  WHERE nome ILIKE '%sarah da silva lopes%' AND unidade_id = morumbi_id;

  -- Andressa da Silva Mequelino
  UPDATE profissionais SET
    cargo            = 'Aux. cabeleireiro',
    data_nascimento  = '1996-10-16',
    cpf              = '451.476.458-29',
    rg               = '451.476.458-29'
  WHERE nome ILIKE '%andressa da silva mequelino%' AND unidade_id = morumbi_id;

  -- Karen Eloiza de Lima Martins
  UPDATE profissionais SET
    cargo            = 'Recepcionista',
    data_nascimento  = '1999-12-18',
    cpf              = '510.517.438-00',
    rg               = '510.517.438-00'
  WHERE nome ILIKE '%karen eloiza%' AND unidade_id = morumbi_id;

  -- Ana Luyza da Silva Campos Cardoso
  UPDATE profissionais SET
    cargo            = 'Cabeleireira',
    data_nascimento  = '2002-11-26',
    cpf              = '065.263.767-11',
    rg               = '286590369'
  WHERE nome ILIKE '%ana luyza%' AND unidade_id = morumbi_id;

  -- Mirella Vitoria Oliveira Souza
  UPDATE profissionais SET
    cargo            = 'Cabeleireiro(a)',
    data_nascimento  = '2004-12-04',
    cpf              = '481.383.468-09'
  WHERE nome ILIKE '%mirella vitoria%' AND unidade_id = morumbi_id;

  -- Bruna Sousa Dos Reis
  UPDATE profissionais SET
    cargo            = 'Recepcionista',
    data_nascimento  = '1998-01-01',
    gerar_agenda     = true
  WHERE nome ILIKE '%bruna sousa dos reis%' AND unidade_id = morumbi_id;

  -- Laudeci Maria de Almeida
  UPDATE profissionais SET
    cargo            = 'Cabeleireiro(a)',
    data_nascimento  = '1983-08-09',
    cpf              = '067.500.414-42',
    rg               = '538284717'
  WHERE nome ILIKE '%laudeci maria%' AND unidade_id = morumbi_id;

  -- Helloiza Eugelbi Martins
  UPDATE profissionais SET
    cargo            = 'Cabeleireiro(a)',
    data_nascimento  = '2001-11-20',
    cpf              = '489.869.678-39',
    rg               = '530987284'
  WHERE nome ILIKE '%helloiza%' AND unidade_id = morumbi_id;

  -- Martha Helena Silva (CNPJ — salão parceiro, comissão 15%)
  UPDATE profissionais SET
    cargo                        = 'Cabeleireiro(a)',
    data_nascimento              = '1998-04-21',
    cnpj                         = '39.673.966/0001-25',
    rg                           = '544510744',
    comissao_padrao              = 15,
    gerar_agenda                 = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%martha helena silva%' AND unidade_id = morumbi_id;

  -- Ketlin Ashley (CNPJ — salão parceiro)
  UPDATE profissionais SET
    cargo                        = 'Cabeleireiro(a)',
    data_nascimento              = '1996-07-28',
    cnpj                         = '53.559.370/0001-20',
    rg                           = '360777892',
    gerar_agenda                 = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%ketlin ashley%' AND unidade_id = morumbi_id;

  -- Lais Cunha Oliveira (CNPJ — salão parceiro)
  UPDATE profissionais SET
    cargo                        = 'Cabeleireiro(a)',
    data_nascimento              = '1999-07-24',
    cnpj                         = '56.385.207/0001-86',
    rg                           = '535505048',
    gerar_agenda                 = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%lais cunha oliveira%' AND unidade_id = morumbi_id;

  RAISE NOTICE 'Dados dos profissionais do Morumbi atualizados com sucesso.';
END $$;
