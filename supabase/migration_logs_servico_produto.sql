-- Atualiza constraint para aceitar servico e produto
ALTER TABLE public.logs_atividade
  DROP CONSTRAINT IF EXISTS logs_atividade_tabela_check;
ALTER TABLE public.logs_atividade
  ADD CONSTRAINT logs_atividade_tabela_check
  CHECK (tabela IN ('comanda', 'agendamento', 'servico', 'produto'));

-- =============================================
-- TRIGGER: servicos
-- =============================================
CREATE OR REPLACE FUNCTION public.log_atividade_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_usuario_nome text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM public.usuarios WHERE id = v_usuario_id;

  IF (tg_op = 'INSERT') THEN
    INSERT INTO public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, dados)
    VALUES ('servico', new.id, 'criar', v_usuario_id, v_usuario_nome, to_jsonb(new));
  ELSIF (tg_op = 'UPDATE') THEN
    INSERT INTO public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, dados)
    VALUES ('servico', new.id, 'editar', v_usuario_id, v_usuario_nome,
      jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
  END IF;

  RETURN COALESCE(new, old);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_servico ON public.servicos;
CREATE TRIGGER trg_log_servico
AFTER INSERT OR UPDATE ON public.servicos
FOR EACH ROW EXECUTE FUNCTION public.log_atividade_servico();

-- =============================================
-- TRIGGER: produtos
-- =============================================
CREATE OR REPLACE FUNCTION public.log_atividade_produto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_usuario_nome text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM public.usuarios WHERE id = v_usuario_id;

  IF (tg_op = 'INSERT') THEN
    INSERT INTO public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, dados)
    VALUES ('produto', new.id, 'criar', v_usuario_id, v_usuario_nome, new.unidade_id, to_jsonb(new));
  ELSIF (tg_op = 'UPDATE') THEN
    INSERT INTO public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, dados)
    VALUES ('produto', new.id, 'editar', v_usuario_id, v_usuario_nome, new.unidade_id,
      jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
  END IF;

  RETURN COALESCE(new, old);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_produto ON public.produtos;
CREATE TRIGGER trg_log_produto
AFTER INSERT OR UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.log_atividade_produto();
