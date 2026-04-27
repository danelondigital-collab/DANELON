-- Corrige e completa dados das unidades Danelon

-- Danelon Morumbi
update public.unidades
set
  razao_social = 'DANELON MORUMBI LTDA',
  cnpj         = '39.373.891/0001-67',
  email        = 'romulo@rededanelon.com'
where nome ilike '%morumbi%';

-- Danelon Alphaville
update public.unidades
set
  razao_social = 'DANELON ALPHAVILLE SERVIÇOS DE BELEZA LTDA',
  cnpj         = '48.465.310/0001-08',
  email        = 'diretoria@grupodanelon.com'
where nome ilike '%alphaville%';

-- Danelon Goiânia (unidade física em Santo André)
update public.unidades
set
  razao_social = 'DANELON GOIANIA SERVIÇOS DE BELEZA LTDA',
  cnpj         = '45.633.973/0001-04',
  email        = 'diretoria@grupodanelon.com'
where nome ilike '%goian%';

-- E.R.D. Prime Hair (Santo André)
update public.unidades
set
  razao_social = 'E.R.D. PRIME HAIR LTDA',
  cnpj         = '33.214.659/0001-08',
  email        = 'diretoria@grupodanelon.com'
where nome ilike '%prime%' or nome ilike '%erd%';
