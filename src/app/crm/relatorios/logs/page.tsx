export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import LogsClient from './logs-client'

export default async function LogsPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const crmUnidadeId = cookieStore.get('crm_unidade_id')?.value || 'all'
  const todasUnidades = crmUnidadeId === 'all'

  let query = supabase
    .from('logs_atividade')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!todasUnidades) query = query.eq('unidade_id', crmUnidadeId)

  const { data: logs } = await query

  const { data: unidades } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  return (
    <LogsClient
      logsIniciais={logs || []}
      unidades={unidades || []}
      unidadeId={crmUnidadeId}
      todasUnidades={todasUnidades}
    />
  )
}
