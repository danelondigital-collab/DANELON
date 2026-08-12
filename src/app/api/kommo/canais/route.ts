import { NextRequest, NextResponse } from 'next/server'
import { canaisForRoute } from '@/lib/kommo'

export const dynamic = 'force-dynamic'

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
