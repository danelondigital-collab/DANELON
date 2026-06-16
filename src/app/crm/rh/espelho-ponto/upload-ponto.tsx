'use client'

import { useState, useRef } from 'react'
import { Upload, X, Check, Loader2, FileSpreadsheet, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface Profissional {
  id: string
  nome: string
  unidade_id: string
  unidade_nome: string
}

interface RegistroPreview {
  data: string
  entrada: string
  saida_almoco: string
  retorno_almoco: string
  saida: string
  horas_trabalhadas: string
  atraso_minutos: number
  falta: boolean
  observacoes: string
  [key: string]: string | number | boolean
}

interface Props {
  profissionais: Profissional[]
  unidadeId: string
  todasUnidades: boolean
  onImportado: () => void
}

// Mapeamento automático de colunas comuns nos relatórios de ponto
const COL_MAP: Record<string, keyof RegistroPreview> = {
  'data': 'data', 'date': 'data', 'dia': 'data',
  'entrada': 'entrada', 'entry': 'entrada', 'horario entrada': 'entrada', 'hora entrada': 'entrada',
  'saida almoco': 'saida_almoco', 'saída almoço': 'saida_almoco', 'saida almoço': 'saida_almoco', 'intervalo saida': 'saida_almoco',
  'retorno almoco': 'retorno_almoco', 'retorno almoço': 'retorno_almoco', 'intervalo retorno': 'retorno_almoco', 'volta almoco': 'retorno_almoco',
  'saida': 'saida', 'saída': 'saida', 'hora saida': 'saida', 'horario saida': 'saida',
  'horas': 'horas_trabalhadas', 'horas trabalhadas': 'horas_trabalhadas', 'total horas': 'horas_trabalhadas',
  'atraso': 'atraso_minutos', 'atraso min': 'atraso_minutos', 'minutos atraso': 'atraso_minutos',
  'falta': 'falta', 'ausencia': 'falta', 'ausência': 'falta',
  'obs': 'observacoes', 'observacao': 'observacoes', 'observação': 'observacoes', 'observacoes': 'observacoes', 'observações': 'observacoes',
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function mapearColunas(headers: string[], rows: Record<string, string>[]): RegistroPreview[] {
  const mapa: Record<string, keyof RegistroPreview> = {}
  for (const h of headers) {
    const norm = normalizar(h)
    if (COL_MAP[norm]) mapa[h] = COL_MAP[norm]
  }

  return rows.map(row => {
    const r: RegistroPreview = {
      data: '', entrada: '', saida_almoco: '', retorno_almoco: '',
      saida: '', horas_trabalhadas: '', atraso_minutos: 0, falta: false, observacoes: '',
    }
    for (const [col, campo] of Object.entries(mapa)) {
      const val = String(row[col] || '').trim()
      if (campo === 'falta') r.falta = val.toLowerCase() === 'sim' || val === '1' || val.toLowerCase() === 'true'
      else if (campo === 'atraso_minutos') r.atraso_minutos = parseInt(val) || 0
      else (r[campo] as string) = val
    }
    // Marcar falta se não tiver entrada e não for fim de semana
    if (!r.falta && !r.entrada && r.data) {
      const d = new Date(r.data)
      const dia = d.getDay()
      if (dia !== 0 && dia !== 6) r.falta = true
    }
    return r
  }).filter(r => r.data && r.data !== 'Invalid Date')
}

export default function UploadPonto({ profissionais, unidadeId, todasUnidades, onImportado }: Props) {
  const [aberto, setAberto] = useState(false)
  const [profId, setProfId] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [step, setStep] = useState<'form' | 'preview' | 'sucesso'>('form')
  const [headers, setHeaders] = useState<string[]>([])
  const [registros, setRegistros] = useState<RegistroPreview[]>([])
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const profsFiltrados = todasUnidades
    ? profissionais
    : profissionais.filter(p => p.unidade_id === unidadeId)

  const profSelecionada = profissionais.find(p => p.id === profId)

  function fechar() {
    setAberto(false)
    setStep('form')
    setProfId('')
    setArquivo(null)
    setHeaders([])
    setRegistros([])
    setErro(null)
    setMostrarTodos(false)
  }

  async function processarArquivo() {
    if (!arquivo || !profId) { setErro('Selecione a profissional e o arquivo.'); return }
    setLoading(true)
    setErro(null)

    const form = new FormData()
    form.append('file', arquivo)
    form.append('profissional_id', profId)
    form.append('unidade_id', profSelecionada!.unidade_id)

    const res = await fetch('/api/ponto/importar', { method: 'POST', body: form })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setErro(json.error || 'Erro ao processar arquivo.'); return }

    setHeaders(json.headers)
    const mapeados = mapearColunas(json.headers, json.rows)
    if (mapeados.length === 0) { setErro('Não foi possível identificar registros de ponto. Verifique o formato da planilha.'); return }
    setRegistros(mapeados)
    setStep('preview')
  }

  async function confirmarImportacao() {
    if (!profSelecionada) return
    setLoading(true)
    setErro(null)

    const res = await fetch('/api/ponto/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profissional_id: profId,
        unidade_id: profSelecionada.unidade_id,
        arquivo_nome: arquivo!.name,
        registros,
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setErro(json.error || 'Erro ao salvar.'); return }

    setStep('sucesso')
    setTimeout(() => { fechar(); onImportado() }, 1800)
  }

  const exibidos = mostrarTodos ? registros : registros.slice(0, 8)
  const totalFaltas = registros.filter(r => r.falta).length
  const totalAtrasos = registros.filter(r => r.atraso_minutos > 0).length

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
      >
        <Upload className="w-4 h-4" /> Importar ponto
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Importar Espelho de Ponto</h2>
                  <p className="text-xs text-slate-400">
                    {step === 'form' ? 'Selecione a profissional e o arquivo Excel'
                     : step === 'preview' ? `${registros.length} registros encontrados — revise antes de confirmar`
                     : 'Importação concluída!'}
                  </p>
                </div>
              </div>
              <button onClick={fechar} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-6">
              {step === 'form' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Profissional</label>
                    <select
                      value={profId}
                      onChange={e => setProfId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                    >
                      <option value="">Selecione a profissional...</option>
                      {profsFiltrados.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome}{todasUnidades ? ` — ${p.unidade_nome}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Arquivo Excel (.xls, .xlsx)</label>
                    <div
                      onClick={() => inputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors"
                    >
                      {arquivo ? (
                        <div className="flex items-center justify-center gap-2 text-slate-700">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                          <span className="text-sm font-medium">{arquivo.name}</span>
                          <button onClick={e => { e.stopPropagation(); setArquivo(null) }} className="text-slate-400 hover:text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">Clique para selecionar ou arraste o arquivo</p>
                          <p className="text-xs text-slate-400 mt-1">.xls ou .xlsx</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xls,.xlsx"
                      className="hidden"
                      onChange={e => setArquivo(e.target.files?.[0] || null)}
                    />
                  </div>

                  {erro && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {erro}
                    </div>
                  )}
                </div>
              )}

              {step === 'preview' && (
                <div className="space-y-4">
                  {/* Resumo */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-slate-800">{registros.length}</p>
                      <p className="text-xs text-slate-500">Registros</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-red-600">{totalFaltas}</p>
                      <p className="text-xs text-slate-500">Faltas</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-amber-600">{totalAtrasos}</p>
                      <p className="text-xs text-slate-500">Atrasos</p>
                    </div>
                  </div>

                  {/* Tabela preview */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Data</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Entrada</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Saída</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Horas</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-600">Atraso</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-600">Falta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exibidos.map((r, i) => (
                          <tr key={i} className={r.falta ? 'bg-red-50' : r.atraso_minutos > 0 ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-2 font-medium text-slate-700">{r.data}</td>
                            <td className="px-3 py-2 text-slate-600">{r.entrada || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{r.saida || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{r.horas_trabalhadas || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {r.atraso_minutos > 0
                                ? <span className="text-amber-600 font-medium">{r.atraso_minutos}min</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.falta
                                ? <span className="text-red-500 font-semibold">Sim</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {registros.length > 8 && (
                    <button onClick={() => setMostrarTodos(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800">
                      {mostrarTodos ? <><EyeOff className="w-3.5 h-3.5" /> Mostrar menos</> : <><Eye className="w-3.5 h-3.5" /> Ver todos os {registros.length} registros</>}
                    </button>
                  )}

                  {erro && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {erro}
                    </div>
                  )}
                </div>
              )}

              {step === 'sucesso' && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Check className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="text-base font-semibold text-slate-800">Importação concluída!</p>
                  <p className="text-sm text-slate-500">{registros.length} registros salvos para {profSelecionada?.nome}.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {step !== 'sucesso' && (
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                {step === 'preview' && (
                  <button onClick={() => setStep('form')}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    Voltar
                  </button>
                )}
                <button onClick={fechar}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={step === 'form' ? processarArquivo : confirmarImportacao}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {step === 'form' ? 'Processar arquivo' : 'Confirmar importação'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
