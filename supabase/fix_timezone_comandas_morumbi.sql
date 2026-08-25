-- Corrige o bug de fuso horario nas comandas da Morumbi.
--
-- As importacoes (scripts Python) gravavam data_abertura/data_fechamento
-- como "AAAA-MM-DDT00:00:00" sem indicar fuso -- o Postgres interpreta
-- isso como UTC. Meia-noite UTC de um dia D e 21h de (D-1) em Brasilia
-- (UTC-3), entao qualquer relatorio/tela que mostra a data em horario
-- local exibe um dia a menos do que a venda realmente aconteceu.
--
-- Escopo: so comandas da unidade Morumbi cujo horario cai EXATAMENTE na
-- virada do dia UTC (extract(epoch)::bigint % 86400 = 0) -- essa e a
-- assinatura do bug; uma comanda aberta de verdade durante o expediente
-- nunca cai bem nesse instante. Confirmado por consulta previa: 26.256
-- comandas da Morumbi batem esse criterio.
--
-- Passo 1: roda o passo 1, confere a contagem no resultado.
-- Passo 2: se a contagem bater com o esperado (26256), roda o passo 2.
-- Passo 3 (guardado no fim do arquivo): so usar se precisar reverter.

-- =====================================================================
-- PASSO 1 -- snapshot dos valores originais (permite reverter depois)
-- =====================================================================
create table if not exists public._backup_fix_tz_comandas_morumbi (
  id uuid primary key,
  data_abertura_antes timestamptz not null,
  data_fechamento_antes timestamptz,
  aplicado_em timestamptz not null default now()
);

insert into public._backup_fix_tz_comandas_morumbi (id, data_abertura_antes, data_fechamento_antes)
select id, data_abertura, data_fechamento
from public.comandas
where unidade_id = '7649a21a-2018-4758-960c-fe56041cfbc8'  -- Danelon Morumbi
  and extract(epoch from data_abertura)::bigint % 86400 = 0
on conflict (id) do nothing;

-- confira aqui: deveria dar 26256
select count(*) as linhas_no_backup from public._backup_fix_tz_comandas_morumbi;

-- =====================================================================
-- PASSO 2 -- aplica a correcao (+3h em quem esta no backup)
-- =====================================================================
update public.comandas c
set
  data_abertura   = c.data_abertura + interval '3 hours',
  data_fechamento = case when c.data_fechamento is not null
                         then c.data_fechamento + interval '3 hours'
                         else c.data_fechamento end
from public._backup_fix_tz_comandas_morumbi b
where c.id = b.id;

-- confira aqui: deveria dar 0 (nenhuma comanda da Morumbi cai mais na
-- virada exata do dia UTC)
select count(*) as ainda_com_bug
from public.comandas
where unidade_id = '7649a21a-2018-4758-960c-fe56041cfbc8'
  and extract(epoch from data_abertura)::bigint % 86400 = 0;

-- =====================================================================
-- PASSO 3 -- SO RODAR SE PRECISAR REVERTER (deixe comentado por padrao)
-- =====================================================================
-- update public.comandas c
-- set data_abertura = b.data_abertura_antes,
--     data_fechamento = b.data_fechamento_antes
-- from public._backup_fix_tz_comandas_morumbi b
-- where c.id = b.id;
--
-- depois de confirmar que reverteu certo, pode apagar a tabela de backup:
-- drop table public._backup_fix_tz_comandas_morumbi;
