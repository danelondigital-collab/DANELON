import { NextRequest, NextResponse } from 'next/server'
import { funilFundoForRoute } from '@/lib/kommo'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Pagina a lista de conversas até sair do período pedido (a API da Kommo não
// filtra por data nesse endpoint), então precisa de mais que os 10s padrão.
export const maxDuration = 60

interface IniciativaRow {
  canal: string
  periodo_inicio: string
  periodo_fim: string
  total: number
  cliente_iniciou: number
  nos_iniciamos: number
  calculado_em: string
}

/**
 * Quem mandou a primeira mensagem de cada conversa, por canal — vem de um
 * snapshot pré-calculado (ver scripts/kommo_iniciativa.py), não é ao vivo.
 * Varrer isso de verdade exige buscar todo o histórico de eventos de mensagem
 * do período (a Kommo não filtra por lead), o que passa de 5 minutos para
 * 28 dias — inviável dentro do limite de uma rota da Vercel. Por isso só lê
 * o snapshot mais recente por canal; se nunca rodou o script, volta vazio e
 * o relatório mostra os números sem essa quebra em vez de travar.
 */
async function iniciativaMaisRecente() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('kommo_iniciativa_snapshot')
      .select('canal, periodo_inicio, periodo_fim, total, cliente_iniciou, nos_iniciamos, calculado_em')
      .order('calculado_em', { ascending: false })
    if (error || !data) return []

    // Um snapshot por canal: o mais recente já calculado pra ele.
    const porCanal = new Map<string, IniciativaRow>()
    for (const row of data as IniciativaRow[]) {
      if (!porCanal.has(row.canal)) porCanal.set(row.canal, row)
    }
    return Array.from(porCanal.values())
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const [result, iniciativa] = await Promise.all([
      funilFundoForRoute(searchParams.get('start'), searchParams.get('end')),
      iniciativaMaisRecente(),
    ])
    return NextResponse.json({
      ...result,
      conversas: {
        ...result.conversas,
        iniciativa: iniciativa.map(row => ({
          canal: row.canal,
          total: row.total,
          clienteIniciou: row.cliente_iniciou,
          nosIniciamos: row.nos_iniciamos,
          periodoInicio: row.periodo_inicio,
          periodoFim: row.periodo_fim,
          calculadoEm: row.calculado_em,
        })),
      },
    })
  } catch (error) {
    console.error('Erro ao montar o fundo do funil (Kommo):', error)
    if (error instanceof Error && error.message.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ error: error.message.replace('BAD_REQUEST: ', '') }, { status: 400 })
    }
    return NextResponse.json({ error: 'Não foi possível carregar os dados do Kommo.' }, { status: 500 })
  }
}
