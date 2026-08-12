import { NextRequest, NextResponse } from 'next/server'
import { canaisForRoute } from '@/lib/kommo'

export const dynamic = 'force-dynamic'
// Esse endpoint pagina a lista inteira até sair do período pedido (a API da Kommo
// não filtra por data aqui), então pode levar mais que o padrão de 10s da Vercel.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const result = await canaisForRoute(searchParams.get('start'), searchParams.get('end'))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar canais do Kommo:', error)
    if (error instanceof Error && error.message.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ error: error.message.replace('BAD_REQUEST: ', '') }, { status: 400 })
    }
    // TODO: remover "detail" depois de diagnosticar o problema em produção
    return NextResponse.json({
      error: 'Não foi possível carregar os canais do Kommo.',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
