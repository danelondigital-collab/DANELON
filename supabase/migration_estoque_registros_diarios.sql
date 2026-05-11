-- Snapshot diário de estoque por produto para relatórios históricos
create table public.estoque_registros_diarios (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id),
  data date not null,
  quantidade_vendida integer not null default 0,
  estoque_atual integer not null default 0,
  meta_diaria integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(produto_id, data)
);

alter table public.estoque_registros_diarios enable row level security;

create policy "admins_all" on public.estoque_registros_diarios
  for all
  using (get_user_perfil() = 'admin')
  with check (get_user_perfil() = 'admin');

create index on public.estoque_registros_diarios (data desc);
create index on public.estoque_registros_diarios (unidade_id, data desc);
