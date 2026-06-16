/**
 * Parser para exportação Excel do Gênio (Folha de Ponto).
 * Mapeia as colunas: Dia | Marcações | Previstas | Trabalhadas | Abonos | Saldo
 */

import type { DadosFolhaPonto, MarcacaoDia } from './parser-genyo'

function parsePunches(marcacoes: string): { e1: string | null; s1: string | null; e2: string | null; s2: string | null } {
  const regex = /(\d{1,2}:\d{2})\((E|S)\)/gi
  const matches = [...String(marcacoes).matchAll(regex)]
  let e1 = null, s1 = null, e2 = null, s2 = null
  let ec = 0, sc = 0
  for (const m of matches) {
    if (m[2].toUpperCase() === 'E') { ec++; if (ec === 1) e1 = m[1].padStart(5, '0'); else if (ec === 2) e2 = m[1].padStart(5, '0') }
    else { sc++; if (sc === 1) s1 = m[1].padStart(5, '0'); else if (sc === 2) s2 = m[1].padStart(5, '0') }
  }
  return { e1, s1, e2, s2 }
}

function detectarTipo(marcacoes: string, previstas: string | null): MarcacaoDia['tipoDia'] {
  const m = String(marcacoes).toLowerCase()
  if (!previstas && !m.match(/\d{1,2}:\d{2}/)) return 'folga'
  if (m.includes('falta')) return 'falta'
  if (m.includes('atestado')) return 'atestado'
  if (m.includes('declaração') || m.includes('declaracao')) return 'declaracao_horas'
  if (m.includes('recesso') || m.includes('feriado')) return previstas ? 'feriado' : 'recesso'
  return 'normal'
}

function detectarOcorrencia(marcacoes: string): string | null {
  const m = String(marcacoes).match(/(?:Ocorrência|Recesso|Ocorrencia)[:\s]+(.+?)(?=\d{2}:\d{2}|$)/i)
  if (m) return m[1].trim()
  if (/falta/i.test(marcacoes)) return 'Falta'
  if (/atestado/i.test(marcacoes)) return 'Atestado'
  return null
}

function toISO(data: string): string {
  // DD/MM/YYYY → YYYY-MM-DD
  const [d, mo, y] = String(data).split('/')
  return `${y}-${mo?.padStart(2,'0')}-${d?.padStart(2,'0')}`
}

function parseHora(v: unknown): string | null {
  if (!v || String(v).trim() === '-') return null
  return String(v).trim()
}

export function parseFolhaPontoGenyoExcel(rows: Record<string, unknown>[]): DadosFolhaPonto {
  // Detectar linha de cabeçalho da tabela (contém "Dia" ou "Marcações")
  let dataStart = 0
  let colDia = 'Dia'
  let colMarcacoes = 'Marcações'
  let colPrevistas = 'Previstas'
  let colTrabalhadas = 'Trabalhadas'
  let colAbonos = 'Abonos'
  let colSaldo = 'Saldo'

  // Tentar detectar nomes das colunas na primeira linha com dados
  if (rows.length > 0) {
    const firstKeys = Object.keys(rows[0])
    for (const k of firstKeys) {
      const kl = k.toLowerCase()
      if (kl.includes('dia')) colDia = k
      if (kl.includes('marca')) colMarcacoes = k
      if (kl.includes('prevista')) colPrevistas = k
      if (kl.includes('trabalha')) colTrabalhadas = k
      if (kl.includes('abono')) colAbonos = k
      if (kl.includes('saldo')) colSaldo = k
    }
  }

  // Extrair nome e período das primeiras linhas (metadados)
  let nomeProfissional = ''
  let periodoInicio = ''
  let periodoFim = ''
  let periodo = ''
  let razaoSocial = ''

  const dias: MarcacaoDia[] = []

  for (const row of rows) {
    // Tentar extrair metadados das primeiras linhas
    const allValues = Object.values(row).map(v => String(v ?? '')).join(' ')

    if (!nomeProfissional && /Nome:|Trabalhador:/i.test(allValues)) {
      const m = allValues.match(/(?:Nome:|Trabalhador:)\s*(.+?)(?:\(|CPF|$)/i)
      if (m) nomeProfissional = m[1].trim()
    }

    if (!razaoSocial && /Razão Social:|Empregador:/i.test(allValues)) {
      const m = allValues.match(/(?:Razão Social:|Empregador:)\s*(.+?)(?:CNPJ|$)/i)
      if (m) razaoSocial = m[1].trim()
    }

    if (!periodoInicio && /Apuração:|Período:/i.test(allValues)) {
      const m = allValues.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/)
      if (m) {
        periodoInicio = toISO(m[1])
        periodoFim = toISO(m[2])
        periodo = `${m[1]} a ${m[2]}`
      }
    }

    // Linha de dados: coluna Dia deve conter DD/MM/YYYY
    const diaVal = String(row[colDia] ?? '').trim()
    const dataMatch = diaVal.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (!dataMatch) continue

    const data = dataMatch[1]
    // Dia da semana: pode estar junto à data ou separado
    const diaSemana = diaVal.replace(data, '').trim().toLowerCase() || ''

    const marcacoesRaw = String(row[colMarcacoes] ?? '').trim()
    const previstasRaw = parseHora(row[colPrevistas])
    const trabalhadasRaw = parseHora(row[colTrabalhadas])
    const abonosRaw = parseHora(row[colAbonos])
    const saldoRaw = parseHora(row[colSaldo])

    const { e1, s1, e2, s2 } = parsePunches(marcacoesRaw)
    const tipoDia = detectarTipo(marcacoesRaw, previstasRaw)
    const ocorrenciaDescricao = detectarOcorrencia(marcacoesRaw)

    dias.push({
      data,
      diaSemana,
      e1, s1, e2, s2,
      marcacoesRaw,
      tipoDia,
      ocorrenciaDescricao,
      genyoPrevistas: previstasRaw,
      genyoTrabalhadas: trabalhadasRaw,
      genyoAbonos: abonosRaw,
      genyoSaldo: saldoRaw,
    })
  }

  return { nomeProfissional, periodo, periodoInicio, periodoFim, razaoSocial, dias }
}
