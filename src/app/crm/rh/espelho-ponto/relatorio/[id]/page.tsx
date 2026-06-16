import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function fmt(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}min`
}

function fmtPeriodo(inicio: string | null, fim: string | null): string {
  if (!inicio || !fim) return '—'
  try {
    return `${format(parseISO(inicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(parseISO(fim), 'dd/MM/yyyy', { locale: ptBR })}`
  } catch { return '—' }
}

function fmtData(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM EEE', { locale: ptBR }) } catch { return iso }
}

function sinalMin(min: number, zero = '—') {
  if (min === 0) return zero
  return min > 0 ? `+${fmt(min)}` : `−${fmt(min)}`
}

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; }
  .page { padding: 32px 36px; max-width: 1100px; margin: 0 auto; }

  .print-btn { position: fixed; top: 16px; right: 16px; background: #7c3aed; color: white; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7px; box-shadow: 0 4px 12px rgba(124,58,237,.3); z-index: 100; }
  .print-btn:hover { background: #6d28d9; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 22px; }
  .logo { height: 40px; width: auto; }
  .titulo { font-size: 18px; font-weight: 700; color: #7c3aed; }
  .subtitulo { font-size: 11px; color: #64748b; margin-top: 2px; }
  .emissao { font-size: 11px; color: #64748b; text-align: right; line-height: 1.6; }

  /* Info */
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; display: flex; gap: 0; flex-wrap: wrap; }
  .info-item { padding-right: 32px; margin-bottom: 8px; }
  .info-item:last-child { padding-right: 0; }
  .info-item label { font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; display: block; margin-bottom: 2px; }
  .info-item span { font-size: 13px; font-weight: 600; color: #1e293b; }

  /* Cards resumo */
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .card { border-radius: 8px; padding: 12px 14px; border: 1px solid #e2e8f0; background: #f8fafc; }
  .card.verde { background: #f0fdf4; border-color: #bbf7d0; }
  .card.roxo  { background: #faf5ff; border-color: #e9d5ff; }
  .card.laranja { background: #fff7ed; border-color: #fed7aa; }
  .card.vermelho { background: #fef2f2; border-color: #fecaca; }
  .card-label { font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: #64748b; margin-bottom: 4px; }
  .card-valor { font-size: 17px; font-weight: 700; color: #475569; }
  .card.verde  .card-valor { color: #16a34a; }
  .card.roxo   .card-valor { color: #7c3aed; }
  .card.laranja .card-valor { color: #ea580c; }
  .card.vermelho .card-valor { color: #dc2626; }

  /* Tabela */
  .sec-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #7c3aed; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
  thead th { padding: 7px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; white-space: nowrap; }
  thead th.c { text-align: center; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr.folga td { color: #cbd5e1; }
  tbody tr.falta { border-left: 3px solid #f87171; background: #fef2f2; }
  tbody tr.feriado { border-left: 3px solid #60a5fa; background: #eff6ff; }
  tbody tr.atestado { border-left: 3px solid #38bdf8; background: #f0f9ff; }
  tbody tr.negativo { border-left: 3px solid #fb923c; background: #fff7ed; }
  tbody td { padding: 6px 6px; vertical-align: middle; }
  tbody td.c { text-align: center; }
  .pos { color: #16a34a; font-weight: 600; }
  .neg { color: #dc2626; font-weight: 600; }
  .neg-orange { color: #ea580c; font-weight: 600; }
  .roxo-t { color: #7c3aed; font-weight: 600; }
  .blue-t { color: #2563eb; font-weight: 600; }
  .muted { color: #94a3b8; }

  /* Observações */
  .obs { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 11px; color: #92400e; line-height: 1.7; }

  /* Assinaturas */
  .assinaturas { display: flex; gap: 40px; justify-content: space-between; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 24px; }
  .ass-bloco { flex: 1; text-align: center; }
  .ass-linha { border-bottom: 1px solid #334155; height: 46px; margin-bottom: 6px; }
  .ass-nome { font-size: 11px; font-weight: 600; color: #334155; }
  .ass-cargo { font-size: 10px; color: #94a3b8; }

  .rodape { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; }

  @media print {
    .print-btn { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; max-width: 100%; }
    @page { margin: 1cm 1.2cm; size: A4 landscape; }
    table { font-size: 10px; }
    thead th, tbody td { padding: 5px 4px; }
  }
`

export default async function RelatorioAditivoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: imp } = await admin
    .from('ponto_importacoes')
    .select(`
      id, arquivo_nome, periodo_inicio, periodo_fim,
      he50_minutos, he100_minutos, intervalo_suprimido_minutos,
      horas_negativas_minutos, faltas_sem_justificativa,
      total_dias_trabalhados, created_at,
      profissional_id,
      profissionais(nome, horario_entrada, horario_saida, intervalo_minutos, unidades(nome)),
      ponto_registros(
        id, data, dia_semana, e1, s1, e2, s2,
        tipo_dia, ocorrencia_descricao,
        delta_entrada_min, delta_saida_min, saldo_dia_min,
        intervalo_real_min, intervalo_suprimido_min, he100_min
      )
    `)
    .eq('id', id)
    .single()

  if (!imp) notFound()

  const prof = imp.profissionais as unknown as {
    nome: string
    horario_entrada: string | null
    horario_saida: string | null
    intervalo_minutos: number | null
    unidades: { nome: string } | null
  } | null

  const nomeProfissional = prof?.nome ?? '—'
  const nomeUnidade = prof?.unidades?.nome ?? '—'
  const horarioEntrada = prof?.horario_entrada ?? null
  const horarioSaida = prof?.horario_saida ?? null
  const intervaloMin = prof?.intervalo_minutos ?? 60

  let cargaDiariaMin = 0
  if (horarioEntrada && horarioSaida) {
    const [he, me] = horarioEntrada.split(':').map(Number)
    const [hs, ms] = horarioSaida.split(':').map(Number)
    cargaDiariaMin = (hs * 60 + ms) - (he * 60 + me) - intervaloMin
  }
  const cargaDiaria = cargaDiariaMin > 0
    ? `${Math.floor(cargaDiariaMin / 60)}h${(cargaDiariaMin % 60).toString().padStart(2, '0')}min`
    : '—'
  const horarioContratual = horarioEntrada && horarioSaida
    ? `${horarioEntrada.slice(0, 5)} às ${horarioSaida.slice(0, 5)} (almoço ${intervaloMin}min)`
    : '—'

  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const periodo = fmtPeriodo(imp.periodo_inicio, imp.periodo_fim)

  const registros = ((imp.ponto_registros as unknown[]) || []).map((r: any) => r)
    .sort((a: any, b: any) => a.data.localeCompare(b.data))

  function rowClass(r: any): string {
    if (r.tipo_dia === 'folga' || r.tipo_dia === 'recesso') return 'folga'
    if (r.tipo_dia === 'falta') return 'falta'
    if (r.tipo_dia === 'feriado') return 'feriado'
    if (r.tipo_dia === 'atestado') return 'atestado'
    if (r.saldo_dia_min < 0) return 'negativo'
    return ''
  }

  function ocorrenciaLabel(r: any): string {
    if (r.ocorrencia_descricao) return r.ocorrencia_descricao
    if (r.tipo_dia === 'folga') return 'Folga'
    if (r.tipo_dia === 'recesso') return 'Recesso'
    if (r.tipo_dia === 'feriado') return 'Feriado'
    if (r.tipo_dia === 'atestado') return 'Atestado'
    if (r.tipo_dia === 'falta') return '⚠ Falta'
    return '—'
  }

  const temNegativo = imp.horas_negativas_minutos > 0 || imp.faltas_sem_justificativa > 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <button className="print-btn" suppressHydrationWarning>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimir / Salvar PDF
      </button>
      <script dangerouslySetInnerHTML={{ __html: `document.querySelector('.print-btn').addEventListener('click',()=>window.print())` }} />

      <div className="page">
        {/* Cabeçalho */}
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Danelon" className="logo" />
            <div>
              <div className="titulo">Aditivo Folha de Ponto</div>
              <div className="subtitulo">{nomeUnidade}</div>
            </div>
          </div>
          <div className="emissao">
            <strong>Emitido em:</strong> {hoje}
          </div>
        </div>

        {/* Identificação */}
        <div className="info-box">
          <div className="info-item">
            <label>Profissional</label>
            <span>{nomeProfissional}</span>
          </div>
          <div className="info-item">
            <label>Período</label>
            <span>{periodo}</span>
          </div>
          <div className="info-item">
            <label>Horário contratual</label>
            <span>{horarioContratual}</span>
          </div>
          <div className="info-item">
            <label>Carga diária</label>
            <span>{cargaDiaria}</span>
          </div>
          <div className="info-item">
            <label>Dias trabalhados</label>
            <span>{imp.total_dias_trabalhados}</span>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="cards">
          <div className={`card ${imp.he50_minutos > 0 ? 'verde' : ''}`}>
            <div className="card-label">HE 50%</div>
            <div className="card-valor">{imp.he50_minutos > 0 ? `+${fmt(imp.he50_minutos)}` : '—'}</div>
          </div>
          <div className={`card ${imp.he100_minutos > 0 ? 'verde' : ''}`}>
            <div className="card-label">HE 100%</div>
            <div className="card-valor">{imp.he100_minutos > 0 ? `+${fmt(imp.he100_minutos)}` : '—'}</div>
          </div>
          <div className={`card ${imp.intervalo_suprimido_minutos > 0 ? 'roxo' : ''}`}>
            <div className="card-label">Interv. Suprimido</div>
            <div className="card-valor">{imp.intervalo_suprimido_minutos > 0 ? `+${fmt(imp.intervalo_suprimido_minutos)}` : '—'}</div>
          </div>
          <div className={`card ${imp.horas_negativas_minutos > 0 ? 'laranja' : ''}`}>
            <div className="card-label">H. Negativas</div>
            <div className="card-valor">{imp.horas_negativas_minutos > 0 ? `−${fmt(imp.horas_negativas_minutos)}` : '—'}</div>
          </div>
          <div className={`card ${imp.faltas_sem_justificativa > 0 ? 'vermelho' : ''}`}>
            <div className="card-label">Faltas s/ just.</div>
            <div className="card-valor">{imp.faltas_sem_justificativa > 0 ? `${imp.faltas_sem_justificativa}` : '—'}</div>
          </div>
        </div>

        {/* Tabela dia a dia */}
        <div className="sec-title">Registro diário</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th className="c">E1</th>
              <th className="c">S1</th>
              <th className="c">E2</th>
              <th className="c">S2</th>
              <th className="c">Δ Entrada</th>
              <th className="c">Δ Saída</th>
              <th className="c">Saldo dia</th>
              <th className="c">Almoço</th>
              <th className="c">Int. Sup.</th>
              <th className="c">HE 100%</th>
              <th>Ocorrência</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r: any) => (
              <tr key={r.id} className={rowClass(r)}>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{fmtData(r.data)}</td>
                <td className="c">{r.e1 || <span className="muted">—</span>}</td>
                <td className="c">{r.s1 || <span className="muted">—</span>}</td>
                <td className="c">{r.e2 || <span className="muted">—</span>}</td>
                <td className="c">{r.s2 || <span className="muted">—</span>}</td>
                <td className="c">
                  {r.delta_entrada_min > 0
                    ? <span className="pos">+{fmt(r.delta_entrada_min)}</span>
                    : r.delta_entrada_min < 0
                    ? <span className="neg">−{fmt(Math.abs(r.delta_entrada_min))}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="c">
                  {r.delta_saida_min > 0
                    ? <span className="pos">+{fmt(r.delta_saida_min)}</span>
                    : r.delta_saida_min < 0
                    ? <span className="neg-orange">−{fmt(Math.abs(r.delta_saida_min))}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="c">
                  {r.saldo_dia_min > 0
                    ? <span className="pos">+{fmt(r.saldo_dia_min)}</span>
                    : r.saldo_dia_min < 0
                    ? <span className="neg">−{fmt(Math.abs(r.saldo_dia_min))}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="c">
                  {r.intervalo_real_min != null
                    ? <span style={{ color: '#475569' }}>{fmt(r.intervalo_real_min)}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="c">
                  {r.intervalo_suprimido_min > 0
                    ? <span className="roxo-t">+{fmt(r.intervalo_suprimido_min)}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="c">
                  {r.he100_min > 0
                    ? <span className="blue-t">+{fmt(r.he100_min)}</span>
                    : <span className="muted">—</span>}
                </td>
                <td style={{ color: '#64748b', fontSize: 10 }}>{ocorrenciaLabel(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Observações */}
        {temNegativo && (
          <div className="obs">
            {imp.horas_negativas_minutos > 0 && (
              <p>• Saldo negativo de {fmt(imp.horas_negativas_minutos)} a serem compensadas conforme acordo entre as partes.</p>
            )}
            {imp.faltas_sem_justificativa > 0 && (
              <p>• {imp.faltas_sem_justificativa} falta{imp.faltas_sem_justificativa > 1 ? 's' : ''} sem justificativa no período.</p>
            )}
          </div>
        )}

        {/* Assinaturas */}
        <div className="assinaturas">
          <div className="ass-bloco">
            <div className="ass-linha" />
            <div className="ass-nome">{nomeProfissional}</div>
            <div className="ass-cargo">Profissional</div>
          </div>
          <div className="ass-bloco">
            <div className="ass-linha" />
            <div className="ass-nome">Responsável RH</div>
            <div className="ass-cargo">Danelon — {nomeUnidade}</div>
          </div>
        </div>

        <div className="rodape">
          Emitido em {hoje} · Danelon CRM Admin · {nomeUnidade}
        </div>
      </div>
    </>
  )
}
