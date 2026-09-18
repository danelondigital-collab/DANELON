'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DollarSign, Plus, Trash2, Loader2, HelpCircle, AlertTriangle, Eye, MousePointerClick, Target, Building2, ArrowRight } from 'lucide-react'

const GOLD = '#B8924A'
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
const fmt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Cada plataforma de anúncio corresponde a um ou mais grupos de origem do GA4.
 * A Meta cobre Instagram e Facebook porque o mesmo investimento alimenta os dois.
 */
const GRUPOS_POR_PLATAFORMA: Record<string, string[]> = {
  'TikTok Ads': ['TikTok Ads'],
  'Google Ads': ['Google Ads'],
  'Meta': ['Instagram', 'Facebook'],
}

const PLATAFORMAS = Object.keys(GRUPOS_POR_PLATAFORMA)

/**
 * O TikTok Ads saiu de todos os números de tráfego do relatório: a fonte clica
 * em quase todos os botões da página em cada sessão (5,0 por sessão, contra
 * ~1,2 de qualquer outra), o que inflava os cliques e mascarava a procura real
 * por unidade. A verba continua aqui, à vista, mas sem visita e sem contato pra
 * dividir — por isso ela não entra em custo por contato nem no total comercial.
 */
const PLATAFORMA_FORA_DO_FUNIL = 'TikTok Ads'

/** As 4 unidades físicas — usado no lançamento e pra casar com GA4 (porPerfil/botões). */
const UNIDADES = ['Morumbi', 'Santo André', 'Alphaville', 'Goiânia']

/**
 * Tipo de campanha. Sem isso o total da plataforma junta objetivos que não têm
 * nada a ver um com o outro — a verba que busca cliente e a que busca
 * funcionário, por exemplo. A classificação é por campanha: Curso junta a
 * campanha do curso e o remarketing dele (KMT CURSO); Genérico junta o que
 * divulga a marca sem unidade definida (Reconhecimento Nacional e o RMK dos
 * perfis DANELON/Elaine).
 */
const CATEGORIAS = ['Curso', 'Genérico', 'Unidades', 'Contratação']

/** Contratação é verba de RH, não de aquisição — some no custo por contato de cliente. */
const CATEGORIA_NAO_COMERCIAL = 'Contratação'

const COR_CATEGORIA: Record<string, string> = {
  'Curso': '#B8924A',
  'Genérico': '#1F2937',
  'Unidades': '#0F766E',
  'Contratação': '#9CA3AF',
}

/** Como a Meta aparece na tabela: Salão fica com tudo que não é Curso nem Contratação. */
const RECORTES_META = [
  { rotulo: 'Meta · Salão', pertence: (c: string) => c !== 'Curso' && c !== CATEGORIA_NAO_COMERCIAL, comFunil: true },
  { rotulo: 'Meta · Curso', pertence: (c: string) => c === 'Curso', comFunil: false },
  { rotulo: 'Meta · Contratação', pertence: (c: string) => c === CATEGORIA_NAO_COMERCIAL, comFunil: false },
]

/** Remove acento/espaço/caixa pra comparar nomes de unidade vindos de fontes diferentes
 * (formulário, campanha do GA4 "perfil_santoandre", evento de botão "Unidade Santo Andre"). */
function normalizarUnidade(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '')
}

interface Investimento {
  id: string
  plataforma: string
  destino: 'site' | 'perfil'
  unidade: string
  categoria: string
  mes: string
  valor: number
  impressoes: number | null
  cliques: number | null
  resultados: number | null
  observacoes: string | null
}

/** Como cada plataforma chama sua própria métrica de "resultado" — não são comparáveis entre si. */
const ROTULO_RESULTADO: Record<string, string> = {
  'TikTok Ads': 'Conversões (clique em contato)',
  'Google Ads': 'Conversões',
  'Meta': 'Resultados (perfil, alcance, leads — misto)',
}

interface FonteFunil {
  grupo: string
  sessoes: number
  visitantes: number
  usuariosQueClicaram: number
}

