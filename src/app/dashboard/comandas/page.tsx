import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ComandasClient from './comandas-client'

export default async function ComandasPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const [{ data: comandas }, { data: clientes }, { data: profissionais }, { data: servicos }, { data: produtos }] = await Promise.all([
    supabase.from('comandas')
      .select('*, cliente:clientes(id, nome, telefone)')
      .eq('unidade_id', unidadeId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('clientes').select('id, nome, telefone').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('profissionais').select('*').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('produtos').select('*').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
  ])

  return (
    <ComandasClient
      comandas={(comandas as unknown as import('@/types').Comanda[]) || []}
      clientes={clientes || []}
      profissionais={profissionais || []}
      servicos={servicos || []}
      produtos={produtos || []}
      unidadeId={unidadeId}
    />
  )
}
