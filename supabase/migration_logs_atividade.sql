-- =============================================
-- TABELA: logs_atividade
-- Auditoria de criação/edição/exclusão de comandas e agendamentos
-- =============================================

create table if not exists public.logs_atividade (
  id uuid primary key default gen_random_uuid(),
  tabela text not null check (tabela in ('comanda', 'agendamento')),
  registro_id uuid not null,
  acao text not null check (acao in ('criar', 'editar', 'excluir')),
  usuario_id uuid references auth.users(id),
  usuario_nome text,
  unidade_id uuid references public.unidades(id),
  profissional_ids uuid[] not null default '{}',
  cliente_nome text,
  dados jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_logs_atividade_registro on public.logs_atividade(tabela, registro_id);
create index if not exists idx_logs_atividade_unidade on public.logs_atividade(unidade_id);
create index if not exists idx_logs_atividade_created on public.logs_atividade(created_at desc);
create index if not exists idx_logs_atividade_profissionais on public.logs_atividade using gin (profissional_ids);

alter table public.logs_atividade enable row level security;

drop policy if exists "Leitura logs apenas admin" on public.logs_atividade;
create policy "Leitura logs apenas admin" on public.logs_atividade for select to authenticated
  using (public.get_user_perfil() = 'admin');

-- =============================================
-- TRIGGER: comandas
-- =============================================
create or replace function public.log_atividade_comanda()
returns trigger
language plpgsql
security definer
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_usuario_nome text;
  v_profissionais uuid[];
  v_cliente_nome text;
  v_unidade_id uuid;
  v_registro_id uuid := coalesce(new.id, old.id);
begin
  select nome into v_usuario_nome from public.usuarios where id = v_usuario_id;

  select array_agg(distinct cip.profissional_id) into v_profissionais
  from public.comanda_itens ci
  join public.comanda_item_profissionais cip on cip.comanda_item_id = ci.id
  where ci.comanda_id = v_registro_id;

  select nome into v_cliente_nome from public.clientes where id = coalesce(new.cliente_id, old.cliente_id);
  v_unidade_id := coalesce(new.unidade_id, old.unidade_id);

  if (tg_op = 'INSERT') then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, profissional_ids, cliente_nome, dados)
    values ('comanda', new.id, 'criar', v_usuario_id, v_usuario_nome, v_unidade_id, coalesce(v_profissionais, '{}'), v_cliente_nome, to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, profissional_ids, cliente_nome, dados)
    values ('comanda', new.id, 'editar', v_usuario_id, v_usuario_nome, v_unidade_id, coalesce(v_profissionais, '{}'), v_cliente_nome,
      jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
  elsif (tg_op = 'DELETE') then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, profissional_ids, cliente_nome, dados)
    values ('comanda', old.id, 'excluir', v_usuario_id, v_usuario_nome, v_unidade_id, coalesce(v_profissionais, '{}'), v_cliente_nome, to_jsonb(old));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_comanda_iu on public.comandas;
create trigger trg_log_comanda_iu
after insert or update on public.comandas
for each row execute function public.log_atividade_comanda();

drop trigger if exists trg_log_comanda_d on public.comandas;
create trigger trg_log_comanda_d
before delete on public.comandas
for each row execute function public.log_atividade_comanda();

-- =============================================
-- TRIGGER: agendamentos
-- =============================================
create or replace function public.log_atividade_agendamento()
returns trigger
language plpgsql
security definer
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_usuario_nome text;
  v_profissionais uuid[];
  v_cliente_nome text;
  v_unidade_id uuid;
  v_registro_id uuid := coalesce(new.id, old.id);
begin
  select nome into v_usuario_nome from public.usuarios where id = v_usuario_id;

  select array_agg(distinct profissional_id) into v_profissionais
  from public.agendamento_itens
  where agendamento_id = v_registro_id;

  select nome into v_cliente_nome from public.clientes where id = coalesce(new.cliente_id, old.cliente_id);
  v_unidade_id := coalesce(new.unidade_id, old.unidade_id);

  if (tg_op = 'INSERT') then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, profissional_ids, cliente_nome, dados)
    values ('agendamento', new.id, 'criar', v_usuario_id, v_usuario_nome, v_unidade_id, coalesce(v_profissionais, '{}'), v_cliente_nome, to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, profissional_ids, cliente_nome, dados)
    values ('agendamento', new.id, 'editar', v_usuario_id, v_usuario_nome, v_unidade_id, coalesce(v_profissionais, '{}'), v_cliente_nome,
      jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
  elsif (tg_op = 'DELETE') then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, usuario_nome, unidade_id, profissional_ids, cliente_nome, dados)
    values ('agendamento', old.id, 'excluir', v_usuario_id, v_usuario_nome, v_unidade_id, coalesce(v_profissionais, '{}'), v_cliente_nome, to_jsonb(old));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_agendamento_iu on public.agendamentos;
create trigger trg_log_agendamento_iu
after insert or update on public.agendamentos
for each row execute function public.log_atividade_agendamento();

drop trigger if exists trg_log_agendamento_d on public.agendamentos;
create trigger trg_log_agendamento_d
before delete on public.agendamentos
for each row execute function public.log_atividade_agendamento();
