'use client'

import { useState, useMemo } from 'react'
import { History, Receipt, Calendar, Search, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { LogAtividade } from '@/types'

const ACAO_LABEL: Record<LogAtividade['acao'], { texto: string; cor: string }> = {
  criar: { texto: 'Criou', cor: 'text-green-600 bg-green-50' },
  editar: { texto: 'Editou', cor: 'text-amber-600 bg-amber-50' },
  excluir: { texto: 'Excluiu', cor: 'text-red-600 bg-red-50' },
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Unidade { id: string; nome: string }

interface Props {
  logsIniciais: LogAtividade[]
  unidades: Unidade[]
  unidadeId: string
  todasUnidades: boolean
}

export default function LogsClient({ logsIniciais, unidades, unidadeId, todasUnidades }: Props) {
  const supabase = createClient()
  const [logs, setLogs] = useState(logsIniciais)
  const [tabelaFiltro, setTabelaFiltro] = useState<'todas' | 'comanda' | 'agendamento'>('todas')
  const [acaoFiltro, setAcaoFiltro] = useState<'todas' | 'criar' | 'editar' | 'excluir'>('todas')
  const [busca, setBusca] = useState('')
  const [unidadeFiltro, setUnidadeFiltro] = useState(unidadeId)
  const [carregando, setCarregando] = useState(false)

  async function aplicarFiltros(novaUnidade?: string) {
    setCarregando(true)
    const unidadeAtiva = novaUnidade ?? unidadeFiltro
    let query = supabase.from('logs_atividade').select('*').order('created_at', { ascending: false }).limit(300)
    if (unidadeAtiva !== 'all') query = query.eq('unidade_id', unidadeAtiva)
    const { data } = await query
    setLogs((data as LogAtividade[]) || [])
    setCarregando(false)
  }

  const logsFiltrados = useMemo(() => {
    return logs.filter(l => {
      if (tabelaFiltro !== 'todas' && l.tabela !== tabelaFiltro) return false
      if (acaoFiltro !== 'todas' && l.acao !== acaoFiltro) return false
      if (busca.trim()) {
        const b = busca.trim().toLowerCase()
        const alvo = `${l.usuario_nome ?? ''} ${l.cliente_nome ?? ''}`.toLowerCase()
        if (!alvo.includes(b)) return false
      }
      return true
    })
  }, [logs, tabelaFiltro, acaoFiltro, busca])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-violet-600" /> Relatório de Log
        </h1>
        <p className="text-sm text-slate-500">Auditoria de criação, edição e exclusão de comandas e agendamentos.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        {todasUnidades && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Unidade</label>
            <select value={unidadeFiltro}
              onChange={e => { setUnidadeFiltro(e.target.value); aplicarFiltros(e.target.value) }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">Todas as unidades</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
          <select value={tabelaFiltro} onChange={e => setTabelaFiltro(e.target.value as typeof tabelaFiltro)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="todas">Todos</option>
            <option value="comanda">Comanda</option>
            <option value="agendamento">Agendamento</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Ação</label>
          <select value={acaoFiltro} onChange={e => setAcaoFiltro(e.target.value as typeof acaoFiltro)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="todas">Todas</option>
            <option value="criar">Criou</option>
            <option value="editar">Editou</option>
            <option value="excluir">Excluiu</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Buscar usuário ou cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Nome do usuário ou cliente..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
        ) : logsFiltrados.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Nenhum registro encontrado.</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {logsFiltrados.map(log => {
              const acao = ACAO_LABEL[log.acao]
              return (
                <div key={log.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    {log.tabela === 'comanda'
                      ? <Receipt className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      : <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${acao.cor}`}>{acao.texto}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">
                        {log.tabela === 'comanda' ? 'Comanda' : 'Agendamento'}
                        {log.cliente_nome ? ` — ${log.cliente_nome}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">por {log.usuario_nome || 'desconhecido'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{fmtData(log.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
