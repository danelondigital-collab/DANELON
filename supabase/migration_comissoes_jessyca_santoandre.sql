DO $$
DECLARE
  santoandre_id UUID;
  jessyca_id    UUID;
BEGIN
  SELECT id INTO santoandre_id FROM unidades WHERE nome ILIKE '%santo andr%' LIMIT 1;
  SELECT id INTO jessyca_id FROM profissionais
    WHERE nome ILIKE '%jessyca islayne%' AND unidade_id = santoandre_id LIMIT 1;

  IF jessyca_id IS NULL THEN
    RAISE EXCEPTION 'Jessyca Islayne não encontrada no Santo André';
  END IF;

  -- Remove entradas antigas para evitar duplicatas
  DELETE FROM comissoes_profissional_item WHERE profissional_id = jessyca_id;

  -- Insere 15% para todos os serviços ativos
  INSERT INTO comissoes_profissional_item (profissional_id, tipo, servico_id, percentual)
  SELECT jessyca_id, 'servico', s.id, 15
  FROM servicos s
  WHERE s.ativo = true;

  -- Insere 15% para todos os produtos ativos
  INSERT INTO comissoes_profissional_item (profissional_id, tipo, produto_id, percentual)
  SELECT jessyca_id, 'produto', p.id, 15
  FROM produtos p
  WHERE p.ativo = true;

  RAISE NOTICE 'Comissões de Jessyca Islayne (Santo André) configuradas com 15%%.';
END $$;
