import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Só admin mexe em dado financeiro. Devolve o client já validado ou null. */
async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('perfil')
    .eq('id', user.id)
    .single()
  if (usuario?.perfil !== 'admin') return null
  return supabase
}

/** Lançamentos que se sobrepõem ao período pedido (mês cheio conta se encostar no filtro). */
export async function GET(request: NextRequest) {
  const supabase = await exigirAdmin()
  if (!supabase) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  let query = supabase
    .from('investimento_trafego')
    .select('id, plataforma, destino, mes, valor, impressoes, cliques, resultados, observacoes')
    .order('mes', { ascending: false })
    .order('plataforma')

  // Pega qualquer mês que encoste no período filtrado. O mês é guardado no dia 1,
  // então pra alcançar um filtro que começa no meio do mês recuamos o limite
  // inferior até o primeiro dia daquele mês.
  if (start && DATE_RE.test(start)) {
    const inicioDoMes = `${start.slice(0, 7)}-01`
    query = query.gte('mes', inicioDoMes)
  }
  if (end && DATE_RE.test(end)) {
    query = query.lte('mes', end)
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao buscar investimento:', error)
    return NextResponse.json({ error: 'Não foi possível carregar os investimentos.' }, { status: 500 })
  }

  return NextResponse.json({ investimentos: data || [] })
}

/** Cria ou atualiza o lançamento daquele plataforma/destino/mês. */
export async function POST(request: NextRequest) {
  const supabase = await exigirAdmin()
  if (!supabase) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })

  let body: {
    plataforma?: string
    destino?: string
    mes?: string
    valor?: number | string
    impressoes?: number | string | null
    cliques?: number | string | null
    resultados?: number | string | null
    observacoes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const plataforma = (body.plataforma || '').trim()
  const destino = (body.destino || 'site').trim()
  const mes = (body.mes || '').trim()
  const valor = typeof body.valor === 'string' ? parseFloat(body.valor.replace(',', '.')) : body.valor

  /** Campo opcional: string vazia/undefined vira null, senão precisa ser um inteiro >= 0. */
  function parseInteiroOpcional(v: number | string | null | undefined): number | null | 'invalido' {
    if (v === undefined || v === null || v === '') return null
    const n = typeof v === 'string' ? parseInt(v.replace(/\./g, ''), 10) : v
    if (!Number.isFinite(n) || n < 0) return 'invalido'
    return n
  }
  const impressoes = parseInteiroOpcional(body.impressoes)
  const cliques = parseInteiroOpcional(body.cliques)
  const resultados = parseInteiroOpcional(body.resultados)

  if (!plataforma) return NextResponse.json({ error: 'Informe a plataforma.' }, { status: 400 })
  if (!DATE_RE.test(mes)) return NextResponse.json({ error: 'Informe o mês (formato aaaa-mm-01).' }, { status: 400 })
  if (destino !== 'site' && destino !== 'perfil') {
    return NextResponse.json({ error: 'Destino deve ser "site" ou "perfil".' }, { status: 400 })
  }
  if (valor === undefined || valor === null || Number.isNaN(valor) || valor < 0) {
    return NextResponse.json({ error: 'Informe um valor válido.' }, { status: 400 })
  }
  if (impressoes === 'invalido' || cliques === 'invalido' || resultados === 'invalido') {
    return NextResponse.json({ error: 'Impressões, cliques e resultados precisam ser números inteiros positivos.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('investimento_trafego')
    .upsert(
      {
        plataforma,
        destino,
        mes: `${mes.slice(0, 7)}-01`, // normaliza sempre pro dia 1
        valor,
        impressoes,
        cliques,
        resultados,
        observacoes: body.observacoes?.trim() || null,
      },
      { onConflict: 'plataforma,destino,mes' }
    )
    .select()
    .single()

  if (error) {
    console.error('Erro ao salvar investimento:', error)
    return NextResponse.json({ error: 'Não foi possível salvar o lançamento.' }, { status: 500 })
  }

  return NextResponse.json({ investimento: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await exigirAdmin()
  if (!supabase) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Informe o id do lançamento.' }, { status: 400 })

  const { error } = await supabase.from('investimento_trafego').delete().eq('id', id)
  if (error) {
    console.error('Erro ao excluir investimento:', error)
    return NextResponse.json({ error: 'Não foi possível excluir o lançamento.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
