-- Adiciona os novos valores ao enum forma_pagamento
ALTER TYPE public.forma_pagamento ADD VALUE IF NOT EXISTS 'credito_avista';
ALTER TYPE public.forma_pagamento ADD VALUE IF NOT EXISTS 'credito_parcelado';
ALTER TYPE public.forma_pagamento ADD VALUE IF NOT EXISTS 'retrabalho';
ALTER TYPE public.forma_pagamento ADD VALUE IF NOT EXISTS 'avaliacao';
