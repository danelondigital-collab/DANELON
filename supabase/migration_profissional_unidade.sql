-- Adiciona campos ao profissionais
alter table public.profissionais
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists data_nascimento date,
  add column if not exists endereco text;

-- Adiciona campos à unidades
alter table public.unidades
  add column if not exists razao_social text,
  add column if not exists cnpj text,
  add column if not exists email text;

-- Atualiza dados da Danelon Morumbi
update public.unidades
set
  razao_social = 'DANELON MORUMBI LTDA',
  cnpj         = '39.373.891/0001-67',
  email        = 'romulo@rededanelon.com'
where nome ilike '%morumbi%';

-- Atualiza dados da Danelon Santo André (ajuste o nome conforme necessário)
update public.unidades
set
  razao_social = 'DANELON SANTO ANDRÉ LTDA'
where nome ilike '%santo andr%' and razao_social is null;
