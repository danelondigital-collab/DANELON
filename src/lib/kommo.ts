const SUBDOMAIN = process.env.KOMMO_SUBDOMAIN
const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN
const PAGE_LIMIT = 250
const MAX_PAGES = 12 // teto de segurança: evita estourar o tempo da função serverless

type Entity = 'leads' | 'contacts'

function baseUrl() {
  return `https://${SUBDOMAIN}.kommo.com/api/v4`
}

async function fetchPage(entity: Entity, page: number, fromUnix: number, toUnix: number) {
  const url = `${baseUrl()}/${entity}?limit=${PAGE_LIMIT}&page=${page}&filter[created_at][from]=${fromUnix}&filter[created_at][to]=${toUnix}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      next: { revalidate: 300 },
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    if (res.status === 204) return { count: 0, hasNext: false }
    if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const items = data._embedded?.[entity] || []
    return { count: items.length, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
  }
  throw new Error('Erro na API do Kommo: limite de requisições (429) excedido repetidamente')
}

/** Conta registros criados no período, paginando em lotes paralelos até um teto de segurança. */
async function countNewInRange(entity: Entity, fromUnix: number, toUnix: number): Promise<{ count: number; capped: boolean }> {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  let total = 0
  let page = 1
  const BATCH = 4

  while (page <= MAX_PAGES) {
    const pagesToFetch = Array.from({ length: Math.min(BATCH, MAX_PAGES - page + 1) }, (_, i) => page + i)
    const results = await Promise.all(pagesToFetch.map(p => fetchPage(entity, p, fromUnix, toUnix)))

    for (const r of results) total += r.count

    const lastFullBatch = results.every(r => r.count === PAGE_LIMIT)
    const anyHasNext = results[results.length - 1]?.hasNext

    if (!lastFullBatch || !anyHasNext) {
      return { count: total, capped: false }
    }

    page += pagesToFetch.length
  }

  return { count: total, capped: true }
}

export function countNewLeads(fromUnix: number, toUnix: number) {
  return countNewInRange('leads', fromUnix, toUnix)
}

export function countNewContacts(fromUnix: number, toUnix: number) {
  return countNewInRange('contacts', fromUnix, toUnix)
}

// O endpoint /leads/unsorted da Kommo IGNORA filter[created_at] (confirmado testando
// direto na API: pedir um período de 2025 continua devolvendo as conversas de hoje).
// Não tem como filtrar por data no servidor aqui — a única forma correta é paginar a
// lista (que vem sempre em ordem decrescente de criação) e parar manualmente quando
// os itens caem abaixo do início do período pedido. Teto de segurança pra não rodar
// pra sempre se o período pedido for muito largo.
const UNSORTED_SAFETY_MAX_PAGES = 30

const CHANNEL_BY_SERVICE: Record<string, string> = {
  waba: 'WhatsApp',
  instagram_business: 'Instagram',
  tiktok_kommo: 'TikTok',
  facebook: 'Facebook',
}

const UNIDADES = ['Santo André', 'Morumbi', 'Alphaville', 'Goiânia'] as const
const OUTRA_UNIDADE = 'Geral / outros'

function unidadeFromSourceName(sourceName: string | undefined): string {
  const s = (sourceName || '').toLowerCase()
  if (s.includes('santo')) return 'Santo André'
  if (s.includes('morumbi')) return 'Morumbi'
  if (s.includes('alphaville')) return 'Alphaville'
  if (s.includes('goi')) return 'Goiânia'
  return OUTRA_UNIDADE
}

interface UnsortedItem {
  created_at?: number
  metadata?: { service?: string; source_name?: string }
  _embedded?: { contacts?: { id: number }[] }
}

/** Busca uma página "crua" da lista (sem filtro de data — a API ignora esse filtro nesse endpoint). */
async function fetchUnsortedPage(page: number): Promise<{ items: UnsortedItem[]; hasNext: boolean }> {
  const url = `${baseUrl()}/leads/unsorted?limit=${PAGE_LIMIT}&page=${page}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      cache: 'no-store',
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    if (res.status === 204) return { items: [], hasNext: false }
    if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const items = (data._embedded?.unsorted || []) as UnsortedItem[]
    return { items, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
  }
  throw new Error('Erro na API do Kommo: limite de requisições (429) excedido repetidamente')
}

