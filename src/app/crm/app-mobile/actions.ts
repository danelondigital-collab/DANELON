'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function ativarAcessoApp(profissionalId: string, email: string, senha: string) {
  const admin = createAdminClient()
  const supabase = await createClient()

  // Verificar se já tem um app_user_id cadastrado
  const { data: prof } = await supabase
    .from('profissionais')
    .select('app_user_id, nome')
    .eq('id', profissionalId)
    .single()

  let userId: string

  if (prof?.app_user_id) {
    // Já tem usuário — atualizar email/senha
    const { error } = await admin.auth.admin.updateUserById(prof.app_user_id, {
      email,
      password: senha,
    })
    if (error) return { error: error.message }
    userId = prof.app_user_id
  } else {
    // Criar novo usuário
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { profissional_id: profissionalId, role: 'profissional' },
    })
    if (error) return { error: error.message }
    userId = data.user.id
  }

  // Vincular profissional ao usuário
  const { error: updateError } = await admin
    .from('profissionais')
    .update({ app_acesso: true, app_user_id: userId, app_email: email })
    .eq('id', profissionalId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/crm/app-mobile')
  return { success: true }
}

export async function desativarAcessoApp(profissionalId: string) {
  const admin = createAdminClient()
  const supabase = await createClient()

  const { data: prof } = await supabase
    .from('profissionais')
    .select('app_user_id')
    .eq('id', profissionalId)
    .single()

  if (prof?.app_user_id) {
    await admin.auth.admin.deleteUser(prof.app_user_id)
  }

  await admin
    .from('profissionais')
    .update({ app_acesso: false, app_user_id: null, app_email: null })
    .eq('id', profissionalId)

  revalidatePath('/crm/app-mobile')
  return { success: true }
}

export async function redefinirSenhaApp(profissionalId: string, novaSenha: string) {
  const admin = createAdminClient()
  const supabase = await createClient()

  const { data: prof } = await supabase
    .from('profissionais')
    .select('app_user_id')
    .eq('id', profissionalId)
    .single()

  if (!prof?.app_user_id) return { error: 'Profissional sem acesso ao app.' }

  const { error } = await admin.auth.admin.updateUserById(prof.app_user_id, {
    password: novaSenha,
  })

  if (error) return { error: error.message }
  return { success: true }
}
