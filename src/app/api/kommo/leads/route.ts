import { NextRequest, NextResponse } from 'next/server'
import { countNewLeads } from '@/lib/kommo'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      return NextResponse.json({ error: 'Parâmetros start/end (yyyy-mm-dd) são obrigatórios.' }, { status: 400 })
    }

    const fromUnix = Math.floor(new Date(`${start}T00:00:00-03:00`).getTime() / 1000)
    const toUnix = Math.floor(new Date(`${end}T23:59:59-03:00`).getTime() / 1000)

    const { count, capped } = await countNewLeads(fromUnix, toUnix)

    return NextResponse.json({ count, capped })
  } catch (error) {
    console.error('Erro ao buscar leads do Kommo:', error)
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
