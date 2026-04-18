-- =============================================
-- TABELA: bloqueios_agenda
-- Registra dias/horários que uma profissional não irá trabalhar
-- =============================================
create table if not exists public.bloqueios_agenda (
  id uuid primary key default uuid_generate_v4(),
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  data date not null,
  hora_inicio time,
  hora_fim time,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bloqueios_profissional_data
  on public.bloqueios_agenda(profissional_id, data);

create index if not exists idx_bloqueios_unidade_data
  on public.bloqueios_agenda(unidade_id, data);

alter table public.bloqueios_agenda enable row level security;

create policy "Acesso total autenticado" on public.bloqueios_agenda
  for all using (auth.role() = 'authenticated');
