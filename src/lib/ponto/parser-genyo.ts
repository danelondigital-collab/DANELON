/**
 * Parser para o relatório "Folha de Ponto" do sistema Gênio (Genyo).
 * Funciona com qualquer formato de extração de texto (PDF, texto puro).
 */

export interface MarcacaoDia {
  data: string
  diaSemana: string
  e1: string | null
  s1: string | null
  e2: string | null
  s2: string | null
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
  periodoInicio: string
  periodoFim: string
  razaoSocial: string
  dias: MarcacaoDia[]
}

const DIAS_PT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'sab', 'dom']

function parsePunches(raw: string) {
  const regex = /(\d{1,2}:\d{2})\s*\(\s*(E|S)\s*\)/gi
  const matches = [...raw.matchAll(regex)]
  let e1 = null, s1 = null, e2 = null, s2 = null, ec = 0, sc = 0
  for (const m of matches) {
    const t = m[1].padStart(5, '0')
    if (m[2].toUpperCase() === 'E') { ec++; if (ec === 1) e1 = t; else if (ec === 2) e2 = t }
    else { sc++; if (sc === 1) s1 = t; else if (sc === 2) s2 = t }
  }
  return { e1, s1, e2, s2 }
}

function detectarTipoDia(bloco: string, temPunches: boolean): MarcacaoDia['tipoDia'] {
  const b = bloco.toLowerCase()
  if (/\bfalta\b/.test(b)) return 'falta'
  if (/atestado/.test(b)) return 'atestado'
  if (/declara[çc][aã]o\s+de\s+horas/.test(b)) return 'declaracao_horas'
  if (/recesso/.test(b) || /feriado/.test(b)) return temPunches ? 'feriado' : 'recesso'
  if (!temPunches) return 'folga'
  return 'normal'
}

function detectarOcorrencia(bloco: string): string | null {
  const m = bloco.match(/(?:Ocorrência|Ocorrencia|Recesso)[:\s]+([^\d\n]+?)(?=\d{2}:\d{2}|\d{2}\/\d{2}|$)/i)
  if (m) return m[1].trim().replace(/\s+/g, ' ')
  if (/\bfalta\b/i.test(bloco)) return 'Falta'
  if (/atestado/i.test(bloco)) return 'Atestado'
  return null
}

function extrairHoraGenyo(bloco: string, pos: number): string | null {
  // Extrai horas no formato HH:MM no bloco, por posição (0=1º, 1=2º, etc.)
  const matches = [...bloco.matchAll(/\b(\d{2}:\d{2})\b/g)]
    .filter(m => !bloco.slice(Math.max(0, m.index! - 3), m.index!).match(/\(E\)|\(S\)/i))
  if (matches[pos]) return matches[pos][1]
  return null
}

function dataParaISO(data: string): string {
  const [d, m, y] = data.split('/')
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

export function parseFolhaPontoGenyo(text: string): DadosFolhaPonto {
  // Normalizar: remover quebras de página, juntar espaços múltiplos por linha
  const textNorm = text.replace(/\r/g, '').replace(/\f/g, '\n')

  // ── Extrair metadados ──────────────────────────────────────────────────────
  let nomeProfissional = ''
  let periodoInicio = ''
  let periodoFim = ''
  let periodo = ''
  let razaoSocial = ''

  const mNome = textNorm.match(/Nome:\s*(.+?)(?:\s*\(\d+\))?\s*(?:Data|CPF|Departamento|\n)/i)
  if (mNome) nomeProfissional = mNome[1].trim()

  const mRazao = textNorm.match(/Razão Social:\s*(.+?)(?:\s*CNPJ|\n)/i)
  if (mRazao) razaoSocial = mRazao[1].trim()

  const mPeriodo = textNorm.match(/Apura[çc][aã]o[:\s]+de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (mPeriodo) {
    periodoInicio = dataParaISO(mPeriodo[1])
    periodoFim = dataParaISO(mPeriodo[2])
    periodo = `${mPeriodo[1]} a ${mPeriodo[2]}`
  }

  // ── Encontrar todos os blocos de dia ───────────────────────────────────────
  // Estratégia: encontrar TODAS as datas DD/MM/YYYY no texto, pegar o bloco entre elas
  const DATA_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/g
  const posicoesDatas: Array<{ data: string; index: number }> = []

  let m: RegExpExecArray | null
  while ((m = DATA_RE.exec(textNorm)) !== null) {
    // Ignorar datas do cabeçalho (admissão, emissão, período)
    const antes = textNorm.slice(Math.max(0, m.index - 80), m.index)
    if (/admiss[aã]o|emitido|apura[çc]/i.test(antes)) continue
    posicoesDatas.push({ data: m[1], index: m.index })
  }

  const dias: MarcacaoDia[] = []

  for (let i = 0; i < posicoesDatas.length; i++) {
    const { data, index } = posicoesDatas[i]
    const fimBloco = i + 1 < posicoesDatas.length ? posicoesDatas[i + 1].index : index + 300
    const bloco = textNorm.slice(index, fimBloco).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()

    // Extrair dia da semana (logo após a data)
    const mDia = bloco.match(/^\d{2}\/\d{2}\/\d{4}\s+(seg|ter|qua|qui|sex|s[aá]b|dom)/i)
    const diaSemana = mDia ? mDia[1].toLowerCase().replace('sab', 'sáb') : ''

    const { e1, s1, e2, s2 } = parsePunches(bloco)
    const temPunches = !!(e1 || s1)

    const tipoDia = detectarTipoDia(bloco, temPunches)
    const ocorrenciaDescricao = detectarOcorrencia(bloco)

    // Extrair horas do Gênio (Previstas, Trabalhadas, Abonos, Saldo)
    // Ficam no final do bloco, após as marcações
    // Remove a parte das marcações para pegar só os valores finais
    const semPunches = bloco.replace(/\d{1,2}:\d{2}\s*\([ES]\)/gi, '').replace(/\s+/g, ' ')
    const horasFinais = [...semPunches.matchAll(/\b(\d{2}:\d{2})\b/g)].map(x => x[1])

    // O Gênio sempre coloca: Previstas | Trabalhadas | Abonos | Saldo (últimas 4)
    const ult = horasFinais.slice(-4)
    const [previstas, trabalhadas, abonos, saldo] = ult.length >= 4
      ? ult
      : [null, ult[0] ?? null, ult[1] ?? null, ult[2] ?? null]

    dias.push({
      data,
      diaSemana,
      e1, s1, e2, s2,
      marcacoesRaw: bloco,
      tipoDia,
      ocorrenciaDescricao,
      genyoPrevistas: previstas ?? null,
      genyoTrabalhadas: trabalhadas ?? null,
      genyoAbonos: abonos ?? null,
      genyoSaldo: saldo ?? null,
    })
  }

  return { nomeProfissional, periodo, periodoInicio, periodoFim, razaoSocial, dias }
}