// Se o contato vinculado à conversa foi criado até esse tanto de tempo antes da
// conversa em si, consideramos que é a primeira vez que esse número fala com a
// empresa ("novo"). A Kommo não duplica contato por telefone (confirmado testando
// direto na API), então created_at do contato reflete o primeiro contato de verdade.
const NOVO_THRESHOLD_SECONDS = 120

/** Busca created_at de vários contatos de uma vez, em lotes, pra classificar novo x já existia. */
async function fetchContactsCreatedAt(ids: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  const BATCH_SIZE = 50
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const query = batch.map(id => `filter[id][]=${id}`).join('&')
    const url = `${baseUrl()}/contacts?limit=250&${query}`
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }, cache: 'no-store' })
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        continue
      }
      if (res.status === 204) break
      if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
      const data = await res.json()
      const contacts = (data._embedded?.contacts || []) as { id: number; created_at: number }[]
      for (const c of contacts) result.set(c.id, c.created_at)
      break
    }
  }
  return result
}

/**
 * Distribuição canal x unidade das conversas recebidas no período informado.
 * Como a API não filtra por data nesse endpoint, pagina a lista completa (mais
 * recente primeiro) e para assim que os itens saem do período pedido — só soma
 * o que realmente cai dentro de [fromUnix, toUnix]. Se bater no teto de segurança
 * antes de sair do período, volta marcado como "capped" (contagem parcial).
 * Também classifica cada conversa em "novo" (primeira vez que esse número fala
 * com a empresa) ou "já existia" (contato mais antigo que a conversa), comparando
 * a data de criação do contato vinculado com a data da conversa.
 */
export async function channelsByUnidade(fromUnix: number, toUnix: number): Promise<{
  matrix: Record<string, Record<string, number>>
  channels: string[]
  unidades: string[]
  sampled: number
  capped: boolean
  novos: number | null
  existentes: number | null
}> {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  const unidades = [...UNIDADES, OUTRA_UNIDADE]
  const channels = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'Outro']
  const matrix: Record<string, Record<string, number>> = {}
  for (const u of unidades) matrix[u] = Object.fromEntries(channels.map(c => [c, 0]))

  let sampled = 0
  let capped = false
  const itemsInWindow: { contactId?: number; createdAt: number }[] = []
  const t0 = Date.now()
  // Teto de tempo (bem abaixo do maxDuration=60s da rota) pra sempre devolver uma
  // resposta válida em vez de deixar a Vercel matar a função com timeout no meio.
  // Reservamos uma fatia pra classificação novo x já existia, que roda depois.
  const PAGINATION_BUDGET_MS = 30_000
  const TOTAL_BUDGET_MS = 45_000

  for (let page = 1; page <= UNSORTED_SAFETY_MAX_PAGES; page++) {
    const { items, hasNext } = await fetchUnsortedPage(page)
    if (items.length === 0) break

    let crossedLowerBound = false
    for (const item of items) {
      const createdAt = item.created_at ?? 0
      if (createdAt > toUnix) continue // ainda não entrou no período (mais recente que "até")
      if (createdAt < fromUnix) { crossedLowerBound = true; break } // já passou do início do período

      sampled += 1
      itemsInWindow.push({ contactId: item._embedded?.contacts?.[0]?.id, createdAt })
      const unidade = unidadeFromSourceName(item.metadata?.source_name)
      const canal = CHANNEL_BY_SERVICE[item.metadata?.service || ''] || 'Outro'
      matrix[unidade][canal] += 1
    }

    if (crossedLowerBound) break
    if (!hasNext) break
    if (page === UNSORTED_SAFETY_MAX_PAGES || Date.now() - t0 > PAGINATION_BUDGET_MS) {
      capped = true
      break
    }
  }

  let novos: number | null = null
  let existentes: number | null = null
  if (Date.now() - t0 < TOTAL_BUDGET_MS) {
    const uniqueIds = Array.from(new Set(itemsInWindow.map(i => i.contactId).filter((id): id is number => Boolean(id))))
    const createdAtByContact = await fetchContactsCreatedAt(uniqueIds)
    novos = 0
    existentes = 0
    for (const item of itemsInWindow) {
      const contactCreatedAt = item.contactId ? createdAtByContact.get(item.contactId) : undefined
      if (contactCreatedAt === undefined) continue
      if (item.createdAt - contactCreatedAt <= NOVO_THRESHOLD_SECONDS) novos += 1
      else existentes += 1
    }
  }

  return { matrix, channels, unidades, sampled, capped, novos, existentes }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateRange(start: string | null, end: string | null) {
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('BAD_REQUEST: Parâmetros start/end (yyyy-mm-dd) são obrigatórios.')
  }
  return {
    fromUnix: Math.floor(new Date(`${start}T00:00:00-03:00`).getTime() / 1000),
    toUnix: Math.floor(new Date(`${end}T23:59:59-03:00`).getTime() / 1000),
  }
}

