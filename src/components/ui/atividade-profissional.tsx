'use client'

import { useEffect, useState } from 'react'
import { Loader2, Calendar, Receipt } from 'lucide-react'
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

export default function AtividadeProfissional({ profissionalId }: { profissionalId: string }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<LogAtividade[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    setCarregando(true)
    supabase
      .from('logs_atividade')
      .select('*')
      .contains('profissional_ids', [profissionalId])
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setLogs((data as LogAtividade[]) || [])
        setCarregando(false)
      })
  }, [profissionalId, supabase])

  if (carregando) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
  }

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">Nenhuma atividade registrada para esta profissional ainda.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2">Comandas e agendamentos criados/editados/excluídos envolvendo esta profissional.</p>
      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
        {logs.map(log => {
          const acao = ACAO_LABEL[log.acao]
          return (
            <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {log.tabela === 'comanda'
                  ? <Receipt className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  : <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${acao.cor}`}>{acao.texto}</span>
                <span className="text-xs text-gray-600 truncate">
                  {log.tabela === 'comanda' ? 'Comanda' : 'Agendamento'}
                  {log.cliente_nome ? ` — ${log.cliente_nome}` : ''}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">{log.usuario_nome || '—'}</p>
                <p className="text-xs text-gray-400">{fmtData(log.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
