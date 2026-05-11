-- Metas diárias de venda por produto para controle de estoque no CRM
create table public.estoque_metas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  quantidade_meta integer not null default 0 check (quantidade_meta >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(produto_id)
);

alter table public.estoque_metas enable row level security;

create policy "admins_all" on public.estoque_metas
  for all
  using (get_user_perfil() = 'admin')
  with check (get_user_perfil() = 'admin');
