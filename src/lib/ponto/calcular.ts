/**
 * Motor de cálculo do espelho de ponto Danelon.
 * Aplica as regras específicas: tolerância 5min, HE50%, HE100%, intervalo suprimido, horas negativas, faltas.
 */

import type { MarcacaoDia } from './parser-genyo'

export interface ResultadoDia {
  data: string
  diaSemana: string
  e1: string | null
  s1: string | null
  e2: string | null
  s2: string | null
  tipoDia: MarcacaoDia['tipoDia']
  ocorrenciaDescricao: string | null
  genyoPrevistas: string | null
  genyoTrabalhadas: string | null
  genyoAbonos: string | null
  genyoSaldo: string | null
  // Cálculos
  deltaEntradaMin: number    // + = chegou cedo (overtime), - = chegou tarde (negativo)
  deltaSaidaMin: number      // + = saiu tarde (overtime), - = saiu cedo (negativo)
  saldoDiaMin: number        // deltaEntrada + deltaSaida (banco 50%)
  intervaloRealMin: number | null
  intervaloSuprimidoMin: number  // minutos de almoço a menos que a empresa deve pagar
  he100Min: number           // minutos de HE 100% (feriado)
  // Labels para exibição
  statusLabel: string
  temPendencia: boolean
}

export interface ResumoMensal {
  he50Min: number              // banco positivo (a receber)
  he100Min: number             // feriados trabalhados
  intervaloSuprimidoMin: number
  horasNegativasMin: number    // banco negativo (deve à empresa)
  faltasSemJustificativa: number
  totalDiasTrabalhados: number
  diasAnalisados: ResultadoDia[]
}

const TOLERANCIA_MIN = 5

function horaParaMinutos(hora: string): number {
  if (!hora) return 0
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function minutosParaHora(min: number): string {
  const absMin = Math.abs(min)
  const h = Math.floor(absMin / 60)
  const m = absMin % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function calcularDeltaEntrada(e1: string, horarioEntradaMin: number): number {
  const entradaReal = horaParaMinutos(e1)
  const diff = horarioEntradaMin - entradaReal // positivo = chegou cedo, negativo = chegou tarde

  if (Math.abs(diff) <= TOLERANCIA_MIN) return 0

  // Fora da tolerância: conta todos os minutos
  return diff > 0 ? diff : diff  // chegou cedo = positivo (overtime), tarde = negativo
}

function calcularDeltaSaida(s2: string, horarioSaidaMin: number): number {
  const saidaReal = horaParaMinutos(s2)
  const diff = saidaReal - horarioSaidaMin // positivo = ficou mais (overtime), negativo = saiu antes

  if (diff < 0) return diff // Saída antecipada: SEM tolerância, conta tudo

  // Saída após o horário: tolerância de 5 min
  if (diff <= TOLERANCIA_MIN) return 0
  return diff // ficou mais que 5 min = overtime (conta tudo a partir do 1º minuto)
}

function calcularIntervalo(s1: string, e2: string): number {
  return horaParaMinutos(e2) - horaParaMinutos(s1)
}

export function calcularDia(dia: MarcacaoDia, horarioEntradaMin: number, horarioSaidaMin: number, intervaloEsperadoMin: number): ResultadoDia {
  const base: Omit<ResultadoDia, 'deltaEntradaMin' | 'deltaSaidaMin' | 'saldoDiaMin' | 'intervaloRealMin' | 'intervaloSuprimidoMin' | 'he100Min' | 'statusLabel' | 'temPendencia'> = {
    data: dia.data,
    diaSemana: dia.diaSemana,
    e1: dia.e1,
    s1: dia.s1,
    e2: dia.e2,
    s2: dia.s2,
    tipoDia: dia.tipoDia,
    ocorrenciaDescricao: dia.ocorrenciaDescricao,
    genyoPrevistas: dia.genyoPrevistas,
    genyoTrabalhadas: dia.genyoTrabalhadas,
    genyoAbonos: dia.genyoAbonos,
    genyoSaldo: dia.genyoSaldo,
  }

  // Dias de folga (dom, seg de folga, etc.)
  if (dia.tipoDia === 'folga') {
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: null, intervaloSuprimidoMin: 0, he100Min: 0, statusLabel: 'Folga', temPendencia: false }
  }

  // Falta sem justificativa
  if (dia.tipoDia === 'falta') {
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: null, intervaloSuprimidoMin: 0, he100Min: 0, statusLabel: '⚠ Falta s/ justificativa', temPendencia: true }
  }

  // Atestado ou declaração de horas: dia ok, sem penalidade
  if (dia.tipoDia === 'atestado') {
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: null, intervaloSuprimidoMin: 0, he100Min: 0, statusLabel: 'Atestado', temPendencia: false }
  }

  // Feriado (Recesso sem trabalho)
  if (dia.tipoDia === 'recesso' && !dia.e1) {
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: null, intervaloSuprimidoMin: 0, he100Min: 0, statusLabel: 'Recesso/Feriado', temPendencia: false }
  }

  // Dia de feriado trabalhado (HE 100%) ou recesso com marcações
  if (dia.tipoDia === 'feriado' || (dia.tipoDia === 'recesso' && dia.e1)) {
    // Usa diretamente o valor "Trabalhadas" do Gênio — ele já calculou corretamente
    const he100 = dia.genyoTrabalhadas ? horaParaMinutos(dia.genyoTrabalhadas) : 0
    const label = he100 > 0 ? `HE 100% (${minutosParaHora(he100)}h)` : 'Feriado s/ trabalho'
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: null, intervaloSuprimidoMin: 0, he100Min: he100, statusLabel: label, temPendencia: false }
  }

  // Declaração de horas: dia com abono, não aplica tolerância de entrada
  if (dia.tipoDia === 'declaracao_horas') {
    let intervaloReal: number | null = null
    let intervaloSuprimido = 0

    if (dia.e1 && dia.s1 && dia.e2 && dia.s2) {
      intervaloReal = calcularIntervalo(dia.s1, dia.e2)
      if (intervaloReal < intervaloEsperadoMin) {
        intervaloSuprimido = intervaloEsperadoMin - intervaloReal
      }
    }

    // Saldo: Gênio já calcula com abono, usamos o saldo do Gênio como referência mas zeramos penalidade
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: intervaloReal, intervaloSuprimidoMin: intervaloSuprimido, he100Min: 0, statusLabel: 'Dec. de Horas', temPendencia: false }
  }

  // Dia normal: aplica todas as regras
  if (!dia.e1) {
    // Sem marcações em dia normal = falta (não declarada explicitamente)
    return { ...base, deltaEntradaMin: 0, deltaSaidaMin: 0, saldoDiaMin: 0, intervaloRealMin: null, intervaloSuprimidoMin: 0, he100Min: 0, statusLabel: '⚠ Falta s/ justificativa', temPendencia: true }
  }

  const deltaEntrada = calcularDeltaEntrada(dia.e1, horarioEntradaMin)

  // Saída final: pode ser s2 (com almoço) ou s1 (sem almoço, 2 marcações)
  const saidaFinal = dia.s2 || dia.s1
  const deltaSaida = saidaFinal ? calcularDeltaSaida(saidaFinal, horarioSaidaMin) : 0

  const saldoDia = deltaEntrada + deltaSaida

  // Intervalo de almoço
  let intervaloReal: number | null = null
  let intervaloSuprimido = 0

  if (dia.e2 && dia.s1) {
    // 4 marcações: almoço registrado
    intervaloReal = calcularIntervalo(dia.s1, dia.e2)
    if (intervaloReal < intervaloEsperadoMin) {
      intervaloSuprimido = intervaloEsperadoMin - intervaloReal
    }
    // Se fez mais almoço que o esperado, não abate do overtime (só deixa quieto)
  } else if (dia.s1 && !dia.e2) {
    // Apenas 2 marcações (sem registro de almoço)
    // Se trabalhou mais de 6h, o almoço seria esperado mas não foi registrado
    const totalTrabalhado = horaParaMinutos(saidaFinal!) - horaParaMinutos(dia.e1)
    if (totalTrabalhado > 360) { // > 6 horas
      intervaloSuprimido = intervaloEsperadoMin
    }
  }

  // Montar label de status
  let statusLabel = 'Normal'
  let temPendencia = false

  if (deltaEntrada < 0) { statusLabel = `Atraso entrada ${minutosParaHora(Math.abs(deltaEntrada))}h`; temPendencia = true }
  else if (deltaEntrada > 0) statusLabel = `Entrada +${minutosParaHora(deltaEntrada)}h`

  if (deltaSaida < 0) { statusLabel += (statusLabel !== 'Normal' ? ' | ' : '') + `Saída antecipada ${minutosParaHora(Math.abs(deltaSaida))}h`; temPendencia = true }
  else if (deltaSaida > 0) statusLabel += (statusLabel !== 'Normal' ? ' | ' : '') + `HE saída +${minutosParaHora(deltaSaida)}h`

  if (intervaloSuprimido > 0) statusLabel += ` | Interv. sup. ${minutosParaHora(intervaloSuprimido)}h`
  if (statusLabel === 'Normal' && saldoDia === 0 && intervaloSuprimido === 0) statusLabel = 'Normal'

  return {
    ...base,
    deltaEntradaMin: deltaEntrada,
    deltaSaidaMin: deltaSaida,
    saldoDiaMin: saldoDia,
    intervaloRealMin: intervaloReal,
    intervaloSuprimidoMin: intervaloSuprimido,
    he100Min: 0,
    statusLabel,
    temPendencia,
  }
}

