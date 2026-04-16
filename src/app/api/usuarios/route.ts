import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('perfil')
    .eq('id', user.id)
    .single()

  if (usuario?.perfil !== 'admin') return null
  return user
}

// GET — listar todos os usuários
export async function GET() {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id, nome, email, perfil, ativo, created_at,
      usuario_unidades(unidade_id, unidade:unidades(id, nome, cidade))
    `)
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST — criar usuário
export async function POST(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { nome, email, senha, perfil, unidadeIds } = await req.json()

  if (!nome || !email || !senha || !perfil) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, email, senha, perfil' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verifica se o email já existe no Auth
  const { data: lista } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const authExistente = lista?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

  let userId: string

  if (authExistente) {
    // Auth já existe — verifica se já tem registro em usuarios
    const { data: usuarioExistente } = await adminClient
      .from('usuarios')
      .select('id')
      .eq('id', authExistente.id)
      .single()

    if (usuarioExistente) {
      return NextResponse.json({ error: 'Este email já está cadastrado no sistema.' }, { status: 400 })
    }

    // Auth existe mas sem registro em usuarios — só cria o registro
    userId = authExistente.id
  } else {
    // Cria novo usuário no Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
    userId = authData.user.id
  }

  // Insere em usuarios
  const { error: dbError } = await adminClient
    .from('usuarios')
    .insert({ id: userId, nome, email, perfil, ativo: true })

  if (dbError) {
    if (!authExistente) await adminClient.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  // Insere em usuario_unidades
  if (unidadeIds && unidadeIds.length > 0) {
    const { error: unError } = await adminClient
      .from('usuario_unidades')
      .insert(unidadeIds.map((uid: string) => ({
        usuario_id: userId,
        unidade_id: uid,
        perfil,
      })))

    if (unError) return NextResponse.json({ error: unError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, id: userId })
}

// PATCH — editar usuário (nome, perfil, unidades, ativo)
export async function PATCH(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id, nome, perfil, unidadeIds, ativo } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const adminClient = createAdminClient()

  // Atualiza usuarios
  const updates: Record<string, unknown> = {}
  if (nome !== undefined) updates.nome = nome
  if (perfil !== undefined) updates.perfil = perfil
  if (ativo !== undefined) updates.ativo = ativo

  if (Object.keys(updates).length > 0) {
    const { error } = await adminClient.from('usuarios').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Atualiza unidades (apaga e recria)
  if (unidadeIds !== undefined) {
    await adminClient.from('usuario_unidades').delete().eq('usuario_id', id)

    if (unidadeIds.length > 0) {
      const { error } = await adminClient
        .from('usuario_unidades')
        .insert(unidadeIds.map((uid: string) => ({
          usuario_id: id,
          unidade_id: uid,
          perfil: perfil || 'operador',
        })))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE — remover usuário
export async function DELETE(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  if (id === admin.id) {
    return NextResponse.json({ error: 'Não é possível excluir o próprio usuário' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
