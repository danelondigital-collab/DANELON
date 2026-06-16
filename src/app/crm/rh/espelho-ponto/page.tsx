export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EspelhoPontoClient from './espelho-ponto-client'

export default async function EspelhoPontoPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const crmUnidadeId = cookieStore.get('crm_unidade_id')?.value || 'all'
  const todasUnidades = crmUnidadeId === 'all'

  // Profissionais ativas
  const profQuery = supabase
    .from('profissionais')
    .select('id, nome, unidade_id, cor_agenda, horario_entrada, horario_saida, intervalo_minutos, unidades(nome, id)')
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
    horario_entrada: (p as any).horario_entrada as string | null,
    horario_saida: (p as any).horario_saida as string | null,
    intervalo_minutos: (p as any).intervalo_minutos as number ?? 60,
  }))

  // Importações com registros (admin para bypassar RLS — tabelas sem policy de SELECT)
  const admin = createAdminClient()
  const impQuery = admin
    .from('ponto_importacoes')
    .select(`
      id, arquivo_nome, periodo_inicio, periodo_fim,
      he50_minutos, he100_minutos, intervalo_suprimido_minutos,
      horas_negativas_minutos, faltas_sem_justificativa,
      total_dias_trabalhados, created_at, profissional_id,
      ponto_registros(
        id, data, dia_semana, e1, s1, e2, s2,
        tipo_dia, ocorrencia_descricao,
        genyo_previstas, genyo_trabalhadas, genyo_saldo,
        delta_entrada_min, delta_saida_min, saldo_dia_min,
        intervalo_real_min, intervalo_suprimido_min, he100_min
      )
    `)
    .order('created_at', { ascending: false })
  if (!todasUnidades) impQuery.eq('unidade_id', crmUnidadeId)
  const { data: impRaw } = await impQuery

  // Montar mapa importações por profissional
  const impPorProf = new Map<string, typeof importacoesMapped[0][]>()
  const importacoesMapped = (impRaw || []).map(imp => ({
    id: imp.id,
    arquivo_nome: imp.arquivo_nome,
    periodo_inicio: imp.periodo_inicio as string | null,
    periodo_fim: imp.periodo_fim as string | null,
    he50_minutos: imp.he50_minutos as number,
    he100_minutos: imp.he100_minutos as number,
    intervalo_suprimido_minutos: imp.intervalo_suprimido_minutos as number,
    horas_negativas_minutos: imp.horas_negativas_minutos as number,
    faltas_sem_justificativa: imp.faltas_sem_justificativa as number,
    total_dias_trabalhados: imp.total_dias_trabalhados as number,
    created_at: imp.created_at as string,
    registros: ((imp.ponto_registros as unknown[]) || []).map((r: any) => ({
      id: r.id,
      data: r.data,
      dia_semana: r.dia_semana,
      e1: r.e1,
      s1: r.s1,
      e2: r.e2,
      s2: r.s2,
      tipo_dia: r.tipo_dia,
      ocorrencia_descricao: r.ocorrencia_descricao,
      genyo_previstas: r.genyo_previstas,
      genyo_trabalhadas: r.genyo_trabalhadas,
      genyo_saldo: r.genyo_saldo,
      delta_entrada_min: r.delta_entrada_min,
      delta_saida_min: r.delta_saida_min,
      saldo_dia_min: r.saldo_dia_min,
      intervalo_real_min: r.intervalo_real_min,
      intervalo_suprimido_min: r.intervalo_suprimido_min,
      he100_min: r.he100_min,
    })).sort((a, b) => a.data.localeCompare(b.data)),
    profissional_id: imp.profissional_id as string,
  }))

  for (const imp of importacoesMapped) {
    if (!impPorProf.has(imp.profissional_id)) impPorProf.set(imp.profissional_id, [])
    impPorProf.get(imp.profissional_id)!.push(imp)
  }

  // Montar estrutura por unidade
  const unidadesMap = new Map<string, { unidade_id: string; unidade_nome: string; profissionais: Array<{ profissional: typeof profissionais[0]; importacoes: typeof importacoesMapped }> }>()

  for (const prof of profissionais) {
    if (!unidadesMap.has(prof.unidade_id)) {
      unidadesMap.set(prof.unidade_id, { unidade_id: prof.unidade_id, unidade_nome: prof.unidade_nome, profissionais: [] })
    }
    unidadesMap.get(prof.unidade_id)!.profissionais.push({
      profissional: prof,
      importacoes: impPorProf.get(prof.id) ?? [],
    })
  }

  const unidades = Array.from(unidadesMap.values())
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