/** Valida start/end (yyyy-mm-dd) e conta o tipo de registro pedido no período. */
export async function countForRoute(entity: Entity, start: string | null, end: string | null) {
  const { fromUnix, toUnix } = parseDateRange(start, end)
  return countNewInRange(entity, fromUnix, toUnix)
}

/** Valida start/end (yyyy-mm-dd) e busca a distribuição canal x unidade no período. */
export async function canaisForRoute(start: string | null, end: string | null) {
  const { fromUnix, toUnix } = parseDateRange(start, end)
  return channelsByUnidade(fromUnix, toUnix)
}

// ─────────────────────────────────────────────────────────────────────────────
// Fundo do funil de tráfego: conversas recebidas + leads separados por natureza
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pipelines comerciais (venda) x de recrutamento (vaga de emprego).
 * Sem essa separação o fundo do funil fica dominado por candidata a vaga:
 * em ago/2026, 500 dos 503 leads criados em 28 dias eram do pipeline CANDIDATAS,
 * o que fazia o número parecer resultado de tráfego comercial sem ser.
 */
const PIPELINES_COMERCIAIS: Record<number, string> = {
  8839691: 'Funil de vendas',
  8870775: 'Atendimento Geral',
  8872411: 'Fluxo já clientes',
}
const PIPELINES_RECRUTAMENTO: Record<number, string> = {
  9442459: 'Profissionais',
  10128891: 'Candidatas',
}

/** Nome amigável do canal por onde a conversa chegou. */
const CANAL_LABEL: Record<string, string> = {
  waba: 'WhatsApp',
  instagram_business: 'Instagram (DM)',
  tiktok_kommo: 'TikTok (DM)',
  facebook: 'Facebook',
}

interface LeadRaw {
  pipeline_id: number
  status_id: number
  created_at: number
}

