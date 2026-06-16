/**
 * Parser para o relatório "Folha de Ponto" do sistema Gênio (Genyo).
 * Formato: PDF com tabela de registros diários.
 */

export interface MarcacaoDia {
  data: string           // DD/MM/YYYY
  diaSemana: string      // seg, ter, qua, qui, sex, sáb, dom
  e1: string | null      // 1ª entrada
  s1: string | null      // 1ª saída (saída almoço)
  e2: string | null      // 2ª entrada (volta almoço)
  s2: string | null      // 2ª saída (saída final)
  marcacoesRaw: string
  tipoDia: 'normal' | 'feriado' | 'folga' | 'falta' | 'atestado' | 'declaracao_horas' | 'recesso'
  ocorrenciaDescricao: string | null
  genyoPrevistas: string | null
  genyoTrabalhadas: string | null
  genyoAbonos: string | null
  genyoSaldo: string | null
}

export interface DadosFolhaPonto {
  nomeProfissional: string
  periodo: string
  periodoInicio: string   // YYYY-MM-DD
  periodoFim: string      // YYYY-MM-DD
  razaoSocial: string
  dias: MarcacaoDia[]
}

const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'sab', 'dom']

function normalizarDiaSemana(s: string): string {
  const d = s.toLowerCase().trim()
  if (d === 'sab') return 'sáb'
  return d
}

function parsePunch(raw: string): { e1: string | null; s1: string | null; e2: string | null; s2: string | null } {
  const regex = /(\d{1,2}:\d{2})\((E|S)\)/gi
  const matches = [...raw.matchAll(regex)]
  const punches: Array<{ time: string; type: string }> = matches.map(m => ({ time: m[1].padStart(5, '0'), type: m[2].toUpperCase() }))

  let e1 = null, s1 = null, e2 = null, s2 = null
  let entryCount = 0, exitCount = 0

  for (const p of punches) {
    if (p.type === 'E') {
      entryCount++
      if (entryCount === 1) e1 = p.time
      else if (entryCount === 2) e2 = p.time
    } else {
      exitCount++
      if (exitCount === 1) s1 = p.time
      else if (exitCount === 2) s2 = p.time
    }
  }

  return { e1, s1, e2, s2 }
}

function parseHoraGenyo(s: string | null): string | null {
  if (!s || s.trim() === '-') return null
  return s.trim()
}

function detectarTipoDia(marcacoes: string, previstas: string | null): MarcacaoDia['tipoDia'] {
  const m = marcacoes.toLowerCase()
  if (!previstas && !marcacoes.match(/\d{1,2}:\d{2}/)) return 'folga'
  if (m.includes('falta')) return 'falta'
  if (m.includes('atestado')) return 'atestado'
  if (m.includes('declaração de horas') || m.includes('declaracao de horas') || m.includes('declaração')) return 'declaracao_horas'
  if (m.includes('recesso') || m.includes('feriado')) {
    return !previstas ? 'recesso' : 'feriado'
  }
  return 'normal'
}

function detectarOcorrencia(marcacoes: string): string | null {
  const m = marcacoes.match(/(?:Ocorrência|Recesso|Ocorrencia)[:\s]+(.+?)(?=\d{2}:\d{2}|$)/i)
  if (m) return m[1].trim()
  if (/falta/i.test(marcacoes)) return 'Falta'
  if (/atestado/i.test(marcacoes)) return 'Atestado'
  return null
}

