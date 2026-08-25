import { NextRequest, NextResponse } from 'next/server'
import { funilFundoForRoute } from '@/lib/kommo'

export const dynamic = 'force-dynamic'
// Pagina a lista de conversas até sair do período pedido (a API da Kommo não
// filtra por data nesse endpoint), então precisa de mais que os 10s padrão.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const result = await funilFundoForRoute(searchParams.get('start'), searchParams.get('end'))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao montar o fundo do funil (Kommo):', error)
    if (error instanceof Error && error.message.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ error: error.message.replace('BAD_REQUEST: ', '') }, { status: 400 })
    }
    return NextResponse.json({ error: 'Não foi possível carregar os dados do Kommo.' }, { status: 500 })
  }
}
