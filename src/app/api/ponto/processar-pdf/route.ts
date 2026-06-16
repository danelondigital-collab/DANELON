import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseFolhaPontoGenyo } from '@/lib/ponto/parser-genyo'
import { calcularMes } from '@/lib/ponto/calcular'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const profissionalId = form.get('profissional_id') as string
  const unidadeId = form.get('unidade_id') as string
  const horarioEntrada = form.get('horario_entrada') as string  // HH:MM
  const horarioSaida = form.get('horario_saida') as string      // HH:MM
  const intervaloMin = parseInt(form.get('intervalo_minutos') as string || '60')

  if (!file || !profissionalId || !unidadeId || !horarioEntrada || !horarioSaida) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''

  if (file.name.endsWith('.pdf')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    text = data.text
  } else {
    return NextResponse.json({ error: 'Formato não suportado. Use PDF.' }, { status: 400 })
  }

  // Parsear o texto do Gênio
  const folha = parseFolhaPontoGenyo(text)

  if (folha.dias.length === 0) {
    return NextResponse.json({ error: 'Não foi possível extrair registros do PDF. Verifique se é um relatório Folha de Ponto do Gênio.' }, { status: 400 })
  }

  // Calcular com as regras Danelon
  const resumo = calcularMes(folha.dias, horarioEntrada, horarioSaida, intervaloMin)

  // Salvar no banco
  const { data: importacao, error: impErr } = await admin
    .from('ponto_importacoes')
    .insert({
      profissional_id: profissionalId,
      unidade_id: unidadeId,
      arquivo_nome: file.name,
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

  // Salvar dias
  const rows = resumo.diasAnalisados.map(d => ({
    importacao_id: importacao.id,
    profissional_id: profissionalId,
    unidade_id: unidadeId,
    data: (() => {
      const [dd, mm, yyyy] = d.data.split('/')
      return `${yyyy}-${mm}-${dd}`
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

  // Atualizar horário na profissional (salvar para próximas importações)
  await admin.from('profissionais').update({
    horario_entrada: horarioEntrada,
    horario_saida: horarioSaida,
    intervalo_minutos: intervaloMin,
  }).eq('id', profissionalId)

  return NextResponse.json({
    success: true,
    importacao_id: importacao.id,
    resumo: {
      nomeProfissional: folha.nomeProfissional,
      periodo: folha.periodo,
      totalDiasTrabalhados: resumo.totalDiasTrabalhados,
      he50Min: resumo.he50Min,
      he100Min: resumo.he100Min,
      intervaloSuprimidoMin: resumo.intervaloSuprimidoMin,
      horasNegativasMin: resumo.horasNegativasMin,
      faltasSemJustificativa: resumo.faltasSemJustificativa,
      dias: resumo.diasAnalisados,
    }
  })
}
