export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import EstoqueClient from './estoque-client'
import { Warehouse } from 'lucide-react'

export default async function EstoquePage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const crmUnidadeId = cookieStore.get('crm_unidade_id')?.value || 'all'
  const todasUnidades = crmUnidadeId === 'all'

  // Produtos com unidade e meta diária
  const produtosQuery = supabase
    .from('produtos')
    .select('id, nome, marca, preco_venda, estoque, unidade_id, classificacao, unidades(nome), estoque_metas(quantidade_meta)')
    .eq('ativo', true)
    .order('nome')

  if (!todasUnidades) produtosQuery.eq('unidade_id', crmUnidadeId)

  const { data: produtosRaw } = await produtosQuery

  // Datas de referência
  const agora = new Date()
  const hoje = agora.toISOString().split('T')[0]
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString()
  const inicioSemana = new Date(agora.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

  async function buscarVendas(inicio: string): Promise<{ produto_id: string | null; quantidade: number }[]> {
    const q = supabase
      .from('comanda_itens')
      .select('produto_id, quantidade, comandas!inner(status, data_fechamento, unidade_id)')
      .eq('tipo', 'produto')
      .not('produto_id', 'is', null)
      .eq('comandas.status', 'fechada')
      .gte('comandas.data_fechamento', inicio)

    if (!todasUnidades) q.eq('comandas.unidade_id', crmUnidadeId)

    const { data } = await q
    return (data as { produto_id: string | null; quantidade: number }[] | null) || []
  }

  const [vendasHoje, vendasSemana, vendasMes] = await Promise.all([
    buscarVendas(inicioDia),
    buscarVendas(inicioSemana),
    buscarVendas(inicioMes),
  ])

  function somarPorProduto(vendas: { produto_id: string | null; quantidade: number }[]) {
    const map: Record<string, number> = {}
    for (const v of vendas) {
      if (v.produto_id) map[v.produto_id] = (map[v.produto_id] || 0) + v.quantidade
    }
    return map
  }

  const hojeMap = somarPorProduto(vendasHoje)
  const semanaMap = somarPorProduto(vendasSemana)
  const mesMap = somarPorProduto(vendasMes)

  const produtos = (produtosRaw || []).map(p => ({
    id: p.id,
    nome: p.nome,
    marca: p.marca,
    preco_venda: p.preco_venda,
    estoque: p.estoque ?? 0,
    unidade_id: p.unidade_id || '',
    unidade_nome: (p.unidades as unknown as { nome: string } | null)?.nome || '',
    classificacao: (p as any).classificacao as string | null ?? null,
    quantidade_meta: (p.estoque_metas as { quantidade_meta: number }[] | null)?.[0]?.quantidade_meta ?? 0,
    vendido_hoje: hojeMap[p.id] || 0,
    vendido_semana: semanaMap[p.id] || 0,
    vendido_mes: mesMap[p.id] || 0,
  }))

  // Upsert snapshot diário silencioso (roda em background, não bloqueia a página)
  if (produtos.length > 0) {
    const registros = produtos
      .filter(p => p.unidade_id)
      .map(p => ({
        produto_id: p.id,
        unidade_id: p.unidade_id,
        data: hoje,
        quantidade_vendida: p.vendido_hoje,
        estoque_atual: p.estoque,
        meta_diaria: p.quantidade_meta,
        updated_at: new Date().toISOString(),
      }))

    await supabase
      .from('estoque_registros_diarios')
      .upsert(registros, { onConflict: 'produto_id,data' })
  }

  // Histórico dos últimos 60 dias para a aba de relatório
  const inicio60 = new Date(agora.getTime() - 59 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const historicoQuery = supabase
    .from('estoque_registros_diarios')
    .select('data, quantidade_vendida, estoque_atual, meta_diaria, unidade_id, produto_id, produtos(nome, marca), unidades(nome)')
    .gte('data', inicio60)
    .order('data', { ascending: false })

  if (!todasUnidades) historicoQuery.eq('unidade_id', crmUnidadeId)

  const { data: historicoRaw } = await historicoQuery

  const historico = (historicoRaw || []).map(r => ({
    data: r.data as string,
    produto_nome: (r.produtos as unknown as { nome: string; marca: string | null } | null)?.nome || '',
    produto_marca: (r.produtos as unknown as { nome: string; marca: string | null } | null)?.marca || null,
    unidade_nome: (r.unidades as unknown as { nome: string } | null)?.nome || '',
    unidade_id: r.unidade_id,
    produto_id: r.produto_id,
    quantidade_vendida: r.quantidade_vendida,
    estoque_atual: r.estoque_atual,
    meta_diaria: r.meta_diaria,
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <Warehouse className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estoque</h1>
          <p className="text-sm text-slate-500">
            {todasUnidades ? 'Todas as unidades' : 'Unidade selecionada'} · {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <EstoqueClient produtos={produtos} todasUnidades={todasUnidades} historico={historico} />
    </div>
  )
}
