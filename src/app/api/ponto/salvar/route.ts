import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RegistroPonto {
  data: string
  entrada: string
  saida_almoco: string
  retorno_almoco: string
  saida: string
  horas_trabalhadas: string
  atraso_minutos: number
  falta: boolean
  observacoes: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { profissional_id, unidade_id, arquivo_nome, registros } = body as {
    profissional_id: string
    unidade_id: string
    arquivo_nome: string
    registros: RegistroPonto[]
  }

  if (!profissional_id || !unidade_id || !registros?.length) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const datas = registros.map(r => r.data).filter(Boolean).sort()

  // Criar registro de importação
  const { data: importacao, error: impErr } = await admin
    .from('ponto_importacoes')
    .insert({
      profissional_id,
      unidade_id,
      arquivo_nome,
      periodo_inicio: datas[0] || null,
      periodo_fim: datas[datas.length - 1] || null,
      total_registros: registros.length,
      importado_por: user.email,
    })
    .select('id')
    .single()

  if (impErr) return NextResponse.json({ error: impErr.message }, { status: 500 })

  // Salvar registros
  const rows = registros.map(r => ({
    importacao_id: importacao.id,
    profissional_id,
    unidade_id,
    data: r.data || null,
    entrada: r.entrada || null,
    saida_almoco: r.saida_almoco || null,
    retorno_almoco: r.retorno_almoco || null,
    saida: r.saida || null,
    horas_trabalhadas: r.horas_trabalhadas ? parseFloat(r.horas_trabalhadas) : null,
    atraso_minutos: r.atraso_minutos || 0,
    falta: r.falta || false,
    observacoes: r.observacoes || null,
  }))

  const { error: recErr } = await admin.from('ponto_registros').insert(rows)
  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 })

  return NextResponse.json({ success: true, importacao_id: importacao.id })
}
