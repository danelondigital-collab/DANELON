-- =============================================
-- SCHEMA COMPLETO - DANELON SISTEMA DE COMANDAS
-- =============================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- =============================================
-- TABELA: unidades
-- =============================================
create table public.unidades (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  cidade text not null,
  telefone text,
  endereco text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: perfis de usuário (extensão do auth.users)
-- =============================================
create type public.perfil_usuario as enum ('admin', 'gerente', 'recepcionista');

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil public.perfil_usuario not null default 'recepcionista',
  unidade_id uuid references public.unidades(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: clientes
-- =============================================
create table public.clientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  telefone text,
  email text,
  cpf text,
  data_nascimento date,
  observacoes text,
  unidade_id uuid not null references public.unidades(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: profissionais
-- =============================================
create table public.profissionais (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  telefone text,
  email text,
  foto_url text,
  comissao_padrao numeric(5,2) not null default 0 check (comissao_padrao >= 0 and comissao_padrao <= 100),
  cor_agenda text not null default '#6366f1',
  unidade_id uuid not null references public.unidades(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: categorias de serviço
-- =============================================
create table public.categorias_servico (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text,
  created_at timestamptz not null default now()
);

-- =============================================
-- TABELA: serviços
-- =============================================
create table public.servicos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text,
  categoria_id uuid references public.categorias_servico(id),
  duracao_minutos integer not null default 60,
  preco numeric(10,2) not null default 0,
  comissao_servico numeric(5,2) not null default 0 check (comissao_servico >= 0 and comissao_servico <= 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: produtos
-- =============================================
create table public.produtos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  marca text,
  descricao text,
  preco_custo numeric(10,2) not null default 0,
  preco_venda numeric(10,2) not null default 0,
  estoque integer not null default 0,
  unidade_id uuid references public.unidades(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: agendamentos
-- =============================================
create type public.status_agendamento as enum ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'faltou');

create table public.agendamentos (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references public.clientes(id),
  unidade_id uuid not null references public.unidades(id),
  data_hora_inicio timestamptz not null,
  data_hora_fim timestamptz not null,
  status public.status_agendamento not null default 'agendado',
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: agendamento x profissional x serviço
-- =============================================
create table public.agendamento_itens (
  id uuid primary key default uuid_generate_v4(),
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id),
  servico_id uuid not null references public.servicos(id),
  created_at timestamptz not null default now()
);

-- =============================================
-- TABELA: comandas
-- =============================================
create type public.status_comanda as enum ('aberta', 'fechada', 'cancelada');
create type public.forma_pagamento as enum ('dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'misto');

create table public.comandas (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references public.clientes(id),
  unidade_id uuid not null references public.unidades(id),
  agendamento_id uuid references public.agendamentos(id),
  status public.status_comanda not null default 'aberta',
  data_abertura timestamptz not null default now(),
  data_fechamento timestamptz,
  valor_total numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  valor_final numeric(10,2) not null default 0,
  forma_pagamento public.forma_pagamento,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- TABELA: itens da comanda
-- =============================================
create type public.tipo_item_comanda as enum ('servico', 'produto');

create table public.comanda_itens (
  id uuid primary key default uuid_generate_v4(),
  comanda_id uuid not null references public.comandas(id) on delete cascade,
  tipo public.tipo_item_comanda not null,
  servico_id uuid references public.servicos(id),
  produto_id uuid references public.produtos(id),
  quantidade integer not null default 1,
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  created_at timestamptz not null default now(),
  constraint check_item_type check (
    (tipo = 'servico' and servico_id is not null and produto_id is null) or
    (tipo = 'produto' and produto_id is not null and servico_id is null)
  )
);

-- =============================================
-- TABELA: rateio de comissão por profissional no item
-- =============================================
create table public.comanda_item_profissionais (
  id uuid primary key default uuid_generate_v4(),
  comanda_item_id uuid not null references public.comanda_itens(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id),
  percentual_participacao numeric(5,2) not null check (percentual_participacao > 0 and percentual_participacao <= 100),
  percentual_comissao numeric(5,2) not null check (percentual_comissao >= 0 and percentual_comissao <= 100),
  valor_base numeric(10,2) not null,       -- subtotal × percentual_participacao
  valor_comissao numeric(10,2) not null,   -- valor_base × percentual_comissao
  created_at timestamptz not null default now(),
  unique(comanda_item_id, profissional_id)
);

-- =============================================
-- TRIGGERS: updated_at automático
-- =============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_unidades_updated_at before update on public.unidades for each row execute function public.handle_updated_at();
create trigger trg_usuarios_updated_at before update on public.usuarios for each row execute function public.handle_updated_at();
create trigger trg_clientes_updated_at before update on public.clientes for each row execute function public.handle_updated_at();
create trigger trg_profissionais_updated_at before update on public.profissionais for each row execute function public.handle_updated_at();
create trigger trg_servicos_updated_at before update on public.servicos for each row execute function public.handle_updated_at();
create trigger trg_produtos_updated_at before update on public.produtos for each row execute function public.handle_updated_at();
create trigger trg_agendamentos_updated_at before update on public.agendamentos for each row execute function public.handle_updated_at();
create trigger trg_comandas_updated_at before update on public.comandas for each row execute function public.handle_updated_at();

-- =============================================
-- TRIGGER: criar perfil ao registrar usuário
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'perfil')::public.perfil_usuario, 'recepcionista')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
alter table public.unidades enable row level security;
alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.profissionais enable row level security;
alter table public.categorias_servico enable row level security;
alter table public.servicos enable row level security;
alter table public.produtos enable row level security;
alter table public.agendamentos enable row level security;
alter table public.agendamento_itens enable row level security;
alter table public.comandas enable row level security;
alter table public.comanda_itens enable row level security;
alter table public.comanda_item_profissionais enable row level security;

-- Função auxiliar: retorna o perfil do usuário logado
create or replace function public.get_user_perfil()
returns public.perfil_usuario as $$
  select perfil from public.usuarios where id = auth.uid();
$$ language sql security definer stable;

-- Função auxiliar: retorna a unidade do usuário logado
create or replace function public.get_user_unidade_id()
returns uuid as $$
  select unidade_id from public.usuarios where id = auth.uid();
$$ language sql security definer stable;

-- Políticas: admin vê tudo, outros veem apenas sua unidade
-- UNIDADES
create policy "Usuários autenticados veem unidades" on public.unidades for select to authenticated using (true);
create policy "Admin gerencia unidades" on public.unidades for all to authenticated using (public.get_user_perfil() = 'admin');

-- USUÁRIOS
create policy "Usuário vê próprio perfil" on public.usuarios for select to authenticated using (id = auth.uid() or public.get_user_perfil() = 'admin');
create policy "Admin gerencia usuários" on public.usuarios for all to authenticated using (public.get_user_perfil() = 'admin');

-- CLIENTES
create policy "Usuários veem clientes da unidade" on public.clientes for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários gerenciam clientes da unidade" on public.clientes for insert to authenticated
  with check (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários atualizam clientes da unidade" on public.clientes for update to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

-- PROFISSIONAIS
create policy "Usuários veem profissionais da unidade" on public.profissionais for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários gerenciam profissionais da unidade" on public.profissionais for insert to authenticated
  with check (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários atualizam profissionais da unidade" on public.profissionais for update to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

-- CATEGORIAS E SERVIÇOS (global, todos veem)
create policy "Todos veem categorias" on public.categorias_servico for select to authenticated using (true);
create policy "Admin gerencia categorias" on public.categorias_servico for all to authenticated using (public.get_user_perfil() = 'admin');
create policy "Todos veem serviços" on public.servicos for select to authenticated using (true);
create policy "Admin/gerente gerencia serviços" on public.servicos for all to authenticated using (public.get_user_perfil() in ('admin', 'gerente'));

-- PRODUTOS
create policy "Usuários veem produtos da unidade" on public.produtos for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id() or unidade_id is null);
create policy "Usuários gerenciam produtos da unidade" on public.produtos for all to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

-- AGENDAMENTOS
create policy "Usuários veem agendamentos da unidade" on public.agendamentos for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários gerenciam agendamentos da unidade" on public.agendamentos for insert to authenticated
  with check (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários atualizam agendamentos da unidade" on public.agendamentos for update to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

-- AGENDAMENTO ITENS
create policy "Acesso via agendamento" on public.agendamento_itens for all to authenticated
  using (exists (
    select 1 from public.agendamentos a
    where a.id = agendamento_id
    and (public.get_user_perfil() = 'admin' or a.unidade_id = public.get_user_unidade_id())
  ));

-- COMANDAS
create policy "Usuários veem comandas da unidade" on public.comandas for select to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários gerenciam comandas da unidade" on public.comandas for insert to authenticated
  with check (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());
create policy "Usuários atualizam comandas da unidade" on public.comandas for update to authenticated
  using (public.get_user_perfil() = 'admin' or unidade_id = public.get_user_unidade_id());

-- COMANDA ITENS
create policy "Acesso via comanda" on public.comanda_itens for all to authenticated
  using (exists (
    select 1 from public.comandas c
    where c.id = comanda_id
    and (public.get_user_perfil() = 'admin' or c.unidade_id = public.get_user_unidade_id())
  ));

-- COMANDA ITEM PROFISSIONAIS
create policy "Acesso via comanda item" on public.comanda_item_profissionais for all to authenticated
  using (exists (
    select 1 from public.comanda_itens ci
    join public.comandas c on c.id = ci.comanda_id
    where ci.id = comanda_item_id
    and (public.get_user_perfil() = 'admin' or c.unidade_id = public.get_user_unidade_id())
  ));

-- =============================================
-- DADOS INICIAIS: categorias de serviço
-- =============================================
insert into public.categorias_servico (nome) values
  ('Corte'),
  ('Coloração'),
  ('Química'),
  ('Escova e Tratamento'),
  ('Tranças e Mega Hair'),
  ('Manicure e Pedicure'),
  ('Estética'),
  ('Outros');

-- =============================================
-- ÍNDICES para performance
-- =============================================
create index idx_clientes_unidade on public.clientes(unidade_id);
create index idx_clientes_nome on public.clientes(nome);
create index idx_clientes_telefone on public.clientes(telefone);
create index idx_profissionais_unidade on public.profissionais(unidade_id);
create index idx_agendamentos_unidade_data on public.agendamentos(unidade_id, data_hora_inicio);
create index idx_agendamentos_cliente on public.agendamentos(cliente_id);
create index idx_comandas_unidade_status on public.comandas(unidade_id, status);
create index idx_comandas_cliente on public.comandas(cliente_id);
create index idx_comanda_itens_comanda on public.comanda_itens(comanda_id);
create index idx_comanda_item_prof_item on public.comanda_item_profissionais(comanda_item_id);
create index idx_comanda_item_prof_profissional on public.comanda_item_profissionais(profissional_id);
