export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ComandasClient from './comandas-client'

export default async function ComandasPage({ searchParams }: { searchParams: Promise<{ q?: string; data?: string }> }) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!
  const { q, data: dataFiltro } = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuario } = user
    ? await supabase.from('usuarios').select('perfil').eq('id', user.id).single()
    : { data: null }
  const perfil = usuario?.perfil || 'operador'

  // Se busca por número (C#XXX), busca direto no banco sem limite
  const isNumeroBusca = q && /^C?#?\d+$/i.test(q.trim())
  const numeroFormatado = isNumeroBusca
    ? (q.trim().toUpperCase().startsWith('C#') ? q.trim().toUpperCase() : `C#${q.trim().replace(/\D/g, '')}`)
    : null

  // Monta a query de comandas de acordo com os filtros ativos
  const baseQuery = supabase.from('comandas')
    .select('*, cliente:clientes(id, nome, telefone, data_nascimento)')
    .eq('unidade_id', unidadeId)

  const comandasQuery = (() => {
    if (numeroFormatado) {
      return baseQuery.eq('numero', numeroFormatado)
    }
    if (dataFiltro) {
      // Filtra pelo dia completo no fuso horário do Brasil (UTC-3)
      return baseQuery
        .gte('data_abertura', `${dataFiltro}T00:00:00-03:00`)
        .lt('data_abertura', `${dataFiltro}T23:59:59-03:00`)
        .order('created_at', { ascending: false })
    }
    return baseQuery.order('created_at', { ascending: false }).limit(100)
  })()

  const [{ data: comandas }, { data: clientes }, { data: profissionais }, { data: servicos }, { data: produtos }, { data: comissoesProfissional }] = await Promise.all([
    comandasQuery,
    supabase.from('clientes').select('id, nome, telefone, data_nascimento').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('profissionais').select('*').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('produtos').select('*').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    supabase.from('comissoes_profissional_item').select('id, profissional_id, tipo, servico_id, produto_id, percentual'),
  ])

  return (
    <Suspense>
      <ComandasClient
        comandas={(comandas as unknown as import('@/types').Comanda[]) || []}
        clientes={(clientes as unknown as import('@/types').Cliente[]) || []}
        profissionais={profissionais || []}
        servicos={servicos || []}
        produtos={produtos || []}
        comissoesProfissional={(comissoesProfissional as unknown as import('@/types').ComissaoProfissionalItem[]) || []}
        unidadeId={unidadeId}
        perfil={perfil}
      />
    </Suspense>
  )
}
