-- Adiciona a unidade ao lançamento de investimento, pra dar suporte a um
-- funil POR UNIDADE (Morumbi, Santo André, Alphaville, Goiânia): da campanha
-- da Meta que leva pro perfil daquela unidade específica até o clique no
-- botão de contato daquela mesma unidade no site.
--
-- Continua opcional (null) porque nem todo lançamento é por unidade — Google
-- Ads e TikTok Ads, por exemplo, não segmentam campanha por unidade hoje, e a
-- Meta também tem campanha geral (Reconhecimento Nacional, RMK, Curso) que
-- não é de uma unidade só.

-- Fica com default '' (string vazia), não null: assim entra numa constraint
-- unique comum de colunas (plataforma, destino, mes, unidade) sem precisar de
-- índice funcional — o upsert do PostgREST só aceita lista simples de coluna
-- no onConflict. '' representa "lançamento geral, não é de uma unidade só".
alter table public.investimento_trafego
  add column if not exists unidade text not null default '';

comment on column public.investimento_trafego.unidade is
  'Unidade física da campanha (Morumbi, Santo André, Alphaville, Goiânia), quando aplicável. String vazia = lançamento geral/não segmentado por unidade.';

alter table public.investimento_trafego
  drop constraint if exists investimento_trafego_plataforma_destino_mes_key;

alter table public.investimento_trafego
  drop constraint if exists investimento_trafego_plataforma_destino_mes_unidade_key;
alter table public.investimento_trafego
  add constraint investimento_trafego_plataforma_destino_mes_unidade_key
  unique (plataforma, destino, mes, unidade);
