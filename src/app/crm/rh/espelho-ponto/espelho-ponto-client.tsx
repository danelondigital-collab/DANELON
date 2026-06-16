'use client'

import { useState, useRef } from 'react'
import {
  Building2, ChevronDown, ChevronRight, AlertTriangle, Clock,
  UserX, Upload, X, Check, Loader2, FileText, Eye, EyeOff,
  TrendingUp, TrendingDown, Minus, AlertCircle
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Profissional {
  id: string
  nome: string
  unidade_id: string
  unidade_nome: string
  cor_agenda: string
  horario_entrada: string | null
  horario_saida: string | null
  intervalo_minutos: number
}

interface RegistroDia {
  id: string
  data: string
  dia_semana: string
  e1: string | null
  s1: string | null
  e2: string | null
  s2: string | null
  tipo_dia: string
  ocorrencia_descricao: string | null
  genyo_previstas: string | null
  genyo_trabalhadas: string | null
  genyo_saldo: string | null
  delta_entrada_min: number
  delta_saida_min: number
  saldo_dia_min: number
  intervalo_real_min: number | null
  intervalo_suprimido_min: number
  he100_min: number
}

interface Importacao {
  id: string
  arquivo_nome: string
  periodo_inicio: string | null
  periodo_fim: string | null
  he50_minutos: number
  he100_minutos: number
  intervalo_suprimido_minutos: number
  horas_negativas_minutos: number
  faltas_sem_justificativa: number
  total_dias_trabalhados: number
  created_at: string
  registros: RegistroDia[]
}

interface ProfissionalComDados {
  profissional: Profissional
  importacoes: Importacao[]
}

interface UnidadeComDados {
  unidade_id: string
  unidade_nome: string
  profissionais: ProfissionalComDados[]
}

interface Props {
  unidades: UnidadeComDados[]
  profissionais: Profissional[]
  unidadeId: string
  todasUnidades: boolean
}

function fmt(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}min`
}

// ─── Modal de Upload ────────────────────────────────────────────────────────

interface UploadModalProps {
  profissional: Profissional
  onClose: () => void
  onSucesso: () => void
}

function UploadModal({ profissional, onClose, onSucesso }: UploadModalProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [entrada, setEntrada] = useState(profissional.horario_entrada || '07:00')
  const [saida, setSaida] = useState(profissional.horario_saida || '16:48')
  const [intervalo, setIntervalo] = useState(String(profissional.intervalo_minutos || 60))
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function extrairTextoPDF(file: File): Promise<string> {
    // Extrai texto do PDF no navegador usando PDF.js — sem enviar o arquivo para o servidor
    const arrayBuffer = await file.arrayBuffer()
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let texto = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      texto += content.items.map((item) => 'str' in item ? (item as { str: string }).str : '').join(' ') + '\n'
    }
    return texto
  }

  async function enviar() {
    if (!arquivo) { setErro('Selecione o PDF da folha de ponto.'); return }
    setLoading(true); setErro(null)

    let texto: string
    try {
      texto = await extrairTextoPDF(arquivo)
    } catch {
      setErro('Erro ao ler o PDF. Verifique se o arquivo não está protegido por senha.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/ponto/processar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto,
        arquivo_nome: arquivo.name,
        profissional_id: profissional.id,
        unidade_id: profissional.unidade_id,
        horario_entrada: entrada,
        horario_saida: saida,
        intervalo_minutos: parseInt(intervalo),
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setErro(json.error || 'Erro ao processar PDF.'); return }

    setSucesso(true)
    setTimeout(() => { onClose(); onSucesso() }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Importar Folha de Ponto</h2>
            <p className="text-xs text-slate-400">{profissional.nome}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {sucesso ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-800">Importado com sucesso!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Horário contratual */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-600">Horário contratual</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Entrada</label>
                  <input type="time" value={entrada} onChange={e => setEntrada(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Saída</label>
                  <input type="time" value={saida} onChange={e => setSaida(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Almoço (min)</label>
                  <input type="number" value={intervalo} onChange={e => setIntervalo(e.target.value)} min={0} max={180}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
            </div>

            {/* Upload PDF */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">PDF da Folha de Ponto (Gênio)</label>
              <div onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors">
                {arquivo ? (
                  <div className="flex items-center justify-center gap-2 text-slate-700">
                    <FileText className="w-5 h-5 text-violet-500" />
                    <span className="text-sm font-medium">{arquivo.name}</span>
                    <button onClick={e => { e.stopPropagation(); setArquivo(null) }} className="text-slate-400 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Clique para selecionar o PDF</p>
                  </>
                )}
              </div>
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={e => setArquivo(e.target.files?.[0] || null)} />
            </div>

            {erro && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{erro}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={enviar} disabled={loading}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Processar e importar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card de dia ────────────────────────────────────────────────────────────

function corDia(tipo: string, saldo: number) {
  if (tipo === 'falta') return 'bg-red-50 border-l-4 border-red-400'
  if (tipo === 'feriado') return 'bg-blue-50 border-l-4 border-blue-400'
  if (tipo === 'atestado') return 'bg-sky-50 border-l-4 border-sky-400'
  if (tipo === 'declaracao_horas') return 'bg-amber-50 border-l-4 border-amber-300'
  if (tipo === 'folga' || tipo === 'recesso') return 'bg-slate-50'
  if (saldo < 0) return 'bg-orange-50 border-l-4 border-orange-400'
  if (saldo > 0) return 'bg-emerald-50/50'
  return ''
}

// ─── Painel de uma importação ───────────────────────────────────────────────

function PainelImportacao({ imp }: { imp: Importacao }) {
  const [expandido, setExpandido] = useState(false)
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const diasVisiveis = mostrarTodos ? imp.registros : imp.registros.slice(0, 10)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Resumo da importação */}
      <div className="bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {imp.periodo_inicio && imp.periodo_fim
                ? `${format(parseISO(imp.periodo_inicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(parseISO(imp.periodo_fim), 'dd/MM/yyyy', { locale: ptBR })}`
                : imp.arquivo_nome}
            </p>
            <p className="text-xs text-slate-400">{imp.total_dias_trabalhados} dias trabalhados</p>
          </div>
          <button onClick={() => setExpandido(v => !v)}
            className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
            {expandido ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar dias</> : <><Eye className="w-3.5 h-3.5" /> Ver dia a dia</>}
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">HE 50%</p>
            <p className="font-bold text-emerald-600 text-sm">{imp.he50_minutos > 0 ? `+${fmt(imp.he50_minutos)}` : '—'}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">HE 100%</p>
            <p className="font-bold text-blue-600 text-sm">{imp.he100_minutos > 0 ? `+${fmt(imp.he100_minutos)}` : '—'}</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Interv. Suprimido</p>
            <p className="font-bold text-violet-600 text-sm">{imp.intervalo_suprimido_minutos > 0 ? `+${fmt(imp.intervalo_suprimido_minutos)}` : '—'}</p>
          </div>
          <div className={`${imp.horas_negativas_minutos > 0 ? 'bg-orange-50' : 'bg-slate-50'} rounded-xl p-3 text-center`}>
            <p className="text-xs text-slate-500 mb-0.5">H. Negativas</p>
            <p className={`font-bold text-sm ${imp.horas_negativas_minutos > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
              {imp.horas_negativas_minutos > 0 ? `−${fmt(imp.horas_negativas_minutos)}` : '—'}
            </p>
          </div>
          <div className={`${imp.faltas_sem_justificativa > 0 ? 'bg-red-50' : 'bg-slate-50'} rounded-xl p-3 text-center`}>
            <p className="text-xs text-slate-500 mb-0.5">Faltas s/ just.</p>
            <p className={`font-bold text-sm ${imp.faltas_sem_justificativa > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {imp.faltas_sem_justificativa > 0 ? imp.faltas_sem_justificativa : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabela dia a dia */}
      {expandido && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Data</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">E1</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">S1</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">E2</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">S2</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Δ Entrada</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Δ Saída</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Saldo dia</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Almoço</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Int. Sup.</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">HE 100%</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Ocorrência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diasVisiveis.map(r => {
                  const dataISO = (() => { const [d, m, y] = r.data.split('/'); return y ? `${y}-${m}-${d}` : r.data })()
                  return (
                    <tr key={r.id} className={corDia(r.tipo_dia, r.saldo_dia_min)}>
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                        {(() => { try { return format(parseISO(dataISO), 'dd/MM EEE', { locale: ptBR }) } catch { return r.data } })()}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.e1 || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.s1 || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.e2 || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.s2 || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {r.delta_entrada_min > 0
                          ? <span className="text-emerald-600 font-semibold">+{fmt(r.delta_entrada_min)}</span>
                          : r.delta_entrada_min < 0
                          ? <span className="text-red-500 font-semibold">−{fmt(Math.abs(r.delta_entrada_min))}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.delta_saida_min > 0
                          ? <span className="text-emerald-600 font-semibold">+{fmt(r.delta_saida_min)}</span>
                          : r.delta_saida_min < 0
                          ? <span className="text-orange-500 font-semibold">−{fmt(Math.abs(r.delta_saida_min))}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.saldo_dia_min > 0
                          ? <span className="text-emerald-600 font-bold">+{fmt(r.saldo_dia_min)}</span>
                          : r.saldo_dia_min < 0
                          ? <span className="text-red-600 font-bold">−{fmt(Math.abs(r.saldo_dia_min))}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500">
                        {r.intervalo_real_min != null ? fmt(r.intervalo_real_min) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.intervalo_suprimido_min > 0
                          ? <span className="text-violet-600 font-semibold">+{fmt(r.intervalo_suprimido_min)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.he100_min > 0
                          ? <span className="text-blue-600 font-semibold">+{fmt(r.he100_min)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate">
                        {r.ocorrencia_descricao || (r.tipo_dia === 'folga' ? 'Folga' : r.tipo_dia === 'falta' ? '⚠ Falta' : '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {imp.registros.length > 10 && (
            <div className="px-4 py-2 border-t border-slate-100">
              <button onClick={() => setMostrarTodos(v => !v)} className="text-xs text-violet-600 hover:text-violet-800">
                {mostrarTodos ? 'Mostrar menos' : `Ver todos os ${imp.registros.length} dias`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card de profissional ───────────────────────────────────────────────────

function CardProfissional({ dados, onUpload }: { dados: ProfissionalComDados; onUpload: () => void }) {
  const [expandido, setExpandido] = useState(false)
  const ultima = dados.importacoes[0]

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setExpandido(v => !v)} className="flex items-center gap-3 text-left flex-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: dados.profissional.cor_agenda }}>
            {dados.profissional.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">{dados.profissional.nome}</p>
            {ultima ? (
              <p className="text-xs text-slate-400">
                Último: {ultima.periodo_inicio && ultima.periodo_fim
                  ? `${format(parseISO(ultima.periodo_inicio), 'MM/yyyy', { locale: ptBR })}`
                  : ultima.arquivo_nome}
                {ultima.faltas_sem_justificativa > 0 && <span className="text-red-500 ml-2">⚠ {ultima.faltas_sem_justificativa} falta{ultima.faltas_sem_justificativa > 1 ? 's' : ''}</span>}
                {ultima.horas_negativas_minutos > 0 && <span className="text-orange-500 ml-2">−{fmt(ultima.horas_negativas_minutos)}</span>}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Sem importações</p>
            )}
          </div>
          {expandido ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        <button onClick={onUpload}
          className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium transition-colors flex-shrink-0">
          <Upload className="w-3.5 h-3.5" /> Importar
        </button>
      </div>

      {expandido && dados.importacoes.length > 0 && (
        <div className="px-5 pb-4 space-y-3">
          {dados.importacoes.map(imp => <PainelImportacao key={imp.id} imp={imp} />)}
        </div>
      )}

      {expandido && dados.importacoes.length === 0 && (
        <div className="px-5 pb-4">
          <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-400">
            Nenhuma folha de ponto importada. Clique em "Importar" para começar.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card de unidade ────────────────────────────────────────────────────────

function CardUnidade({ unidade, profissionais, onUpload }: {
  unidade: UnidadeComDados
  profissionais: Profissional[]
  onUpload: (prof: Profissional) => void
}) {
  const [expandido, setExpandido] = useState(true)

  const totalFaltas = unidade.profissionais.reduce((acc, p) => acc + (p.importacoes[0]?.faltas_sem_justificativa ?? 0), 0)
  const totalNeg = unidade.profissionais.reduce((acc, p) => acc + (p.importacoes[0]?.horas_negativas_minutos ?? 0), 0)
  const comImportacao = unidade.profissionais.filter(p => p.importacoes.length > 0).length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{unidade.unidade_nome}</p>
            <p className="text-xs text-slate-500">
              {comImportacao}/{unidade.profissionais.length} profissionais com folha importada
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {totalFaltas > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Faltas</p>
              <p className="font-bold text-red-500">{totalFaltas}</p>
            </div>
          )}
          {totalNeg > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">H. Negativas</p>
              <p className="font-bold text-orange-500">−{fmt(totalNeg)}</p>
            </div>
          )}
          {expandido ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {unidade.profissionais.map(p => (
            <CardProfissional
              key={p.profissional.id}
              dados={p}
              onUpload={() => onUpload(p.profissional)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function EspelhoPontoClient({ unidades, profissionais, unidadeId, todasUnidades }: Props) {
  const [uploadProf, setUploadProf] = useState<Profissional | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <div className="space-y-4" key={refreshKey}>
        {unidades.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum registro importado ainda.</p>
            <p className="text-sm text-slate-400 mt-1">
              Clique em "Importar" ao lado de uma profissional para começar.
            </p>
          </div>
        )}
        {unidades.map(u => (
          <CardUnidade
            key={u.unidade_id}
            unidade={u}
            profissionais={profissionais.filter(p => p.unidade_id === u.unidade_id)}
            onUpload={prof => setUploadProf(prof)}
          />
        ))}
      </div>

      {uploadProf && (
        <UploadModal
          profissional={uploadProf}
          onClose={() => setUploadProf(null)}
          onSucesso={() => { setUploadProf(null); setRefreshKey(k => k + 1) }}
        />
      )}
    </>
  )
}