export function calcularMes(dias: MarcacaoDia[], horarioEntradaStr: string, horarioSaidaStr: string, intervaloMin: number): ResumoMensal {
  const horarioEntradaMin = horaParaMinutos(horarioEntradaStr)
  const horarioSaidaMin = horaParaMinutos(horarioSaidaStr)

  const diasAnalisados = dias.map(d => calcularDia(d, horarioEntradaMin, horarioSaidaMin, intervaloMin))

  let bancoDias = 0  // soma de todos os saldos diários (positivos e negativos)
  let he100Min = 0
  let intervaloSuprimidoMin = 0
  let faltasSemJustificativa = 0
  let totalDiasTrabalhados = 0

  for (const d of diasAnalisados) {
    if (d.tipoDia === 'folga' || d.tipoDia === 'recesso') continue
    if (d.tipoDia === 'falta') { faltasSemJustificativa++; continue }
    if (d.tipoDia === 'atestado') continue

    if (d.tipoDia === 'feriado') {
      he100Min += d.he100Min
      continue
    }

    // Dias normais e declaração de horas
    if (d.e1 || d.tipoDia === 'declaracao_horas') {
      totalDiasTrabalhados++
      bancoDias += d.saldoDiaMin
      intervaloSuprimidoMin += d.intervaloSuprimidoMin
    }
  }

  const he50Min = bancoDias > 0 ? bancoDias : 0
  const horasNegativasMin = bancoDias < 0 ? Math.abs(bancoDias) : 0

  return {
    he50Min,
    he100Min,
    intervaloSuprimidoMin,
    horasNegativasMin,
    faltasSemJustificativa,
    totalDiasTrabalhados,
    diasAnalisados,
  }
}

export function formatarMinutos(min: number): string {
  return minutosParaHora(min)
}
