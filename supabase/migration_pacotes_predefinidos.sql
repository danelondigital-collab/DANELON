-- =============================================
-- TABELA: pacotes predefinidos (modelos reutilizáveis)
-- =============================================
create table public.pacotes_predefinidos (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references public.unidades(id),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pacotes_predefinidos_itens (
  id uuid primary key default uuid_generate_v4(),
  pacote_predefinido_id uuid not null references public.pacotes_predefinidos(id) on delete cascade,
  servico_id uuid references public.servicos(id),
  descricao text not null,
  quantidade integer not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create trigger trg_pacotes_predefinidos_updated_at before update on public.pacotes_predefinidos for each row execute function public.handle_updated_at();

-- =============================================
-- RLS
-- =============================================
alter table public.pacotes_predefinidos enable row level security;
alter table public.pacotes_predefinidos_itens enable row level security;

create policy "Usuários veem pacotes predefinidos da unidade" on public.pacotes_predefinidos for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários gerenciam pacotes predefinidos da unidade" on public.pacotes_predefinidos for insert to authenticated
  with check (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários atualizam pacotes predefinidos da unidade" on public.pacotes_predefinidos for update to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários removem pacotes predefinidos da unidade" on public.pacotes_predefinidos for delete to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

create policy "Acesso via pacote predefinido" on public.pacotes_predefinidos_itens for all to authenticated
  using (exists (
    select 1 from public.pacotes_predefinidos pp
    where pp.id = pacote_predefinido_id
    and (public.get_user_perfil() = 'admin' or pp.unidade_id = public.get_user_unidade_id())
  ));