/** Busca os leads criados no período, paginando, e agrupa por pipeline. */
async function leadsPorPipeline(fromUnix: number, toUnix: number) {
  const porPipeline = new Map<number, number>()
  let total = 0
  let capped = false

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl()}/leads?limit=${PAGE_LIMIT}&page=${page}&filter[created_at][from]=${fromUnix}&filter[created_at][to]=${toUnix}`
    let data: { _embedded?: { leads?: LeadRaw[] }; _links?: { next?: unknown } } | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }, cache: 'no-store' })
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        continue
      }
      if (res.status === 204) { data = null; break }
      if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
      data = await res.json()
      break
    }

    const leads = data?._embedded?.leads || []
    if (leads.length === 0) break

    for (const l of leads) {
      total += 1
      porPipeline.set(l.pipeline_id, (porPipeline.get(l.pipeline_id) || 0) + 1)
    }

    if (!data?._links?.next || leads.length < PAGE_LIMIT) break
    if (page === MAX_PAGES) capped = true
  }

  let comercial = 0
  let recrutamento = 0
  let outros = 0
  const detalhe: { pipeline: string; natureza: 'comercial' | 'recrutamento' | 'outro'; leads: number }[] = []

  for (const [pipelineId, count] of porPipeline) {
    if (PIPELINES_COMERCIAIS[pipelineId]) {
      comercial += count
      detalhe.push({ pipeline: PIPELINES_COMERCIAIS[pipelineId], natureza: 'comercial', leads: count })
    } else if (PIPELINES_RECRUTAMENTO[pipelineId]) {
      recrutamento += count
      detalhe.push({ pipeline: PIPELINES_RECRUTAMENTO[pipelineId], natureza: 'recrutamento', leads: count })
    } else {
      outros += count
      detalhe.push({ pipeline: `Pipeline ${pipelineId}`, natureza: 'outro', leads: count })
    }
  }

  detalhe.sort((a, b) => b.leads - a.leads)
  return { total, comercial, recrutamento, outros, detalhe, capped }
}

/**
 * Fundo do funil: conversas recebidas no período (por canal e por perfil),
 * quantas são de contato novo x de quem já falava com a empresa, e os leads
 * criados separados entre comercial e recrutamento.
 */
export async function funilFundo(fromUnix: number, toUnix: number) {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  const t0 = Date.now()
  const PAGINATION_BUDGET_MS = 25_000
  const TOTAL_BUDGET_MS = 40_000

  const porCanal = new Map<string, number>()
  const porPerfil = new Map<string, number>()
  const itemsInWindow: { contactId?: number; createdAt: number }[] = []
  let totalConversas = 0
  let capped = false

  for (let page = 1; page <= UNSORTED_SAFETY_MAX_PAGES; page++) {
    const { items, hasNext } = await fetchUnsortedPage(page)
    if (items.length === 0) break

    let crossedLowerBound = false
    for (const item of items) {
      const createdAt = item.created_at ?? 0
      if (createdAt > toUnix) continue
      if (createdAt < fromUnix) { crossedLowerBound = true; break }

      totalConversas += 1
      itemsInWindow.push({ contactId: item._embedded?.contacts?.[0]?.id, createdAt })

      const canal = CANAL_LABEL[item.metadata?.service || ''] || 'Outro'
      porCanal.set(canal, (porCanal.get(canal) || 0) + 1)

      const perfil = item.metadata?.source_name?.trim() || 'Não identificado'
      porPerfil.set(perfil, (porPerfil.get(perfil) || 0) + 1)
    }

    if (crossedLowerBound) break
    if (!hasNext) break
    if (page === UNSORTED_SAFETY_MAX_PAGES || Date.now() - t0 > PAGINATION_BUDGET_MS) {
      capped = true
      break
    }
  }

  // novo x já falava com a empresa
  let novos: number | null = null
  let existentes: number | null = null
  if (Date.now() - t0 < TOTAL_BUDGET_MS) {
    const uniqueIds = Array.from(new Set(itemsInWindow.map(i => i.contactId).filter((id): id is number => Boolean(id))))
    const createdAtByContact = await fetchContactsCreatedAt(uniqueIds)
    novos = 0
    existentes = 0
    for (const item of itemsInWindow) {
      const contactCreatedAt = item.contactId ? createdAtByContact.get(item.contactId) : undefined
      if (contactCreatedAt === undefined) continue
      if (item.createdAt - contactCreatedAt <= NOVO_THRESHOLD_SECONDS) novos += 1
      else existentes += 1
    }
  }

  const leads = await leadsPorPipeline(fromUnix, toUnix)

  return {
    conversas: {
      total: totalConversas,
      porCanal: Array.from(porCanal, ([canal, total]) => ({ canal, total })).sort((a, b) => b.total - a.total),
      porPerfil: Array.from(porPerfil, ([perfil, total]) => ({ perfil, total })).sort((a, b) => b.total - a.total).slice(0, 12),
      novos,
      existentes,
      capped,
    },
    leads,
  }
}

/** Valida start/end (yyyy-mm-dd) e busca o fundo do funil no período. */
export async function funilFundoForRoute(start: string | null, end: string | null) {
  const { fromUnix, toUnix } = parseDateRange(start, end)
  return funilFundo(fromUnix, toUnix)
}
