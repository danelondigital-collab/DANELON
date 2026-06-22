-- =============================================
-- TABELA: pacotes
-- =============================================
create type public.status_pacote as enum ('aberto', 'finalizado', 'cancelado');

create sequence if not exists public.pacotes_numero_seq;

create table public.pacotes (
  id uuid primary key default uuid_generate_v4(),
  numero integer not null default nextval('public.pacotes_numero_seq'),
  cliente_id uuid not null references public.clientes(id),
  unidade_id uuid not null references public.unidades(id),
  vendedor_id uuid references public.profissionais(id),
  status public.status_pacote not null default 'aberto',
  data date not null default current_date,
  validade date,
  valor_total numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  credito_utilizado numeric(10,2) not null default 0,
  cashback numeric(10,2) not null default 0,
  valor_final numeric(10,2) not null default 0,
  observacao text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pacotes_numero_unidade_idx on public.pacotes(unidade_id, numero);

-- =============================================
-- TABELA: itens do pacote
-- =============================================
create table public.pacote_itens (
  id uuid primary key default uuid_generate_v4(),
  pacote_id uuid not null references public.pacotes(id) on delete cascade,
  servico_id uuid references public.servicos(id),
  descricao text not null,
  quantidade integer not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- =============================================
-- TRIGGER: updated_at automático
-- =============================================
create trigger trg_pacotes_updated_at before update on public.pacotes for each row execute function public.handle_updated_at();

-- =============================================
-- RLS
-- =============================================
alter table public.pacotes enable row level security;
alter table public.pacote_itens enable row level security;

create policy "Usuários veem pacotes da unidade" on public.pacotes for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários gerenciam pacotes da unidade" on public.pacotes for insert to authenticated
  with check (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários atualizam pacotes da unidade" on public.pacotes for update to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

create policy "Acesso via pacote" on public.pacote_itens for all to authenticated
  using (exists (
    select 1 from public.pacotes p
    where p.id = pacote_id
    and (public.get_user_perfil() = 'admin' or p.unidade_id = public.get_user_unidade_id())
  ));
