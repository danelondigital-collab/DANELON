-- Adiciona campo de desconto percentual por item na comanda
alter table public.comanda_itens
  add column if not exists desconto_percentual numeric(5,2) not null default 0;