function dataParaISO(data: string): string {
  // Recebe DD/MM/YYYY, retorna YYYY-MM-DD
  const [d, m, y] = data.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseFolhaPontoGenyo(text: string): DadosFolhaPonto {
  const linhas = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Extrair nome e período do cabeçalho
  let nomeProfissional = ''
  let periodo = ''
  let periodoInicio = ''
  let periodoFim = ''
  let razaoSocial = ''

  for (const linha of linhas) {
    if (/Nome:/i.test(linha)) {
      const m = linha.match(/Nome:\s*(.+?)(?:\(\d+\))?\s*(?:Data|$)/i)
      if (m) nomeProfissional = m[1].trim()
    }
    if (/Razão Social:|Razao Social:/i.test(linha)) {
      const m = linha.match(/Razão Social:\s*(.+?)(?:CNPJ|$)/i)
      if (m) razaoSocial = m[1].trim()
    }
    if (/Apuração:/i.test(linha) || /Apuracao:/i.test(linha)) {
      const m = linha.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/)
      if (m) {
        periodoInicio = dataParaISO(m[1])
        periodoFim = dataParaISO(m[2])
        periodo = `${m[1]} a ${m[2]}`
      }
    }
  }

  // Juntar linhas que pertencem ao mesmo dia (linhas de continuação de "Ocorrência: Declaração de\nHoras")
  const linhasUnidas: string[] = []
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    // Se a linha começa com data DD/MM/YYYY, é nova linha de dia
    if (/^\d{2}\/\d{2}\/\d{4}/.test(l)) {
      // Verificar se a próxima linha é continuação (não começa com data e não é cabeçalho)
      let combined = l
      while (
        i + 1 < linhas.length &&
        !/^\d{2}\/\d{2}\/\d{4}/.test(linhas[i + 1]) &&
        !/^(Dia|Nome|DADOS|Razão|Razao|Apuração|Apuracao|REGISTROS|TOTAL|Legenda|Reconheço|DANELON|Responsável|Trabalhador|Folha|Emitido|Endereço|Departamento|CPF|Série)/i.test(linhas[i + 1])
      ) {
        i++
        combined += ' ' + linhas[i]
      }
      linhasUnidas.push(combined)
    } else {
      linhasUnidas.push(l)
    }
  }

  const dias: MarcacaoDia[] = []

  for (const linha of linhasUnidas) {
    // Detectar linha de dia: começa com DD/MM/YYYY
    const inicioMatch = linha.match(/^(\d{2}\/\d{2}\/\d{4})\s+(seg|ter|qua|qui|sex|sáb|sab|dom)\s*(.*)/i)
    if (!inicioMatch) continue

    const data = inicioMatch[1]
    const diaSemana = normalizarDiaSemana(inicioMatch[2])
    const resto = inicioMatch[3].trim()

    // Extrair os últimos campos numéricos (previstas, trabalhadas, abonos, saldo)
    // Formato: [HH:MM|-] [HH:MM|-] [HH:MM|-] [-?HH:MM|-]
    const camposFinais = [...resto.matchAll(/(?<!\d)(-?\d{2}:\d{2}|-)/g)]

    // Os últimos 4 matches (ou menos) são previstas, trabalhadas, abonos, saldo
    const ultimos4 = camposFinais.slice(-4).map(m => m[0])
    const [previstas, trabalhadas, abonos, saldo] = ultimos4.length >= 4
      ? ultimos4
      : [null, ultimos4[0] ?? null, ultimos4[1] ?? null, ultimos4[2] ?? null]

    // O que sobra antes dos campos finais são marcações + ocorrências
    let marcacoesArea = resto
    if (ultimos4.length > 0) {
      const idxUltimo = resto.lastIndexOf(ultimos4[0])
      // Encontrar o início dos campos finais
      let idxInicio = resto.length
      for (const u of ultimos4) {
        const idx = resto.indexOf(u)
        if (idx !== -1 && idx < idxInicio) idxInicio = idx
      }
      // Heurística: pegar tudo antes do primeiro campo final isolado
      const matchCampos = resto.match(/(.+?)\s+(-?\d{2}:\d{2}|-)\s+(-?\d{2}:\d{2}|-)\s+(-?\d{2}:\d{2}|-)\s+(-?\d{2}:\d{2}|-)$/)
      if (matchCampos) {
        marcacoesArea = matchCampos[1].trim()
      }
    }

    // Linha em branco (folga): sem marcações e sem previstas
    if (!marcacoesArea && !previstas) {
      dias.push({
        data,
        diaSemana,
        e1: null, s1: null, e2: null, s2: null,
        marcacoesRaw: '',
        tipoDia: 'folga',
        ocorrenciaDescricao: null,
        genyoPrevistas: null,
        genyoTrabalhadas: null,
        genyoAbonos: null,
        genyoSaldo: null,
      })
      continue
    }

    // Parsear punches
    const { e1, s1, e2, s2 } = parsePunch(marcacoesArea)

    // Detectar tipo de dia e ocorrência
    const tipoDia = detectarTipoDia(marcacoesArea, previstas)
    const ocorrenciaDescricao = detectarOcorrencia(marcacoesArea)

    dias.push({
      data,
      diaSemana,
      e1, s1, e2, s2,
      marcacoesRaw: marcacoesArea,
      tipoDia,
      ocorrenciaDescricao,
      genyoPrevistas: parseHoraGenyo(previstas),
      genyoTrabalhadas: parseHoraGenyo(trabalhadas),
      genyoAbonos: parseHoraGenyo(abonos),
      genyoSaldo: parseHoraGenyo(saldo),
    })
  }

  return { nomeProfissional, periodo, periodoInicio, periodoFim, razaoSocial, dias }
}
