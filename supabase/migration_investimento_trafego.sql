-- Investimento em tráfego pago, lançado por plataforma e mês.
--
-- Serve pra cruzar com os números do funil (/crm/relatorios/funil) e calcular
-- custo por visita e custo por contato de cada plataforma. Sem isso o relatório
-- mostra volume e qualidade, mas não mostra quanto cada contato custou.
--
-- Guardado por MÊS (não um total solto) porque o relatório tem filtro de
-- período: assim o gasto acompanha o filtro em vez de ser um número fixo.

create table if not exists public.investimento_trafego (
  id uuid primary key default uuid_generate_v4(),

  -- Precisa bater com o nome do grupo usado no relatório de funil pra
  -- conseguir cruzar: 'TikTok Ads', 'Google Ads', 'Meta'.
  plataforma text not null,

  -- Só faz sentido pra Meta, que tem campanha levando pro perfil do Instagram
  -- e campanha levando direto pro site. São coisas diferentes no funil: a que
  -- leva pro perfil não vira visita no site, então misturar distorce o custo
  -- por contato. Nas outras plataformas fica 'site'.
  destino text not null default 'site' check (destino in ('site', 'perfil')),

  -- Sempre o dia 1 do mês de referência (ex: 2026-08-01).
  mes date not null,

  valor numeric(12,2) not null check (valor >= 0),
  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Um lançamento por plataforma/destino/mês. Relançar o mesmo mês atualiza
  -- em vez de duplicar (o app usa upsert com esse conflito).
  unique (plataforma, destino, mes)
);

create index if not exists idx_investimento_trafego_mes
  on public.investimento_trafego (mes);

-- updated_at automático, seguindo o padrão das outras tabelas
drop trigger if exists trg_investimento_trafego_updated_at on public.investimento_trafego;
create trigger trg_investimento_trafego_updated_at
  before update on public.investimento_trafego
  for each row execute function public.handle_updated_at();

-- RLS: dado financeiro da empresa inteira, não é de unidade nenhuma.
-- Só admin enxerga e mexe, mesmo critério do resto do CRM.
alter table public.investimento_trafego enable row level security;

drop policy if exists "Admin vê investimento" on public.investimento_trafego;
create policy "Admin vê investimento" on public.investimento_trafego
  for select to authenticated
  using (public.get_user_perfil() = 'admin');

drop policy if exists "Admin gerencia investimento" on public.investimento_trafego;
create policy "Admin gerencia investimento" on public.investimento_trafego
  for all to authenticated
  using (public.get_user_perfil() = 'admin')
  with check (public.get_user_perfil() = 'admin');
