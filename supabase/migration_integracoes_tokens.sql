-- =============================================
-- TABELA: integracoes_tokens
-- Guarda tokens de integrações externas que precisam ser renovados
-- periodicamente pelo próprio servidor. Acesso só pelo service role.
-- OBS: não está em uso hoje (o Kommo foi integrado com um token de
-- longa duração via KOMMO_ACCESS_TOKEN); mantida para uma futura
-- integração via OAuth com renovação automática, se precisar.
-- =============================================

create table if not exists public.integracoes_tokens (
  provider text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.integracoes_tokens enable row level security;

drop policy if exists "Sem acesso via API pública" on public.integracoes_tokens;
create policy "Sem acesso via API pública" on public.integracoes_tokens for all
  using (false);
