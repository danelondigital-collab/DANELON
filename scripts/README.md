# Scripts de importação

Scripts pontuais que carregam dados dos exports do sistema de origem (.xls) para o Supabase.
Usam a **service_role key**, que ignora o RLS — rode com atenção e sempre com `--dry-run` antes.

## Credenciais

A chave **não fica no código**. Os scripts leem, nesta ordem:

1. variável de ambiente `SUPABASE_SERVICE_ROLE_KEY`
2. `danelon-app/.env.local` (fora do git, via `.gitignore`)

Se nenhuma das duas existir, o script para com mensagem explicando o que fazer.
A chave está no painel do Supabase em **Settings → API → service_role**.

## Importar clientes

```bash
cd danelon-app/scripts

# 1. sempre confira antes
python3 importar_clientes.py --unidade morumbi --arquivo "~/Downloads/Lista-de-Clientes.xls" --dry-run

# 2. se o diff estiver certo, rode de verdade
python3 importar_clientes.py --unidade morumbi --arquivo "~/Downloads/Lista-de-Clientes.xls"
```

Unidades aceitas: `morumbi`, `santoandre`, `alphaville`, `goiania`.

Deduplicação: pula quem já existe na unidade com **mesmo nome + mesmo telefone**.
Quem tem nome igual mas telefone diferente **é inserido** e listado no fim como
possível duplicata, para conferência manual.

Colunas esperadas na planilha (primeira linha = cabeçalho):

| col | campo | col | campo |
|-----|-------|-----|-------|
| 0 | Nome | 7 | Aniversário |
| 1 | Observação | 8 | Endereço |
| 2 | Telefone | 9 | Número |
| 3 | Celular | 10 | Rua (vira bairro) |
| 4 | E-mail | 11 | Cidade |
| 5 | CPF | 12 | Estado |

## Outros scripts

- `importar_morumbi.py` / `importar_santoandre.py` — carga histórica de comandas
  (cabeçalho + itens + profissionais). Já rodados; mantidos como referência.
- `_supabase.py` — credenciais, ids das unidades e helpers HTTP compartilhados.

## Segurança

Nunca escreva a chave dentro de um `.py`. Se precisar de uma nova variável,
adicione em `.env.local` e leia por `_supabase._carrega_env`.
