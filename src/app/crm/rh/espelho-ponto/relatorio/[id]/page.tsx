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

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; padding: 40px; max-width: 720px; margin: 0 auto; }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #7c3aed; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
  .print-btn:hover { background: #6d28d9; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 28px; }
  .logo { height: 44px; width: auto; }
  .titulo { font-size: 20px; font-weight: 700; color: #7c3aed; }
  .subtitulo { font-size: 12px; color: #64748b; margin-top: 2px; }
  .emissao { font-size: 12px; color: #64748b; text-align: right; }
  .emissao strong { display: block; font-weight: 600; color: #334155; }
  .label-sec { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #7c3aed; margin-bottom: 10px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; display: flex; gap: 40px; flex-wrap: wrap; }
  .info-item label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; display: block; margin-bottom: 2px; }
  .info-item span { font-size: 14px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border-radius: 8px; padding: 14px 16px; border: 1px solid #e2e8f0; background: #f8fafc; }
  .card.verde { background: #f0fdf4; border-color: #bbf7d0; }
  .card.roxo { background: #faf5ff; border-color: #e9d5ff; }
  .card.laranja { background: #fff7ed; border-color: #fed7aa; }
  .card.vermelho { background: #fef2f2; border-color: #fecaca; }
  .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 4px; }
  .card-valor { font-size: 20px; font-weight: 700; color: #475569; }
  .card.verde .card-valor { color: #16a34a; }
  .card.roxo .card-valor { color: #7c3aed; }
  .card.laranja .card-valor { color: #ea580c; }
  .card.vermelho .card-valor { color: #dc2626; }
  .obs { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 12px; color: #92400e; line-height: 1.7; }
  .declaracao { font-size: 12px; color: #475569; line-height: 1.8; margin: 10px 0 28px; }
  .assinaturas { display: flex; gap: 40px; justify-content: space-between; }
  .ass-bloco { flex: 1; text-align: center; }
  .ass-linha { border-bottom: 1px solid #334155; height: 50px; margin-bottom: 6px; }
  .ass-nome { font-size: 12px; font-weight: 600; color: #334155; }
  .ass-cargo { font-size: 10px; color: #94a3b8; }
  .rodape { margin-top: 28px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 14px; }
  @media print {
    .print-btn { display: none !important; }
    body { padding: 0; }
    @page { margin: 1.5cm; size: A4; }
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
      profissionais(nome, unidades(nome))
    `)
    .eq('id', id)
    .single()

  if (!imp) notFound()

  const prof = imp.profissionais as unknown as { nome: string; unidades: { nome: string } | null } | null
  const nomeProfissional = prof?.nome ?? '—'
  const nomeUnidade = prof?.unidades?.nome ?? '—'
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const periodo = fmtPeriodo(imp.periodo_inicio, imp.periodo_fim)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <button className="print-btn" onClick={undefined}
        suppressHydrationWarning>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimir / Salvar PDF
      </button>
      <script dangerouslySetInnerHTML={{ __html: `document.querySelector('.print-btn').addEventListener('click',()=>window.print())` }} />

      {/* Cabeçalho */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Danelon" className="logo" />
          <div>
            <div className="titulo">Aditivo Folha de Ponto</div>
            <div className="subtitulo">{nomeUnidade}</div>
          </div>
        </div>
        <div className="emissao">
          <strong>Data de emissão</strong>
          {hoje}
        </div>
      </div>

      {/* Identificação */}
      <div className="label-sec">Identificação</div>
      <div className="info-box">
        <div className="info-item">
          <label>Profissional</label>
          <span>{nomeProfissional}</span>
        </div>
        <div className="info-item">
          <label>Período de apuração</label>
          <span>{periodo}</span>
        </div>
        <div className="info-item">
          <label>Dias trabalhados</label>
          <span>{imp.total_dias_trabalhados}</span>
        </div>
      </div>

      {/* Resumo */}
      <div className="label-sec">Resumo de Horas</div>
      <div className="grid">
        <div className={`card ${imp.he50_minutos > 0 ? 'verde' : ''}`}>
          <div className="card-label">Hora Extra 50%</div>
          <div className="card-valor">{imp.he50_minutos > 0 ? `+${fmt(imp.he50_minutos)}` : '—'}</div>
        </div>
        <div className={`card ${imp.he100_minutos > 0 ? 'verde' : ''}`}>
          <div className="card-label">Hora Extra 100%</div>
          <div className="card-valor">{imp.he100_minutos > 0 ? `+${fmt(imp.he100_minutos)}` : '—'}</div>
        </div>
        <div className={`card ${imp.intervalo_suprimido_minutos > 0 ? 'roxo' : ''}`}>
          <div className="card-label">Intervalo Suprimido</div>
          <div className="card-valor">{imp.intervalo_suprimido_minutos > 0 ? `+${fmt(imp.intervalo_suprimido_minutos)}` : '—'}</div>
        </div>
        <div className={`card ${imp.horas_negativas_minutos > 0 ? 'laranja' : ''}`}>
          <div className="card-label">Horas Negativas</div>
          <div className="card-valor">{imp.horas_negativas_minutos > 0 ? `−${fmt(imp.horas_negativas_minutos)}` : '—'}</div>
        </div>
        <div className={`card ${imp.faltas_sem_justificativa > 0 ? 'vermelho' : ''}`}>
          <div className="card-label">Faltas s/ justificativa</div>
          <div className="card-valor">{imp.faltas_sem_justificativa > 0 ? `${imp.faltas_sem_justificativa} dia${imp.faltas_sem_justificativa > 1 ? 's' : ''}` : '—'}</div>
        </div>
      </div>

      {/* Observações */}
      {(imp.horas_negativas_minutos > 0 || imp.faltas_sem_justificativa > 0) && (
        <div className="obs">
          <div className="label-sec" style={{ color: '#92400e', marginBottom: 6 }}>Observações</div>
          {imp.horas_negativas_minutos > 0 && (
            <p>• Saldo negativo de {fmt(imp.horas_negativas_minutos)} a serem compensadas conforme acordo entre as partes.</p>
          )}
          {imp.faltas_sem_justificativa > 0 && (
            <p>• {imp.faltas_sem_justificativa} falta{imp.faltas_sem_justificativa > 1 ? 's' : ''} sem justificativa registrada no período.</p>
          )}
        </div>
      )}

      {/* Assinaturas */}
      <div className="label-sec">Declaração e Assinatura</div>
      <p className="declaracao">
        Declaro que estou ciente do resumo de horas do período de <strong>{periodo}</strong>,
        conforme registros do sistema de ponto eletrônico da Danelon.
      </p>
      <div className="assinaturas">
        <div className="ass-bloco">
          <div className="ass-linha" />
          <div className="ass-nome">{nomeProfissional}</div>
          <div className="ass-cargo">Profissional</div>
        </div>
        <div className="ass-bloco">
          <div className="ass-linha" />
          <div className="ass-nome">Responsável RH</div>
          <div className="ass-cargo">Danelon</div>
        </div>
      </div>

      <div className="rodape">
        Documento gerado em {hoje} · Danelon CRM Admin · {nomeUnidade}
      </div>
    </>
  )
}
