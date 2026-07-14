import type { SupabaseClient } from '@supabase/supabase-js'

type TabelaLog = 'comanda' | 'agendamento' | 'servico' | 'produto'
type AcaoLog = 'criar' | 'editar' | 'excluir'

export async function registrarLog(
  supabase: SupabaseClient,
  params: {
    tabela: TabelaLog
    registroId: string
    acao: AcaoLog
    unidadeId?: string | null
    dados?: unknown
  }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nome')
    .eq('id', user.id)
    .single()

  await supabase.from('logs_atividade').insert({
    tabela: params.tabela,
    registro_id: params.registroId,
    acao: params.acao,
    usuario_id: user.id,
    usuario_nome: usuario?.nome || user.email || 'Usuário',
    unidade_id: params.unidadeId || null,
    dados: params.dados || null,
  })
}
