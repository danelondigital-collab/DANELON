-- Adiciona as métricas de topo de funil (impressões, cliques/visualizações,
-- resultados) ao lançamento de investimento, além do valor gasto.
--
-- Até agora investimento_trafego só guardava quanto foi gasto. Pra ver o
-- "topo do funil que captação pra dentro das páginas" (impressão, visualização,
-- resultado reportado pela própria plataforma) é preciso guardar esses números
-- também — eles vêm dos relatórios que cada plataforma exporta (Google Ads,
-- Meta Ads Manager, TikTok Ads Manager), não tem integração ao vivo ainda.
--
-- Todos opcionais: lançamento antigo (só com valor) continua válido, e nem
-- toda plataforma reporta as três métricas do mesmo jeito.

alter table public.investimento_trafego
  add column if not exists impressoes bigint check (impressoes is null or impressoes >= 0),
  add column if not exists cliques bigint check (cliques is null or cliques >= 0),
  add column if not exists resultados bigint check (resultados is null or resultados >= 0);

comment on column public.investimento_trafego.impressoes is
  'Impressões reportadas pela própria plataforma no mês (Google/Meta/TikTok Ads Manager).';
comment on column public.investimento_trafego.cliques is
  'Cliques/visualizações reportados pela plataforma — não é o clique em botão de contato do site (esse já vem do GA4).';
comment on column public.investimento_trafego.resultados is
  'Resultado que a própria plataforma contabilizou (conversão, lead etc.) — a definição de "resultado" varia por plataforma, não é comparável 1:1 entre elas.';
