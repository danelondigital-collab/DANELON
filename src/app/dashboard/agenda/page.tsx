export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AgendaClient from './agenda-client'

export default async function AgendaPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const [{ data: profissionais }, { data: servicos }, { data: clientes }] = await Promise.all([
    supabase.from('profissionais').select('*').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('clientes').select('id, nome, telefone').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
  ])

  return (
    <AgendaClient
      unidadeId={unidadeId}
      profissionais={profissionais || []}
      servicos={servicos || []}
      clientes={(clientes as unknown as import('@/types').Cliente[]) || []}
    />
  )
}
