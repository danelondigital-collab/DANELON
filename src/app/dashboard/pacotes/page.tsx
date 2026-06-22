export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import PacotesClient from './pacotes-client'

export default async function PacotesPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const [{ data: pacotes }, { data: clientes }, { data: profissionais }, { data: servicos }] = await Promise.all([
    supabase.from('pacotes')
      .select('*, cliente:clientes(id, nome, telefone), vendedor:profissionais(id, nome)')
      .eq('unidade_id', unidadeId)
      .order('numero', { ascending: false })
      .limit(200),
    supabase.from('clientes').select('id, nome, telefone').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('profissionais').select('id, nome').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
  ])

  return (
    <Suspense>
      <PacotesClient
        pacotes={(pacotes as unknown as import('@/types').Pacote[]) || []}
        clientes={(clientes as unknown as import('@/types').Cliente[]) || []}
        profissionais={profissionais || []}
        servicos={servicos || []}
        unidadeId={unidadeId}
      />
    </Suspense>
  )
}
