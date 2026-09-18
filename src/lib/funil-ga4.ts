import { hostFilter } from '@/lib/ga4'

/**
 * Todo o tráfego pago do TikTok fica fora do relatório de funil.
 *
 * Por quê: essas sessões clicam em 4 a 5 botões diferentes cada uma, contra
 * ~1,2 de qualquer outra origem, e respondem por 97% dos cliques do site. O
 * volume também é desproporcional — 98% das sessões — então qualquer quadro
 * que as inclua vira um retrato do TikTok, não do negócio.
 *
 * O que NÃO se pode concluir daí é que seja tráfego falso: engajamento de
 * 43,5% e 88s de permanência são de gente real (tráfego de robô fica em ~0%,
 * como a linha "(not set)" do próprio relatório). O padrão de recarregar a
 * mesma página 1,8 vez por sessão sugere que o link do WhatsApp não abre pelo
 * navegador interno do TikTok e a pessoa fica tentando outro botão — problema
 * a investigar no site, não no relatório.
 *
 * O gasto continua visível na seção de investimento, marcado como fora do
 * funil. TikTok orgânico (link na bio, perfil) não é afetado: o filtro só pega
 * mídia paga.
 *
 * pangleglobal.com é a rede de anúncios do TikTok (apps parceiros). Anúncio
 * entregue ali chega sem UTM, como "referral" — em set/2026 uma campanha
 * apontada pra /tiktok trouxe ~1.400 sessões/dia por esse caminho e aparecia
 * como se fosse gente vindo do link na bio.
 */
export const SEM_TIKTOK_PAGO = {
  notExpression: {
    filter: {
      fieldName: 'sessionSourceMedium',
      stringFilter: { matchType: 'FULL_REGEXP' as const, value: '^tiktok / (paid|cpc|ppc).*|.*pangle.*' },
    },
  },
}

export type Expressao = Record<string, unknown>

/** Host + fora o TikTok pago: é a base de TODO número do funil. */
export function base(...extras: Expressao[]) {
  return { andGroup: { expressions: [hostFilter(), SEM_TIKTOK_PAGO, ...extras] } }
}

/** Só os eventos de clique em botão de contato. */
export const BOTAO = {
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'BEGINS_WITH' as const, value: 'Botão' } },
}
