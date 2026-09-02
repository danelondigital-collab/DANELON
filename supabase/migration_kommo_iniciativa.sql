-- Quem mandou a primeira mensagem em cada conversa nova do Kommo, por canal.
--
-- "Conversas recebidas" (funilFundo) conta toda conversa nova que caiu na caixa
-- de entrada, mas não diz quem começou: uma boa parte — sobretudo no Instagram —
-- é a própria equipe (ou automação) mandando a primeira mensagem, não a pessoa
-- procurando a Danelon por conta própria. Sem separar isso, "conversas recebidas"
-- infla o resultado do tráfego pago com contato que a gente foi buscar.
--
-- Calculado à parte (não em toda carga da página) porque a única forma de saber
-- quem mandou a primeira mensagem é varrer os eventos de mensagem do Kommo
-- (incoming_chat_message / outgoing_chat_message), e isso não dá pra filtrar por
-- lead na API do Kommo — precisa buscar TODOS os eventos do período e cruzar.
-- Pra 28 dias isso leva ~5 minutos, bem acima do limite de 60s de uma rota da
-- Vercel. Por isso roda como script avulso (scripts/kommo_iniciativa.py) e
-- guarda o resultado aqui; o relatório lê o snapshot mais recente.

create table if not exists public.kommo_iniciativa_snapshot (
  id uuid primary key default uuid_generate_v4(),

  -- Precisa bater com o nome usado em funilFundo (CANAL_LABEL): 'WhatsApp',
  -- 'Instagram (DM)', 'TikTok (DM)', 'Facebook'.
  canal text not null,

  periodo_inicio date not null,
  periodo_fim date not null,

  total int not null check (total >= 0),
  cliente_iniciou int not null check (cliente_iniciou >= 0),
  nos_iniciamos int not null check (nos_iniciamos >= 0),

  calculado_em timestamptz not null default now(),

  -- Rodar o script de novo pro mesmo canal/período atualiza em vez de duplicar.
  unique (canal, periodo_inicio, periodo_fim)
);

create index if not exists idx_kommo_iniciativa_periodo
  on public.kommo_iniciativa_snapshot (periodo_fim desc);

-- RLS: mesmo critério do resto do funil — só admin.
alter table public.kommo_iniciativa_snapshot enable row level security;

drop policy if exists "Admin vê iniciativa Kommo" on public.kommo_iniciativa_snapshot;
create policy "Admin vê iniciativa Kommo" on public.kommo_iniciativa_snapshot
  for select to authenticated
  using (public.get_user_perfil() = 'admin');

drop policy if exists "Admin gerencia iniciativa Kommo" on public.kommo_iniciativa_snapshot;
create policy "Admin gerencia iniciativa Kommo" on public.kommo_iniciativa_snapshot
  for all to authenticated
  using (public.get_user_perfil() = 'admin')
  with check (public.get_user_perfil() = 'admin');
