import { createClient } from '@/lib/supabase/server'
import ServicosClient from './servicos-client'

export default async function ServicosPage() {
  const supabase = await createClient()

  const [{ data: servicos }, { data: categorias }] = await Promise.all([
    supabase.from('servicos').select('*, categoria:categorias_servico(*)').order('nome'),
    supabase.from('categorias_servico').select('*').order('nome'),
  ])

  return <ServicosClient servicos={servicos || []} categorias={categorias || []} />
}
