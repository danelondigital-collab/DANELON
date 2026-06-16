export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import EspelhoPontoClient from './espelho-ponto-client'

export default async function EspelhoPontoPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const crmUnidadeId = cookieStore.get('crm_unidade_id')?.value || 'all'
  const todasUnidades = crmUnidadeId === 'all'

  // Profissionais ativos
  const profQuery = supabase
    .from('profissionais')
    .select('id, nome, unidade_id, cor_agenda, unidades(nome)')
    .eq('ativo', true)
    .order('nome')

  if (!todasUnidades) profQuery.eq('unidade_id', crmUnidadeId)
  const { data: profRaw } = await profQuery

  const profissionais = (profRaw || []).map(p => ({
    id: p.id,
    nome: p.nome,
    unidade_id: p.unidade_id,
    unidade_nome: (p.unidades as unknown as { nome: string } | null)?.nome ?? '',
    cor_agenda: p.cor_agenda,
  }))

  // Registros de ponto com importações
  const pontQuery = supabase
    .from('ponto_registros')
    .select(`
      id, data, entrada, saida, saida_almoco, retorno_almoco,
      horas_trabalhadas, atraso_minutos, falta, observacoes,
      profissional_id, unidade_id,
      ponto_importacoes(created_at)
    `)
    .order('data', { ascending: false })

  if (!todasUnidades) pontQuery.eq('unidade_id', crmUnidadeId)
  const { data: pontRaw } = await pontQuery

  // Unidades únicas presentes nos registros (ou da profissional filtrada)
  const unidadesMap = new Map<string, { unidade_id: string; unidade_nome: string; profissionais: Map<string, { profissional: (typeof profissionais)[0]; registros: typeof pontoRegistros; ultima_importacao: string | null }> }>()

  const pontoRegistros = (pontRaw || []).map(r => ({
    id: r.id,
    data: r.data as string,
    entrada: r.entrada as string | null,
    saida: r.saida as string | null,
    saida_almoco: r.saida_almoco as string | null,
    retorno_almoco: r.retorno_almoco as string | null,
    horas_trabalhadas: r.horas_trabalhadas as number | null,
    atraso_minutos: r.atraso_minutos as number,
    falta: r.falta as boolean,
    observacoes: r.observacoes as string | null,
    profissional_id: r.profissional_id as string,
    unidade_id: r.unidade_id as string,
    ultima_importacao: (r.ponto_importacoes as unknown as { created_at: string }[] | null)?.[0]?.created_at ?? null,
  }))

  // Montar estrutura por unidade → profissional
  for (const prof of profissionais) {
    if (!unidadesMap.has(prof.unidade_id)) {
      unidadesMap.set(prof.unidade_id, {
        unidade_id: prof.unidade_id,
        unidade_nome: prof.unidade_nome,
        profissionais: new Map(),
      })
    }
  }

  for (const reg of pontoRegistros) {
    const prof = profissionais.find(p => p.id === reg.profissional_id)
    if (!prof) continue

    if (!unidadesMap.has(reg.unidade_id)) {
      unidadesMap.set(reg.unidade_id, {
        unidade_id: reg.unidade_id,
        unidade_nome: prof.unidade_nome,
        profissionais: new Map(),
      })
    }

    const unidade = unidadesMap.get(reg.unidade_id)!
    if (!unidade.profissionais.has(prof.id)) {
      unidade.profissionais.set(prof.id, { profissional: prof, registros: [], ultima_importacao: null })
    }

    const rp = unidade.profissionais.get(prof.id)!
    rp.registros.push(reg)
    if (reg.ultima_importacao && (!rp.ultima_importacao || reg.ultima_importacao > rp.ultima_importacao)) {
      rp.ultima_importacao = reg.ultima_importacao
    }
  }

  const unidades = Array.from(unidadesMap.values())
    .map(u => {
      const profs = Array.from(u.profissionais.values())
        .filter(rp => rp.registros.length > 0)
        .map(rp => ({
          profissional: rp.profissional,
          total_registros: rp.registros.length,
          total_faltas: rp.registros.filter(r => r.falta).length,
          total_atraso_min: rp.registros.reduce((acc, r) => acc + (r.atraso_minutos || 0), 0),
          ultima_importacao: rp.ultima_importacao,
          registros: rp.registros,
        }))
        .sort((a, b) => a.profissional.nome.localeCompare(b.profissional.nome))

      return {
        unidade_id: u.unidade_id,
        unidade_nome: u.unidade_nome,
        profissionais: profs,
        total_faltas: profs.reduce((acc, p) => acc + p.total_faltas, 0),
        total_atraso_min: profs.reduce((acc, p) => acc + p.total_atraso_min, 0),
      }
    })
    .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome))

  return (
    <EspelhoPontoClient
      unidades={unidades}
      profissionais={profissionais}
      unidadeId={crmUnidadeId}
      todasUnidades={todasUnidades}
    />
  )
}
