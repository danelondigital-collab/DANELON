export type PerfilUsuario = 'admin' | 'gerente' | 'recepcionista' | 'operador'
export type StatusAgendamento = 'agendado' | 'confirmado' | 'em_atendimento' | 'concluido' | 'cancelado' | 'faltou'
export type StatusComanda = 'aberta' | 'fechada' | 'cancelada'
export type FormaPagamento = 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'misto'
export type TipoItemComanda = 'servico' | 'produto'

export interface Unidade {
  id: string
  nome: string
  cidade: string
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
  foto_url?: string
  comissao_padrao: number
  cor_agenda: string
  unidade_id: string
  unidade?: Unidade
  ativo: boolean
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
  estoque: number
  unidade_id?: string
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
  subtotal: number
  profissionais?: ComandaItemProfissional[]
  created_at: string
}

export interface Comanda {
  id: string
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
  valor_final: number
  forma_pagamento?: FormaPagamento
  observacoes?: string
  itens?: ComandaItem[]
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

// Relatório de comissionamento
export interface RelatorioComissao {
  profissional_id: string
  profissional_nome: string
  total_servicos: number
  total_valor_base: number
  total_comissao: number
  comandas_count: number
}
