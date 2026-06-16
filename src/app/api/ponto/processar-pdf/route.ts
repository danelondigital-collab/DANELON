import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseFolhaPontoGenyo } from '@/lib/ponto/parser-genyo'
import { parseFolhaPontoGenyoExcel } from '@/lib/ponto/parser-genyo-excel'
import { calcularMes } from '@/lib/ponto/calcular'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const profissional_id = form.get('profissional_id') as string
  const unidade_id = form.get('unidade_id') as string
  const horario_entrada = form.get('horario_entrada') as string
  const horario_saida = form.get('horario_saida') as string
  const intervalo_minutos = parseInt(form.get('intervalo_minutos') as string || '60')
  const arquivo_nome = file?.name ?? 'folha-ponto.pdf'

  if (!file || !profissional_id || !unidade_id || !horario_entrada || !horario_saida) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const nome = file.name.toLowerCase()
  const isExcel = nome.endsWith('.xls') || nome.endsWith('.xlsx')

  let folha
  if (isExcel) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    folha = parseFolhaPontoGenyoExcel(rows)
  } else {
    // PDF
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const { text } = await pdfParse(buffer)
    folha = parseFolhaPontoGenyo(text)
  }

  if (folha.dias.length === 0) {
    return NextResponse.json({ error: 'Não foi possível extrair registros do PDF. Verifique se é um relatório Folha de Ponto do Gênio.' }, { status: 400 })
  }

  const resumo = calcularMes(folha.dias, horario_entrada, horario_saida, intervalo_minutos ?? 60)

  const { data: importacao, error: impErr } = await admin
    .from('ponto_importacoes')
    .insert({
      profissional_id,
      unidade_id,
      arquivo_nome,
      periodo_inicio: folha.periodoInicio || null,
      periodo_fim: folha.periodoFim || null,
      total_dias_trabalhados: resumo.totalDiasTrabalhados,
      he50_minutos: resumo.he50Min,
      he100_minutos: resumo.he100Min,
      intervalo_suprimido_minutos: resumo.intervaloSuprimidoMin,
      horas_negativas_minutos: resumo.horasNegativasMin,
      faltas_sem_justificativa: resumo.faltasSemJustificativa,
      importado_por: user.email,
    })
    .select('id')
    .single()

  if (impErr) return NextResponse.json({ error: impErr.message }, { status: 500 })

  const rows = resumo.diasAnalisados.map(d => ({
    importacao_id: importacao.id,
    profissional_id,
    unidade_id,
    data: (() => {
      const [dd, mm, yyyy] = d.data.split('/')
      return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
    })(),
    dia_semana: d.diaSemana,
    e1: d.e1,
    s1: d.s1,
    e2: d.e2,
    s2: d.s2,
    marcacoes_raw: d.genyoTrabalhadas ? d.data : '',
    tipo_dia: d.tipoDia,
    ocorrencia_descricao: d.ocorrenciaDescricao,
    genyo_previstas: d.genyoPrevistas,
    genyo_trabalhadas: d.genyoTrabalhadas,
    genyo_abonos: d.genyoAbonos,
    genyo_saldo: d.genyoSaldo,
    delta_entrada_min: d.deltaEntradaMin,
    delta_saida_min: d.deltaSaidaMin,
    saldo_dia_min: d.saldoDiaMin,
    intervalo_real_min: d.intervaloRealMin,
    intervalo_suprimido_min: d.intervaloSuprimidoMin,
    he100_min: d.he100Min,
  }))

  const { error: regErr } = await admin.from('ponto_registros').insert(rows)
  if (regErr) {
    await admin.from('ponto_importacoes').delete().eq('id', importacao.id)
    return NextResponse.json({ error: regErr.message }, { status: 500 })
  }

  await admin.from('profissionais').update({
    horario_entrada,
    horario_saida,
    intervalo_minutos,
  }).eq('id', profissional_id)

  return NextResponse.json({ success: true, importacao_id: importacao.id })
}
