/**
 * Parser para exportação Excel do Gênio (Folha de Ponto).
 * Usa leitura por array (header:1) para ignorar linhas de metadados
 * que o Gênio insere antes da tabela real.
 */

import type { DadosFolhaPonto, MarcacaoDia } from './parser-genyo'

function parsePunches(marcacoes: string): { e1: string | null; s1: string | null; e2: string | null; s2: string | null } {
  const regex = /(\d{1,2}:\d{2})\s*\(\s*(E|S)\s*\)/gi
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
  if (m.includes('falta')) return 'falta'
  if (m.includes('atestado')) return 'atestado'
  if (m.includes('declaração') || m.includes('declaracao')) return 'declaracao_horas'
  if (m.includes('recesso') || m.includes('feriado')) return previstas ? 'feriado' : 'recesso'
  if (!m.match(/\d{1,2}:\d{2}/) && !previstas) return 'folga'
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
  const [d, mo, y] = String(data).split('/')
  return `${y}-${mo?.padStart(2, '0')}-${d?.padStart(2, '0')}`
}

function parseHora(v: unknown): string | null {
  const s = String(v ?? '').trim()
  if (!s || s === '-' || s === '' || s === '00:00') return null
  if (/^\d{1,2}:\d{2}$/.test(s)) return s
  return null
}

function extrairData(v: unknown): string | null {
  const s = String(v ?? '').trim()
  // Formato DD/MM/YYYY
  const m1 = s.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (m1) return m1[1]
  // Formato YYYY-MM-DD
  const m2 = s.match(/(\d{4}-\d{2}-\d{2})/)
  if (m2) {
    const [y, mo, d] = m2[1].split('-')
    return `${d}/${mo}/${y}`
  }
  // Número serial do Excel (dias desde 1900-01-01)
  const n = parseFloat(s)
  if (!isNaN(n) && n > 30000 && n < 60000) {
    const d = new Date((n - 25569) * 86400 * 1000)
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = d.getUTCFullYear()
    return `${dd}/${mm}/${yyyy}`
  }
  return null
}

function celToStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export function parseFolhaPontoGenyoExcel(rawRows: unknown[][]): DadosFolhaPonto {
  let nomeProfissional = ''
  let periodoInicio = ''
  let periodoFim = ''
  let periodo = ''
  let razaoSocial = ''

  // Encontrar a linha de cabeçalho da tabela (contém "Dia" ou "Marcações")
  let headerRowIdx = -1
  let colDia = -1
  let colMarcacoes = -1
  let colPrevistas = -1
  let colTrabalhadas = -1
  let colAbonos = -1
  let colSaldo = -1

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r]
    const rowStr = row.map(c => celToStr(c).toLowerCase())

    // Extrair metadados antes da tabela
    const rowFull = row.map(c => celToStr(c)).join(' ')

    if (!nomeProfissional && /nome:|trabalhador:/i.test(rowFull)) {
      const m = rowFull.match(/(?:nome:|trabalhador:)\s*(.+?)(?:\(|\s*cpf|\s*matrícula|$)/i)
      if (m) nomeProfissional = m[1].trim()
    }
    if (!razaoSocial && /razão social:|empregador:/i.test(rowFull)) {
      const m = rowFull.match(/(?:razão social:|empregador:)\s*(.+?)(?:cnpj|$)/i)
      if (m) razaoSocial = m[1].trim()
    }
    if (!periodoInicio && /apuração:|período:/i.test(rowFull)) {
      const m = rowFull.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/)
      if (m) {
        periodoInicio = toISO(m[1])
        periodoFim = toISO(m[2])
        periodo = `${m[1]} a ${m[2]}`
      }
    }

    // Detectar linha de cabeçalho
    const hasDia = rowStr.some(c => c === 'dia' || c.startsWith('dia '))
    const hasMarca = rowStr.some(c => c.includes('marca'))
    if (hasDia && hasMarca) {
      headerRowIdx = r
      colDia = rowStr.findIndex(c => c === 'dia' || c.startsWith('dia '))
      colMarcacoes = rowStr.findIndex(c => c.includes('marca'))
      colPrevistas = rowStr.findIndex(c => c.includes('prevista'))
      colTrabalhadas = rowStr.findIndex(c => c.includes('trabalha'))
      colAbonos = rowStr.findIndex(c => c.includes('abono'))
      colSaldo = rowStr.findIndex(c => c.includes('saldo'))
      break
    }
  }

  // Se não encontrou cabeçalho, tentar detectar pela primeira coluna com data
  if (headerRowIdx === -1) {
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r]
      if (row.length < 2) continue
      const data = extrairData(row[0])
      if (data) {
        // A linha anterior pode ser o cabeçalho, mas vamos usar índices fixos
        headerRowIdx = r - 1
        colDia = 0
        colMarcacoes = 1
        colPrevistas = 2
        colTrabalhadas = 3
        colAbonos = 4
        colSaldo = 5
        break
      }
    }
  }

  const dias: MarcacaoDia[] = []
  const startRow = Math.max(headerRowIdx + 1, 0)

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r]
    if (!row || row.length === 0) continue

    const diaRaw = colDia >= 0 ? row[colDia] : row[0]
    const data = extrairData(diaRaw)
    if (!data) continue

    const diaSemanaRaw = celToStr(diaRaw).replace(/\d{2}\/\d{2}\/\d{4}/, '').trim().toLowerCase()
    const diaSemana = diaSemanaRaw || ''

    const marcacoesRaw = colMarcacoes >= 0 ? celToStr(row[colMarcacoes]) : ''
    const previstasRaw = colPrevistas >= 0 ? parseHora(row[colPrevistas]) : null
    const trabalhadasRaw = colTrabalhadas >= 0 ? parseHora(row[colTrabalhadas]) : null
    const abonosRaw = colAbonos >= 0 ? parseHora(row[colAbonos]) : null
    const saldoRaw = colSaldo >= 0 ? parseHora(row[colSaldo]) : null

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
