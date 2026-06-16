'use client'

import { useState, useCallback } from 'react'
import { Building2, ChevronDown, ChevronRight, AlertTriangle, Clock, UserX, Search, Trash2, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import UploadPonto from './upload-ponto'

interface Profissional {
  id: string
  nome: string
  unidade_id: string
  unidade_nome: string
  cor_agenda: string
}

interface Registro {
  id: string
  data: string
  entrada: string | null
  saida: string | null
  saida_almoco: string | null
  retorno_almoco: string | null
  horas_trabalhadas: number | null
  atraso_minutos: number
  falta: boolean
  observacoes: string | null
}

interface ResumoProfissional {
  profissional: Profissional
  total_registros: number
  total_faltas: number
  total_atraso_min: number
  ultima_importacao: string | null
  registros: Registro[]
}

interface ResumoUnidade {
  unidade_id: string
  unidade_nome: string
  profissionais: ResumoProfissional[]
  total_faltas: number
  total_atraso_min: number
}

interface Props {
  unidades: ResumoUnidade[]
  profissionais: Profissional[]
  unidadeId: string
  todasUnidades: boolean
}

function minutosParaHoras(min: number) {
  if (min === 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`
}

function CardUnidade({ unidade, profissionais, todasUnidades }: {
  unidade: ResumoUnidade
  profissionais: Profissional[]
  todasUnidades: boolean
}) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{unidade.unidade_nome}</p>
            <p className="text-xs text-slate-500">{unidade.profissionais.length} profissional{unidade.profissionais.length !== 1 ? 'is' : ''} com registros</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500">Faltas</p>
            <p className="font-bold text-red-500">{unidade.total_faltas}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500">Atraso total</p>
            <p className="font-bold text-amber-600">{minutosParaHoras(unidade.total_atraso_min)}</p>
          </div>
          {expandido ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {unidade.profissionais.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Nenhum registro importado ainda.</p>
          ) : (
            unidade.profissionais.map(rp => (
              <CardProfissional key={rp.profissional.id} resumo={rp} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function CardProfissional({ resumo }: { resumo: ResumoProfissional }) {
  const [expandido, setExpandido] = useState(false)
  const [busca, setBusca] = useState('')
  const [deletando, setDeletando] = useState<string | null>(null)

  const registrosFiltrados = resumo.registros.filter(r => {
    if (!busca) return true
    return r.data.includes(busca)
  })

  return (
    <div className="px-5 py-3">
      <button
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: resumo.profissional.cor_agenda }}
          >
            {resumo.profissional.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{resumo.profissional.nome}</p>
            {resumo.ultima_importacao && (
              <p className="text-xs text-slate-400">
                Última importação: {format(parseISO(resumo.ultima_importacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            {resumo.total_faltas > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <UserX className="w-3.5 h-3.5" /> {resumo.total_faltas} falta{resumo.total_faltas !== 1 ? 's' : ''}
              </span>
            )}
            {resumo.total_atraso_min > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                <Clock className="w-3.5 h-3.5" /> {minutosParaHoras(resumo.total_atraso_min)}
              </span>
            )}
            <span className="text-slate-400">{resumo.total_registros} dias</span>
          </div>
          {expandido ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expandido && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="Filtrar por data (ex: 2025-06)"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Data</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Entrada</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Int. saída</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Int. volta</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Saída</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Horas</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Atraso</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-500">Falta</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">Obs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrosFiltrados.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-4 text-center text-slate-400">Nenhum registro.</td></tr>
                )}
                {registrosFiltrados.map(r => (
                  <tr key={r.id} className={r.falta ? 'bg-red-50' : r.atraso_minutos > 0 ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {r.data ? format(parseISO(r.data), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.entrada || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.saida_almoco || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.retorno_almoco || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.saida || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.horas_trabalhadas ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.atraso_minutos > 0
                        ? <span className="text-amber-600 font-semibold">{minutosParaHoras(r.atraso_minutos)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.falta
                        ? <span className="inline-flex items-center gap-1 text-red-500 font-semibold"><AlertTriangle className="w-3 h-3" /> Sim</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">{r.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EspelhoPontoClient({ unidades, profissionais, unidadeId, todasUnidades }: Props) {
  const [key, setKey] = useState(0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {todasUnidades
            ? `${unidades.length} unidade${unidades.length !== 1 ? 's' : ''}`
            : `${unidades[0]?.profissionais.length ?? 0} profissional${(unidades[0]?.profissionais.length ?? 0) !== 1 ? 'is' : ''} com registros`}
        </p>
        <UploadPonto
          profissionais={profissionais}
          unidadeId={unidadeId}
          todasUnidades={todasUnidades}
          onImportado={() => setKey(k => k + 1)}
        />
      </div>

      <div key={key} className="space-y-4">
        {unidades.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum registro de ponto importado ainda.</p>
            <p className="text-sm text-slate-400 mt-1">Clique em "Importar ponto" para começar.</p>
          </div>
        )}
        {unidades.map(u => (
          <CardUnidade
            key={u.unidade_id}
            unidade={u}
            profissionais={profissionais}
            todasUnidades={todasUnidades}
          />
        ))}
      </div>
    </div>
  )
}
