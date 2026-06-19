export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AgendaClient from './agenda-client'

export default async function AgendaPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuario } = user
    ? await supabase.from('usuarios').select('perfil').eq('id', user.id).single()
    : { data: null }
  const perfil = usuario?.perfil || 'operador'

  const [{ data: profissionais }, { data: servicos }, { data: clientes }] = await Promise.all([
    supabase.from('profissionais').select('*').eq('unidade_id', unidadeId).eq('ativo', true).eq('gerar_agenda', true).order('nome'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('clientes').select('id, nome, telefone').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
  ])

  return (
    <AgendaClient
      unidadeId={unidadeId}
      profissionais={profissionais || []}
      servicos={servicos || []}
      clientes={(clientes as unknown as import('@/types').Cliente[]) || []}
      perfil={perfil}
    />
  )
}
