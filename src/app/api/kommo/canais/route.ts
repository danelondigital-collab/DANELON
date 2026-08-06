import { NextResponse } from 'next/server'
import { channelsByUnidade } from '@/lib/kommo'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await channelsByUnidade()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar canais do Kommo:', error)
    // TODO: remover "detail" depois de diagnosticar o problema em produção
    return NextResponse.json({
      error: 'Não foi possível carregar os canais do Kommo.',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