interface PerfilFunil {
  perfil: string
  /** plataforma do link de bio (Instagram, TikTok…) */
  fonte: string
  sessoes: number
  visitantes: number
}

interface BotaoFunil {
  nome: string
  cliques: number
  pessoas: number
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip">
      <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
      <span className="pointer-events-none absolute z-30 hidden group-hover/tip:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-800 text-white text-xs leading-relaxed p-2.5 shadow-lg normal-case font-normal text-left">
        {text}
      </span>
    </span>
  )
}

export default function InvestimentoSection({
  range,
  porFonte,
  porPerfil,
  botoes,
}: {
  range: { start: string; end: string }
  porFonte: FonteFunil[]
  porPerfil: PerfilFunil[]
  botoes: BotaoFunil[]
}) {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [plataforma, setPlataforma] = useState('TikTok Ads')
  const [destino, setDestino] = useState<'site' | 'perfil'>('site')
  const [unidade, setUnidade] = useState('')
  const [categoria, setCategoria] = useState('')
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [valor, setValor] = useState('')
  const [impressoes, setImpressoes] = useState('')
  const [cliques, setCliques] = useState('')
  const [resultados, setResultados] = useState('')

  // Mesma proteção de rodada das outras buscas da página: resposta de um período
  // antigo não pode chegar depois e sobrescrever a do período atual.
  const reqIdRef = useRef(0)

  const buscar = useCallback(async () => {
    const reqId = ++reqIdRef.current
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/funil/investimento?start=${range.start}&end=${range.end}`, { cache: 'no-store' })
      const json = await res.json()
      if (reqId !== reqIdRef.current) return
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar investimentos.')
      setInvestimentos(json.investimentos)
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setErro(e instanceof Error ? e.message : 'Erro ao carregar investimentos.')
    } finally {
      if (reqId === reqIdRef.current) setCarregando(false)
    }
  }, [range])

  useEffect(() => { buscar() }, [buscar])

  async function salvar() {
    if (!valor.trim()) { setErro('Informe o valor gasto.'); return }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/funil/investimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plataforma, destino, unidade, categoria, mes: `${mes}-01`, valor,
          impressoes: impressoes || null,
          cliques: cliques || null,
          resultados: resultados || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar.')
      setValor('')
      setImpressoes('')
      setCliques('')
      setResultados('')
      setFormAberto(false)
      buscar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    try {
      const res = await fetch(`/api/funil/investimento?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir.')
      buscar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir.')
    }
  }

  /** Cruza o gasto de cada plataforma com as visitas e contatos que ela gerou.
   * Os lançamentos por unidade entram: desde a classificação por campanha, a
   * verba das unidades só existe neles (o lançamento geral não a repete).
   *
   * A Meta é quebrada em Salão, Curso e Contratação: são públicos e objetivos
   * diferentes, e misturar curso e vaga de emprego no custo do salão distorce
   * a conta. Curso e Contratação mostram gasto e topo do funil da plataforma,
   * mas não visita/contato — o GA4 não separa por campanha da Meta, então
   * visita e contato ficam todos na linha do Salão. */
  const linhas = useMemo(() => {
    const recortes = PLATAFORMAS.flatMap(p =>
      p === 'Meta'
        ? RECORTES_META.map(r => ({
            plataforma: p,
            rotulo: r.rotulo,
            doPeriodo: investimentos.filter(i => i.plataforma === p && r.pertence(i.categoria)),
            comFunil: r.comFunil,
          }))
        : [{ plataforma: p, rotulo: p, doPeriodo: investimentos.filter(i => i.plataforma === p), comFunil: true }]
    )
    return recortes.map(({ plataforma: p, rotulo, doPeriodo, comFunil }) => {
      const gastoSite = doPeriodo.filter(i => i.destino === 'site').reduce((s, i) => s + Number(i.valor), 0)
      const gastoPerfil = doPeriodo.filter(i => i.destino === 'perfil').reduce((s, i) => s + Number(i.valor), 0)
      const gastoTotal = gastoSite + gastoPerfil

      // topo do funil reportado pela própria plataforma (opcional por lançamento)
      const somaOpcional = (campo: 'impressoes' | 'cliques' | 'resultados') =>
        doPeriodo.some(i => i[campo] !== null)
          ? doPeriodo.reduce((s, i) => s + (i[campo] ?? 0), 0)
          : null
      const impressoesPlataforma = somaOpcional('impressoes')
      const cliquesPlataforma = somaOpcional('cliques')
      const resultadosPlataforma = somaOpcional('resultados')

      const grupos = comFunil ? GRUPOS_POR_PLATAFORMA[p] : []
      const fontes = porFonte.filter(f => grupos.includes(f.grupo))
      const visitas = fontes.reduce((s, f) => s + f.sessoes, 0)
      const contatos = fontes.reduce((s, f) => s + f.usuariosQueClicaram, 0)

      return {
        plataforma: p,
        rotulo,
        comFunil,
        gastoSite,
        gastoPerfil,
        gastoTotal,
        impressoesPlataforma,
        cliquesPlataforma,
        resultadosPlataforma,
        visitas,
        contatos,
        // custo por contato usa o gasto TOTAL da plataforma: mesmo a verba que
        // vai pro perfil acaba desaguando em contato, só que por um caminho
        // que o site não enxerga
        custoPorVisita: visitas > 0 ? gastoTotal / visitas : null,
        custoPorContato: contatos > 0 ? gastoTotal / contatos : null,
        temLancamento: doPeriodo.length > 0,
        foraDoFunil: p === PLATAFORMA_FORA_DO_FUNIL,
      }
    }).filter(l => l.temLancamento || l.visitas > 0)
  }, [investimentos, porFonte])

  /** Gasto por tipo de campanha, somando todas as plataformas e unidades.
   * Diferente da tabela por plataforma, aqui os lançamentos por unidade CONTAM:
   * eles são justamente o detalhe da categoria "Unidades". */
  const porCategoria = useMemo(() => {
    const acc = new Map<string, number>()
    for (const i of investimentos) {
      const c = i.categoria || 'Sem tipo'
      acc.set(c, (acc.get(c) || 0) + Number(i.valor))
    }
    return Array.from(acc.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [investimentos])

  const totalCategorias = porCategoria.reduce((s, c) => s + c.valor, 0)
  /** Verba que de fato busca cliente E aparece no funil: tira contratação (RH)
   * e tira a plataforma que ficou fora do relatório por qualidade de tráfego. */
  const totalComercial = investimentos
    .filter(i => i.categoria !== CATEGORIA_NAO_COMERCIAL && i.plataforma !== PLATAFORMA_FORA_DO_FUNIL)
    .reduce((s, i) => s + Number(i.valor), 0)

  // o total da tabela ignora o que não tem visita nem contato pra dividir
  // (plataforma fora do funil, Curso e Contratação da Meta): entraria
  // distorcendo o custo médio
  const linhasNoFunil = linhas.filter(l => !l.foraDoFunil && l.comFunil)
  const totalGasto = linhasNoFunil.reduce((s, l) => s + l.gastoTotal, 0)
  const totalContatos = linhasNoFunil.reduce((s, l) => s + l.contatos, 0)
  const algumLancamento = investimentos.length > 0

  // melhor e pior custo por contato, pra destacar na tabela
  const custos = linhas.map(l => l.custoPorContato).filter((c): c is number => c !== null && c > 0)
  const melhor = custos.length > 0 ? Math.min(...custos) : null
  const pior = custos.length > 0 ? Math.max(...custos) : null

  /**
   * Funil por unidade: da campanha da Meta que leva pro perfil daquela
   * unidade até o clique no botão de contato daquela mesma unidade no site.
   * Cruza 3 fontes que não têm a mesma chave de nome, então casa por
   * normalização (sem acento/espaço/caixa): lançamento manual (unidade =
   * "Santo André"), GA4 por perfil (perfil = "santoandre", vem do UTM da
   * bio) e GA4 por botão (nome = "Unidade Santo Andre", vem do evento).
   */
  const funilPorUnidade = useMemo(() => {
    return UNIDADES.map(u => {
      const chave = normalizarUnidade(u)

      // soma os meses: um filtro que atravessa agosto e setembro tem um
      // lançamento de cada, e pegar só o primeiro mostrava meio período
      const daUnidade = investimentos.filter(i => normalizarUnidade(i.unidade) === chave)
      const somaCampo = (c: 'impressoes' | 'cliques') =>
        daUnidade.some(i => i[c] !== null) ? daUnidade.reduce((s, i) => s + (i[c] ?? 0), 0) : null
      const lancamento = daUnidade.length > 0
        ? { valor: daUnidade.reduce((s, i) => s + Number(i.valor), 0), impressoes: somaCampo('impressoes'), cliques: somaCampo('cliques') }
        : null
      // Soma todas as plataformas: a mesma unidade pode ter link de bio no
      // Instagram e no TikTok, e pegar só o primeiro subcontaria a visita.
      const perfis = porPerfil.filter(p => normalizarUnidade(p.perfil).includes(chave))
      const botao = botoes.find(b => normalizarUnidade(b.nome).includes(chave))

      return {
        unidade: u,
        valor: lancamento ? Number(lancamento.valor) : null,
        impressoes: lancamento?.impressoes ?? null,
        cliquesMeta: lancamento?.cliques ?? null,
        visitasPerfil: perfis.length > 0 ? perfis.reduce((s, p) => s + p.sessoes, 0) : null,
        pessoasPerfil: perfis.length > 0 ? perfis.reduce((s, p) => s + p.visitantes, 0) : null,
        cliquesBotao: botao?.cliques ?? null,
        pessoasBotao: botao?.pessoas ?? null,
        temDado: Boolean(lancamento || perfis.length > 0 || botao),
      }
    }).filter(u => u.temDado)
  }, [investimentos, porPerfil, botoes])

  return (
    <div className="space-y-4">
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Investimento e custo por contato
          <InfoTooltip text="Cruza quanto foi gasto em cada plataforma com quantas pessoas ela trouxe e quantas puxaram conversa. É o número que diz qual canal está saindo mais caro de verdade — volume alto e barato pode custar mais por contato que volume baixo e caro." />
        </p>
        <button
          onClick={() => setFormAberto(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <Plus className="w-3.5 h-3.5" /> Lançar gasto
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Os valores acompanham o filtro de período da página.
      </p>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-3">{erro}</div>
      )}

      {formAberto && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plataforma</label>
              <select value={plataforma} onChange={e => setPlataforma(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
                {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Destino
                <InfoTooltip text="Pra onde a campanha manda a pessoa. 'Site' entra no cálculo de custo por visita. 'Perfil' é a campanha que leva pro Instagram — não gera visita direta no site, mas alimenta o link na bio." />
              </label>
              <select value={destino} onChange={e => setDestino(e.target.value as 'site' | 'perfil')}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="site">Leva pro site</option>
                <option value="perfil">Leva pro perfil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Unidade
                <InfoTooltip text="Opcional. Preencha só quando a campanha é de uma unidade específica (ex: 'MORUMBI - PERFIL DANELON MORUMBI'). Deixe em branco pra campanha geral (Reconhecimento Nacional, RMK, Curso) — esses já entram no total da plataforma; os por unidade só alimentam o funil por unidade, sem duplicar o gasto." />
              </label>
              <select value={unidade} onChange={e => setUnidade(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">— geral —</option>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Tipo
                <InfoTooltip text="Que tipo de campanha é essa verba: Curso, remarketing do curso, remarketing do salão, unidade específica, alcance nacional/estadual ou contratação. Contratação é verba de RH — entra no total, mas fica fora do custo por contato de cliente." />
              </label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">— sem tipo —</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mês</label>
              <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor gasto (R$)</label>
              <input type="text" inputMode="decimal" value={valor} placeholder="0,00"
                onChange={e => setValor(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Impressões
                <InfoTooltip text="Opcional. Vem do relatório que a própria plataforma exporta (Google Ads, Meta Ads Manager, TikTok Ads Manager) — quantas vezes o anúncio apareceu no período." />
              </label>
              <input type="text" inputMode="numeric" value={impressoes} placeholder="ex: 171485"
                onChange={e => setImpressoes(e.target.value.replace(/\D/g, ''))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Cliques / visualizações
                <InfoTooltip text="Opcional. Cliques ou visualizações reportados pela plataforma — não é o clique no botão de contato do site, esse já vem do GA4 automaticamente." />
              </label>
              <input type="text" inputMode="numeric" value={cliques} placeholder="ex: 79327"
                onChange={e => setCliques(e.target.value.replace(/\D/g, ''))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                Resultados
                <InfoTooltip text="Opcional. O 'resultado' que a própria plataforma contabilizou (conversão, lead etc.) — a definição varia por plataforma, então não dá pra somar Google + Meta + TikTok num número só." />
              </label>
              <input type="text" inputMode="numeric" value={resultados} placeholder="ex: 41468"
                onChange={e => setResultados(e.target.value.replace(/\D/g, ''))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button onClick={salvar} disabled={salvando}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: GOLD }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={() => setFormAberto(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white">
              Cancelar
            </button>
            <span className="text-[11px] text-gray-400 ml-1">
              Lançar o mesmo mês de novo atualiza o valor, não duplica.
            </span>
          </div>
        </div>
      )}

      {/* Topo do funil: o que cada plataforma reportou antes de qualquer clique
          chegar no site — impressão, clique/visualização, resultado próprio. */}
      {linhas.some(l => l.impressoesPlataforma !== null || l.cliquesPlataforma !== null || l.resultadosPlataforma !== null) && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2.5 flex items-center gap-1">
            Topo do funil, reportado pela própria plataforma
            <InfoTooltip text="Impressão, clique e resultado como o Google Ads, o Meta Ads Manager e o TikTok Ads Manager contam — antes de qualquer coisa acontecer no site. Alimenta manualmente pelo relatório exportado de cada plataforma; 'Resultado' não é comparável entre elas, cada uma define diferente." />
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {linhas
              .filter(l => l.impressoesPlataforma !== null || l.cliquesPlataforma !== null || l.resultadosPlataforma !== null)
              .map(l => (
                <div key={l.rotulo} className="rounded-lg border border-gray-200 p-3.5">
                  <p className="text-xs font-semibold text-gray-700 mb-2.5">{l.rotulo}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1"><Eye className="w-3 h-3" /> Impressões</span>
                      <span className="tabular-nums font-medium text-gray-800">
                        {l.impressoesPlataforma !== null ? fmt(l.impressoesPlataforma) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Cliques/views</span>
                      <span className="tabular-nums font-medium text-gray-800">
                        {l.cliquesPlataforma !== null ? fmt(l.cliquesPlataforma) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                      <span className="text-gray-500 flex items-center gap-1"><Target className="w-3 h-3" /> Resultados</span>
                      <span className="tabular-nums font-semibold" style={{ color: GOLD }}>
                        {l.resultadosPlataforma !== null ? fmt(l.resultadosPlataforma) : '—'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 leading-snug">{ROTULO_RESULTADO[l.plataforma]}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Por tipo de campanha: onde a verba está indo, independente de plataforma */}
      {!carregando && porCategoria.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2.5 flex items-center gap-1">
            Onde a verba está indo, por tipo de campanha
            <InfoTooltip text="Soma de todas as plataformas por objetivo da campanha. Contratação aparece porque é dinheiro gasto de verdade, mas é verba de RH: ela não busca cliente, então fica fora do total comercial usado pra julgar aquisição." />
          </p>
          <div className="h-3 rounded-full overflow-hidden flex bg-gray-100 mb-2.5">
            {porCategoria.map(c => (
              <div
                key={c.categoria}
                title={`${c.categoria}: ${fmtBRL(c.valor)}`}
                style={{
                  width: `${totalCategorias > 0 ? (c.valor / totalCategorias) * 100 : 0}%`,
                  backgroundColor: COR_CATEGORIA[c.categoria] || '#D1D5DB',
                }}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {porCategoria.map(c => (
              <div key={c.categoria} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: COR_CATEGORIA[c.categoria] || '#D1D5DB' }} />
                  {c.categoria}
                  {c.categoria === CATEGORIA_NAO_COMERCIAL && (
                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                      RH, não é aquisição
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="tabular-nums font-medium text-gray-800">{fmtBRL(c.valor)}</span>
                  <span className="tabular-nums text-gray-400 w-11 text-right">
                    {totalCategorias > 0 ? `${((c.valor / totalCategorias) * 100).toFixed(1)}%` : '—'}
                  </span>
                </span>
              </div>
            ))}
            {totalComercial !== totalCategorias && (
              <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-gray-100">
                <span className="text-gray-500">
                  Total comercial (sem contratação e sem {PLATAFORMA_FORA_DO_FUNIL})
                </span>
                <span className="tabular-nums font-semibold text-gray-800">{fmtBRL(totalComercial)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-400 py-6 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando lançamentos…
        </p>
      ) : !algumLancamento ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-1">Nenhum gasto lançado neste período.</p>
          <p className="text-xs text-gray-400">
            Clique em &quot;Lançar gasto&quot; pra informar quanto foi investido em cada plataforma.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-2">Plataforma</th>
                  <th className="text-right font-medium pb-2">Gasto</th>
                  <th className="text-right font-medium pb-2">Visitas</th>
                  <th className="text-right font-medium pb-2">
                    <span className="inline-flex items-center gap-1">
                      Contatos
                      <InfoTooltip text="Pessoas que clicaram em algum botão de contato no site vindas dessa plataforma." />
                    </span>
                  </th>
                  <th className="text-right font-medium pb-2">Custo/visita</th>
                  <th className="text-right font-medium pb-2 pl-4">
                    <span className="inline-flex items-center gap-1">
                      Custo por contato
                      <InfoTooltip text="Gasto total da plataforma dividido pelas pessoas que puxaram conversa. É a métrica que realmente compara os canais: quanto custou cada pessoa interessada." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {linhas.map(l => (
                  <tr key={l.rotulo} className="hover:bg-gray-50/60">
                    <td className="py-2.5 text-gray-700">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {l.rotulo}
                        {(l.foraDoFunil || !l.comFunil) && (
                          <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                            {l.foraDoFunil ? 'fora do funil' : 'fora do custo do salão'}
                          </span>
                        )}
                      </span>
                      {l.gastoPerfil > 0 && (
                        <span className="block text-[10px] text-gray-400">
                          {fmtBRL(l.gastoSite)} site · {fmtBRL(l.gastoPerfil)} perfil
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-gray-700">
                      {l.gastoTotal > 0 ? fmtBRL(l.gastoTotal) : <span className="text-gray-300">não lançado</span>}
                    </td>
                    <td className="text-right tabular-nums text-gray-500">{l.comFunil ? fmt(l.visitas) : '—'}</td>
                    <td className="text-right tabular-nums text-gray-500">{l.comFunil ? fmt(l.contatos) : '—'}</td>
                    <td className="text-right tabular-nums text-gray-500">
                      {l.custoPorVisita !== null ? fmtBRL(l.custoPorVisita) : '—'}
                    </td>
                    <td className="text-right tabular-nums pl-4">
                      {l.custoPorContato !== null ? (
                        <span
                          className="font-bold"
                          style={{
                            color:
                              l.custoPorContato === melhor ? '#15803D'
                              : l.custoPorContato === pior ? '#B91C1C'
                              : '#374151',
                          }}
                        >
                          {fmtBRL(l.custoPorContato)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {totalGasto > 0 && (
                  <tr className="border-t-2 border-gray-200 font-medium">
                    <td className="py-2.5 text-gray-700">Total</td>
                    <td className="text-right tabular-nums text-gray-900">{fmtBRL(totalGasto)}</td>
                    <td className="text-right tabular-nums text-gray-500">
                      {fmt(linhas.reduce((s, l) => s + l.visitas, 0))}
                    </td>
                    <td className="text-right tabular-nums text-gray-500">{fmt(totalContatos)}</td>
                    <td />
                    <td className="text-right tabular-nums pl-4 text-gray-900 font-bold">
                      {totalContatos > 0 ? fmtBRL(totalGasto / totalContatos) : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* lançamentos individuais, pra conferir e corrigir */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Lançamentos no período</p>
            <ul className="space-y-1.5">
              {investimentos.map(i => (
                <li key={i.id} className="flex items-center justify-between text-xs text-gray-600 group">
                  <span>
                    {i.plataforma}
                    <span className="text-gray-400"> · {i.destino === 'perfil' ? 'perfil' : 'site'}{i.unidade ? ` · ${i.unidade}` : ''} · </span>
                    {new Date(i.mes + 'T12:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums font-medium text-gray-700">{fmtBRL(Number(i.valor))}</span>
                    <button onClick={() => excluir(i.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              O custo por contato usa o gasto <strong>total</strong> da plataforma, inclusive a verba que leva
              pro perfil. Isso é proposital: a campanha que manda pro Instagram não vira visita no site, mas
              acaba gerando contato pelo link na bio e pela DM — descontar ela faria o custo da Meta parecer
              melhor do que é. Já o &quot;custo por visita&quot; da Meta fica distorcido pra cima pelo mesmo
              motivo, então compare os canais pelo custo por contato, não pelo custo por visita.
            </p>
          </div>
        </>
      )}
    </div>

    {/* Funil por unidade: da campanha da Meta até o clique no botão daquela unidade */}
    {funilPorUnidade.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Funil por unidade
          <InfoTooltip text="Da campanha da Meta que leva pro perfil daquela unidade até o clique no botão de contato da mesma unidade no site. Cruza 3 fontes diferentes (lançamento manual, GA4 por perfil, GA4 por botão) — hoje só a Meta tem campanha separada por unidade." />
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Investimento (Meta) → visita ao perfil → clique no botão daquela unidade, lado a lado.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {funilPorUnidade.map(u => {
            const custoPorClique = u.valor !== null && u.cliquesBotao ? u.valor / u.cliquesBotao : null
            return (
              <div key={u.unidade} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">{u.unidade}</p>
                <div className="flex items-center gap-2 text-center">
                  <div className="flex-1">
                    <p className="text-lg font-bold tabular-nums" style={{ color: GOLD }}>
                      {u.valor !== null ? fmtBRL(u.valor) : '—'}
                    </p>
                    <p className="text-[10px] text-gray-500">investido (Meta)</p>
                    {u.impressoes !== null && (
                      <p className="text-[10px] text-gray-400">{fmt(u.impressoes)} impr.</p>
                    )}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <div className="flex-1">
                    <p className="text-lg font-bold tabular-nums text-pink-700">
                      {u.visitasPerfil !== null ? fmt(u.visitasPerfil) : '—'}
                    </p>
                    <p className="text-[10px] text-gray-500">visitas (link bio)</p>
                    {u.pessoasPerfil !== null && (
                      <p className="text-[10px] text-gray-400">{fmt(u.pessoasPerfil)} pessoas</p>
                    )}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <div className="flex-1">
                    <p className="text-lg font-bold tabular-nums text-teal-700">
                      {u.cliquesBotao !== null ? fmt(u.cliquesBotao) : '—'}
                    </p>
                    <p className="text-[10px] text-gray-500">cliques no botão</p>
                    {u.pessoasBotao !== null && (
                      <p className="text-[10px] text-gray-400">{fmt(u.pessoasBotao)} pessoas</p>
                    )}
                  </div>
                </div>
                {custoPorClique !== null && (
                  <p className="text-[11px] text-gray-400 mt-3 pt-2 border-t border-gray-100 text-center">
                    {fmtBRL(custoPorClique)} por clique no botão dessa unidade
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            As 3 colunas não são necessariamente a mesma pessoa passo a passo: quem clica no botão daquela
            unidade pode ter chegado por outra origem (TikTok, direto), não só pelo link de bio daquele
            perfil. Trate como estágios do processo daquela unidade, não como um funil fechado pessoa por
            pessoa — o mesmo aviso já vale pro funil geral lá em cima.
          </p>
        </div>
      </div>
    )}
    </div>
  )
}
