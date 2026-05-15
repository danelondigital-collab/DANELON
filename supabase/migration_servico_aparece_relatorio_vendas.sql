-- Adiciona flag para controlar se o serviço aparece no Relatório de Vendas
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS aparece_relatorio_vendas boolean NOT NULL DEFAULT true;

-- Serviços que NÃO devem aparecer no relatório de vendas
UPDATE servicos SET aparece_relatorio_vendas = false WHERE nome IN (
  'Venda Cabelo - 50 cm - a cada 10 gr',
  'Venda Cabelo - 55 cm - a cada 10 gr',
  'Venda Cabelo - 45 cm - a cada 10 gr',
  'Venda Cabelo - 60 cm - a cada 10 gr',
  'Confecção Alongamento até 200 gr.',
  'Personalização Mega (Profissional) - Cor e Alinhamento até 200 gr. - (lançar cada 10gr.)',
  'Retirada - Preenchimento e Alongamento Micro/Nano e Fita Adesiva Slin DANELON - Colocação e Manutenção (Todas as gramagens)',
  'Higienização - Preenchimento Capilar Micro/Nano Slin DANELON - Colocação e Manutenção',
  'Higienização - Fita Adesiva Micro Slin, Topo Capilar e Mechas Trendy DANELON - Colocação e Manutenção - Alongamento / Preenchimento Capilar até 180 gr.',
  'Mudança de método para Micro e Nanocápsulas Slin DANELON até 180 gr',
  'Profissional - Venda Cabelo - cada 10 gr.',
  'Serviços Diversos - Alongamentos Profissionais'
);
