'use client'

import { useEffect, useState } from 'react'
import { History, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
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

interface Props {
  tabela: 'comanda' | 'agendamento' | 'servico' | 'produto'
  registroId: string
}

export default function HistoricoLog({ tabela, registroId }: Props) {
  const supabase = createClient()
  const [aberto, setAberto] = useState(false)
  const [logs, setLogs] = useState<LogAtividade[]>([])
  const [carregando, setCarregando] = useState(false)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    if (!aberto || carregado) return
    setCarregando(true)
    supabase
      .from('logs_atividade')
      .select('*')
      .eq('tabela', tabela)
      .eq('registro_id', registroId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLogs((data as LogAtividade[]) || [])
        setCarregando(false)
        setCarregado(true)
      })
  }, [aberto, carregado, tabela, registroId, supabase])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <History className="w-3.5 h-3.5" /> Histórico de alterações
        </span>
        {aberto ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {aberto && (
        <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {carregando ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Nenhum registro de atividade ainda.</p>
          ) : (
            logs.map(log => {
              const acao = ACAO_LABEL[log.acao]
              return (
                <div key={log.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${acao.cor}`}>{acao.texto}</span>
                    <span className="text-xs text-gray-600 truncate">{log.usuario_nome || 'Usuário desconhecido'}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtData(log.created_at)}</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
