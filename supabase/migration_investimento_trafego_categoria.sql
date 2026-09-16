-- Adiciona a categoria da campanha ao lançamento de investimento, pra separar
-- o que é verba de Curso, de remarketing, das unidades, de alcance nacional e
-- de contratação. Sem isso o total da plataforma junta coisas com objetivos
-- completamente diferentes: a campanha que busca cliente novo e a que busca
-- funcionário entravam no mesmo bolo, distorcendo o custo por contato.
--
-- O remarketing fica dividido em dois porque são públicos e objetivos
-- distintos: "RMK Curso" reimpacta quem interagiu com o curso, "RMK Salão"
-- reimpacta quem interagiu com os perfis do salão.
--
-- Mesmo padrão da coluna unidade: default '' (string vazia) em vez de null,
-- pra entrar direto numa constraint unique de colunas simples — o upsert do
-- PostgREST só aceita lista simples de coluna no onConflict. '' representa
-- "lançamento sem categoria definida" (é o caso dos lançamentos antigos).

alter table public.investimento_trafego
  add column if not exists categoria text not null default '';

comment on column public.investimento_trafego.categoria is
  'Tipo de campanha: Curso, RMK Curso, RMK Salão, Unidades, País/Estados, Contratação. String vazia = lançamento sem categoria (anterior a esta divisão).';

alter table public.investimento_trafego
  drop constraint if exists investimento_trafego_plataforma_destino_mes_unidade_key;

alter table public.investimento_trafego
  drop constraint if exists investimento_trafego_plat_dest_mes_unid_categ_key;
alter table public.investimento_trafego
  add constraint investimento_trafego_plat_dest_mes_unid_categ_key
  unique (plataforma, destino, mes, unidade, categoria);
