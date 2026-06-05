DO $$
DECLARE
  santoandre_id UUID;
BEGIN
  SELECT id INTO santoandre_id FROM unidades WHERE nome ILIKE '%santo andr%' LIMIT 1;

  IF santoandre_id IS NULL THEN
    RAISE EXCEPTION 'Unidade Santo André não encontrada';
  END IF;

  -- Talita da Silva Gomes Santos
  UPDATE profissionais SET
    cargo           = 'Aux. cabeleireiro',
    data_nascimento = '1992-02-08',
    cpf             = '090.207.904-20',
    rg              = '557331493'
  WHERE nome ILIKE '%talita da silva gomes%' AND unidade_id = santoandre_id;

  -- Jessyca Islayne Gomes dos Santos (CNPJ — líder, salão parceiro)
  UPDATE profissionais SET
    cargo                         = 'Cabeleireiro(a)',
    data_nascimento               = '1991-11-06',
    cnpj                          = '28.986.942/0001-00',
    rg                            = '569515555',
    gerar_agenda                  = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%jessyca islayne%' AND unidade_id = santoandre_id;

  -- Giovanna Lyssa Silva de Oliveira (CNPJ — salão parceiro)
  UPDATE profissionais SET
    cargo                         = 'Cabeleireiro(a)',
    data_nascimento               = '1999-04-23',
    cnpj                          = '60.294.029/0001-55',
    rg                            = '523411674',
    gerar_agenda                  = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%giovanna lyssa%' AND unidade_id = santoandre_id;

  -- Lilian Soares (CNPJ — salão parceiro)
  UPDATE profissionais SET
    cargo                         = 'Cabeleireiro(a)',
    data_nascimento               = '1988-04-01',
    cnpj                          = '36.132.608/0001-17',
    gerar_agenda                  = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%lilian soares%' AND unidade_id = santoandre_id;

  -- Sueli Barbosa da Silva (CNPJ — salão parceiro)
  UPDATE profissionais SET
    cargo                         = 'Cabeleireiro(a)',
    data_nascimento               = '2000-06-05',
    cnpj                          = '36.513.228/0001-22',
    gerar_agenda                  = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%sueli barbosa%' AND unidade_id = santoandre_id;

  -- Giovanna Alves Adorno (CPF)
  UPDATE profissionais SET
    cargo           = 'Cabeleireiro(a)',
    data_nascimento = '2002-12-22',
    cpf             = '552.441.088-16',
    rg              = '54.104.370-5'
  WHERE nome ILIKE '%giovanna alves adorno%' AND unidade_id = santoandre_id;

  -- Vitória Maria do Nascimento (CPF)
  UPDATE profissionais SET
    cargo           = 'Aux. cabeleireiro',
    data_nascimento = '2008-04-25',
    cpf             = '130.205.753-70',
    rg              = '13020575370'
  WHERE nome ILIKE '%vitória maria do nascimento%' AND unidade_id = santoandre_id;

  -- Dileide Viana dos Santos (CNPJ — salão parceiro, gerar agenda)
  UPDATE profissionais SET
    cargo                         = 'Cabeleireira',
    data_nascimento               = '1993-09-22',
    cnpj                          = '64.878.953/0001-30',
    gerar_agenda                  = true,
    contratado_lei_salao_parceiro = true
  WHERE nome ILIKE '%dileide viana%' AND unidade_id = santoandre_id;

  RAISE NOTICE 'Dados dos profissionais do Santo André atualizados.';
END $$;
