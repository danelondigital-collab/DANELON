import { NextRequest, NextResponse } from 'next/server'
import { countForRoute } from '@/lib/kommo'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { count, capped } = await countForRoute('leads', searchParams.get('start'), searchParams.get('end'))
    return NextResponse.json({ count, capped })
  } catch (error) {
    console.error('Erro ao buscar leads do Kommo:', error)
    if (error instanceof Error && error.message.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ error: error.message.replace('BAD_REQUEST: ', '') }, { status: 400 })
    }
    // TODO: remover "detail" depois de diagnosticar o problema em produção
    return NextResponse.json({
      error: 'Não foi possível carregar os dados do Kommo.',
      detail: error instanceof Error ? error.message : String(error),
      envCheck: {
        subdomain: Boolean(process.env.KOMMO_SUBDOMAIN),
        token: Boolean(process.env.KOMMO_ACCESS_TOKEN),
        tokenLength: process.env.KOMMO_ACCESS_TOKEN?.length || 0,
      },
    }, { status: 500 })
  }
}
