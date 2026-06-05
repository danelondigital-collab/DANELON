DO $$
DECLARE
  morumbi_id   UUID;
  martha_id    UUID;
BEGIN
  SELECT id INTO morumbi_id FROM unidades WHERE nome ILIKE '%morumbi%' LIMIT 1;
  SELECT id INTO martha_id  FROM profissionais
    WHERE nome ILIKE '%martha helena silva%' AND unidade_id = morumbi_id LIMIT 1;

  IF martha_id IS NULL THEN
    RAISE EXCEPTION 'Martha Helena Silva não encontrada no Morumbi';
  END IF;

  -- Remove entradas antigas para evitar duplicatas
  DELETE FROM comissoes_profissional_item WHERE profissional_id = martha_id;

  -- Insere 15% para todos os serviços ativos
  INSERT INTO comissoes_profissional_item (profissional_id, tipo, servico_id, percentual)
  SELECT martha_id, 'servico', s.id, 15
  FROM servicos s
  WHERE s.ativo = true;

  -- Insere 15% para todos os produtos ativos
  INSERT INTO comissoes_profissional_item (profissional_id, tipo, produto_id, percentual)
  SELECT martha_id, 'produto', p.id, 15
  FROM produtos p
  WHERE p.ativo = true;

  RAISE NOTICE 'Comissões de Martha Helena Silva (Morumbi) configuradas com 15%% de comissão.';
END $$;
