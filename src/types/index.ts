export type PerfilUsuario = 'admin' | 'gerente' | 'recepcionista' | 'operador'
export type StatusAgendamento = 'agendado' | 'confirmado' | 'em_atendimento' | 'concluido' | 'cancelado' | 'faltou'
export type StatusComanda = 'aberta' | 'fechada' | 'cancelada'
export type FormaPagamento = 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'credito_avista' | 'credito_parcelado' | 'pix' | 'misto' | 'retrabalho' | 'avaliacao'
export type TipoItemComanda = 'servico' | 'produto'

export interface Unidade {
  id: string
  nome: string
  cidade: string
  razao_social?: string
  cnpj?: string
  email?: string
  telefone?: string
  endereco?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  unidade_id?: string
  unidade?: Unidade
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  nome: string
  telefone?: string
  email?: string
  cpf?: string
  data_nascimento?: string
  observacoes?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  unidade_id: string
  unidade?: Unidade
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Profissional {
  id: string
  nome: string
  telefone?: string
  email?: string
  cpf?: string
  rg?: string
  cnpj?: string
  data_nascimento?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  estado?: string
  cidade?: string
  cargo?: string
  foto_url?: string
  comissao_padrao: number
  cor_agenda: string
  unidade_id: string
  unidade?: Unidade
  ativo: boolean
  gerar_agenda: boolean
  recebe_comissao: boolean
  disponivel_agendamento_online: boolean
  contratado_lei_salao_parceiro: boolean
  created_at: string
  updated_at: string
}

export interface CategoriaServico {
  id: string
  nome: string
  descricao?: string
  created_at: string
}

export interface Servico {
  id: string
  nome: string
  descricao?: string
  categoria_id?: string
  categoria?: CategoriaServico
  duracao_minutos: number
  preco: number
  comissao_servico: number
  ativo: boolean
  aparece_relatorio_vendas: boolean
  created_at: string
  updated_at: string
}

export interface Produto {
  id: string
  nome: string
  marca?: string
  descricao?: string
  preco_custo: number
  preco_venda: number
  comissao_produto: number
  estoque: number
  unidade_id?: string
  classificacao?: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface AgendamentoItem {
  id: string
  agendamento_id: string
  profissional_id: string
  profissional?: Profissional
  servico_id: string
  servico?: Servico
  data_hora_inicio?: string
  data_hora_fim?: string
  created_at: string
}

export interface Agendamento {
  id: string
  cliente_id: string
  cliente?: Cliente
  unidade_id: string
  unidade?: Unidade
  data_hora_inicio: string
  data_hora_fim: string
  status: StatusAgendamento
  observacoes?: string
  sinal?: number
  itens?: AgendamentoItem[]
  created_at: string
  updated_at: string
}

export interface ComandaItemProfissional {
  id: string
  comanda_item_id: string
  profissional_id: string
  profissional?: Profissional
  percentual_participacao: number
  percentual_comissao: number
  valor_base: number
  valor_comissao: number
  created_at: string
}

export interface ComandaItem {
  id: string
  comanda_id: string
  tipo: TipoItemComanda
  servico_id?: string
  servico?: Servico
  produto_id?: string
  produto?: Produto
  quantidade: number
  preco_unitario: number
  desconto_percentual: number
  subtotal: number
  pacote_item_id?: string
  profissionais?: ComandaItemProfissional[]
  created_at: string
}

export interface Comanda {
  id: string
  numero?: string
  cliente_id: string
  cliente?: Cliente
  unidade_id: string
  unidade?: Unidade
  agendamento_id?: string
  status: StatusComanda
  data_abertura: string
  data_fechamento?: string
  valor_total: number
  desconto: number
  credito_utilizado: number
  sinal: number
  valor_final: number
  forma_pagamento?: FormaPagamento
  pagamentos?: { forma: string; valor: number }[]
  observacoes?: string
  itens?: ComandaItem[]
  created_at: string
  updated_at: string
}

export interface CreditoCliente {
  id: string
  cliente_id: string
  comanda_id?: string
  tipo: 'entrada' | 'saida'
  valor: number
  descricao?: string
  created_at: string
}

export type StatusPacote = 'aberto' | 'finalizado' | 'cancelado'

export interface PacoteItem {
  id: string
  pacote_id: string
  servico_id?: string
  servico?: Servico
  descricao: string
  quantidade: number
  quantidade_usada: number
  valor_unitario: number
  desconto: number
  total: number
  created_at: string
}

export interface Pacote {
  id: string
  numero: number
  cliente_id: string
  cliente?: Cliente
  unidade_id: string
  vendedor_id?: string
  vendedor?: Profissional
  status: StatusPacote
  data: string
  validade?: string
  valor_total: number
  desconto: number
  credito_utilizado: number
  cashback: number
  valor_final: number
  forma_pagamento?: FormaPagamento
  observacao?: string
  itens?: PacoteItem[]
  created_at: string
  updated_at: string
}

export interface PacotePredefinidoItem {
  id: string
  pacote_predefinido_id: string
  servico_id?: string
  servico?: Servico
  descricao: string
  quantidade: number
  valor_unitario: number
  created_at: string
}

export interface PacotePredefinido {
  id: string
  unidade_id: string
  nome: string
  ativo: boolean
  itens?: PacotePredefinidoItem[]
  created_at: string
  updated_at: string
}

export interface UsuarioUnidade {
  id: string
  usuario_id: string
  unidade_id: string
  unidade?: Unidade
  perfil: PerfilUsuario
  created_at: string
}

export interface BloqueioAgenda {
  id: string
  profissional_id: string
  profissional?: Profissional
  unidade_id: string
  data: string // YYYY-MM-DD
  hora_inicio?: string | null // HH:MM
  hora_fim?: string | null // HH:MM
  motivo?: string | null
  created_at: string
}

export interface ComissaoHistorico {
  id: string
  profissional_id: string
  unidade_id: string
  vencimento: string
  item: string
  valor: number
  historico?: string
  status: 'pago' | 'pendente'
  created_at: string
}

export interface ComissaoProfissionalItem {
  id: string
  profissional_id: string
  tipo: 'servico' | 'produto'
  servico_id?: string
  servico?: { id: string; nome: string }
  produto_id?: string
  produto?: { id: string; nome: string }
  percentual: number
  created_at: string
}

// Relatório de comissionamento
export interface RelatorioComissao {
  profissional_id: string
  profissional_nome: string
  total_servicos: number
  total_valor_base: number
  total_comissao: number
  comandas_count: number
}

export interface LogAtividade {
  id: string
  tabela: 'comanda' | 'agendamento' | 'servico' | 'produto'
  registro_id: string
  acao: 'criar' | 'editar' | 'excluir'
  usuario_id: string | null
  usuario_nome: string | null
  unidade_id: string | null
  profissional_ids: string[]
  cliente_nome: string | null
  dados: unknown
  created_at: string
}
