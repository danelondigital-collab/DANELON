#!/usr/bin/env python3
"""
Importa comandas (cabeçalho) e, opcionalmente, seus itens/comissões, a partir
dos exports "Vendas-Comandas-Pacotes" (cabeçalho) e "Vendas-Produtos-Serviços-
Completo" (itens) do sistema de origem.

Substitui a lógica hardcoded de importar_morumbi.py / importar_santoandre.py:
mesmo comportamento, mas generico por --unidade e sem caminho de arquivo fixo.

Deduplicação: pelo campo `numero` (ex: C#12929) em `comandas`, único por unidade.
  - Comanda com numero ja existente: reaproveita o id, nao recria.
  - Se ela ainda nao tem itens em comanda_itens e --arquivo-itens foi passado,
    os itens sao adicionados agora (backfill) -- seguro rodar de novo depois
    que a planilha de itens chegar, sem duplicar as comandas ja criadas.
  - Comanda que ja tem itens: itens nao sao tocados de novo.

Exemplos:
    # só cabeçalho, valida sem gravar
    python3 importar_comandas.py --unidade morumbi \\
        --arquivo-cabecalho "~/Downloads/Vendas-Comandas-Pacotes (1).xls" --dry-run

    # cabeçalho + itens, grava de verdade
    python3 importar_comandas.py --unidade morumbi \\
        --arquivo-cabecalho "~/Downloads/Vendas-Comandas-Pacotes (1).xls" \\
        --arquivo-itens "~/Downloads/Vendas-Produtos-Servicos-Completo.xls"
"""

import argparse
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import xlrd

from _supabase import UNIDADES, api_get_all, api_post

NUM_RE = re.compile(r"[CP]#\d+")


def _s(v):
    return str(v).strip() if v else ""


def _float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _data_iso(s):
    """Meia-noite em horario de Brasilia (-03:00), nao UTC -- sem o offset,
    o Postgres grava como UTC e a data acaba aparecendo um dia antes pra
    qualquer usuario vendo em horario do Brasil (ex: 22/08 vira 21/08)."""
    s = _s(s)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%dT00:00:00-03:00")
        except ValueError:
            pass
    return None


def _telefone(v):
    v = re.sub(r"[ \-()]", "", _s(v))
    if v.startswith("55") and len(v) > 11:
        v = v[2:]
    return v or None


def carregar_cabecalho(caminho):
    wb = xlrd.open_workbook(str(caminho))
    ws = wb.sheet_by_index(0)
    out = {}
    ignoradas = 0
    for r in range(1, ws.nrows):
        num = _s(ws.cell_value(r, 2))
        if not NUM_RE.fullmatch(num):
            ignoradas += 1
            continue
        out[num] = dict(
            cliente_nome=_s(ws.cell_value(r, 0)),
            celular=_s(ws.cell_value(r, 1)),
            data=_s(ws.cell_value(r, 4)),
            subtotal=_float(ws.cell_value(r, 5)),
            desconto=_float(ws.cell_value(r, 6)),
            total=_float(ws.cell_value(r, 10)),
            obs=_s(ws.cell_value(r, 3)),
        )
    return out, ignoradas


def carregar_itens(caminho):
    wb = xlrd.open_workbook(str(caminho))
    ws = wb.sheet_by_index(0)
    out = defaultdict(list)
    ignoradas = 0
    for r in range(1, ws.nrows):
        num = _s(ws.cell_value(r, 2))
        if not NUM_RE.fullmatch(num):
            ignoradas += 1
            continue
        out[num].append(dict(
            cliente_nome=_s(ws.cell_value(r, 0)),
            celular=_s(ws.cell_value(r, 1)),
            data=_s(ws.cell_value(r, 3)),
            profissional=_s(ws.cell_value(r, 4)),
            produto_servico=_s(ws.cell_value(r, 5)),
            categoria=_s(ws.cell_value(r, 6)),
            quantidade=_float(ws.cell_value(r, 7)) or 1,
            total=_float(ws.cell_value(r, 8)),
        ))
    return out, ignoradas


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--unidade", required=True, choices=sorted(UNIDADES))
    p.add_argument("--arquivo-cabecalho", required=True,
                   help="export 'Vendas-Comandas-Pacotes' (.xls)")
    p.add_argument("--arquivo-itens",
                   help="export 'Vendas-Produtos-Serviços-Completo' (.xls), opcional")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    caminho_cab = Path(args.arquivo_cabecalho).expanduser()
    if not caminho_cab.exists():
        sys.exit(f"Arquivo não encontrado: {caminho_cab}")
    caminho_itens = None
    if args.arquivo_itens:
        caminho_itens = Path(args.arquivo_itens).expanduser()
        if not caminho_itens.exists():
            sys.exit(f"Arquivo não encontrado: {caminho_itens}")

    unidade_id = UNIDADES[args.unidade]

    print(f"Carregando {caminho_cab.name} ...")
    cabecalho, ign_cab = carregar_cabecalho(caminho_cab)
    print(f"  comandas válidas: {len(cabecalho)}  (linhas de rodapé/lixo ignoradas: {ign_cab})")

    itens_por_comanda = {}
    if caminho_itens:
        print(f"Carregando {caminho_itens.name} ...")
        itens_por_comanda, ign_it = carregar_itens(caminho_itens)
        print(f"  comandas com itens: {len(itens_por_comanda)}  (linhas ignoradas: {ign_it})")

    print("\nCarregando dados existentes do banco...")
    clientes_por_nome = defaultdict(list)
    for c in api_get_all("clientes", f"unidade_id=eq.{unidade_id}&select=id,nome,telefone"):
        clientes_por_nome[c["nome"].strip().lower()].append((c["id"], (c.get("telefone") or "").strip()))
    servicos_db = {s["nome"].strip().lower(): s["id"]
                   for s in api_get_all("servicos", "select=id,nome")}
    produtos_db = {pr["nome"].strip().lower(): pr["id"]
                   for pr in api_get_all("produtos", "select=id,nome")}
    profissionais_db = {pf["nome"].strip().lower(): pf["id"]
                        for pf in api_get_all("profissionais", f"unidade_id=eq.{unidade_id}&select=id,nome")}
    comandas_db = {c["numero"]: c["id"]
                   for c in api_get_all("comandas", f"unidade_id=eq.{unidade_id}&select=id,numero&numero=not.is.null")}
    clientes_com_historico_numerado = {
        c["cliente_id"] for c in api_get_all(
            "comandas", f"unidade_id=eq.{unidade_id}&numero=not.is.null&select=cliente_id")
    }
    itens_count_db = defaultdict(int)
    if caminho_itens:
        for i in api_get_all("comanda_itens", "select=comanda_id"):
            itens_count_db[i["comanda_id"]] += 1

    n_clientes = sum(len(v) for v in clientes_por_nome.values())
    print(f"  clientes: {n_clientes} ({len(clientes_por_nome)} nomes únicos) | serviços: {len(servicos_db)} | "
          f"produtos: {len(produtos_db)} | profissionais: {len(profissionais_db)} | "
          f"comandas já numeradas: {len(comandas_db)}")

    def resolver_cliente(nome, celular):
        """Retorna (cliente_id, criado, ambiguo). Nunca adivinha entre 2+ clientes
        com o mesmo nome sem telefone pra desempatar -- melhor pular a comanda
        do que atrelar a pessoa errada."""
        key = nome.lower()
        tel = _telefone(celular) or ""
        candidatos = clientes_por_nome.get(key, [])

        if len(candidatos) == 1:
            return candidatos[0][0], False, False

        if len(candidatos) > 1:
            match_tel = [c for c in candidatos if c[1] == tel and tel]
            if len(match_tel) == 1:
                return match_tel[0][0], False, False
            # telefone não desempatou -- prefere quem já tem comanda numerada
            # (continuação da mesma sequência C#, não é chute: é a mesma pessoa
            # que já aparece nesse histórico numerado)
            com_historico = [c for c in candidatos if c[0] in clientes_com_historico_numerado]
            if len(com_historico) == 1:
                return com_historico[0][0], False, False
            return None, False, True  # ambíguo de verdade: 0 ou 2+ com histórico

        # nenhum candidato -> cliente novo
        if args.dry_run:
            novo_id = f"DRY-RUN-{key}"
        else:
            rows = api_post("clientes", {
                "nome": nome, "telefone": tel or None,
                "unidade_id": unidade_id, "ativo": True,
            })
            novo_id = rows[0]["id"] if rows else None
        if novo_id:
            clientes_por_nome[key].append((novo_id, tel))
        return novo_id, True, False

    def get_or_create_profissional(nome):
        key = nome.lower()
        if key in profissionais_db:
            return profissionais_db[key]
        if args.dry_run:
            profissionais_db[key] = "DRY-RUN"
            return "DRY-RUN"
        rows = api_post("profissionais", {
            "nome": nome, "telefone": "+55 (00) 00000-0000",
            "comissao_padrao": 0, "cor_agenda": "#94a3b8",
            "unidade_id": unidade_id, "ativo": False,
        })
        pid = rows[0]["id"] if rows else None
        if pid:
            profissionais_db[key] = pid
        return pid

    def get_servico_ou_produto(nome):
        key = nome.lower()
        if key in servicos_db:
            return "servico", servicos_db[key]
        if key in produtos_db:
            return "produto", produtos_db[key]
        if args.dry_run:
            servicos_db[key] = "DRY-RUN"
            return "servico", "DRY-RUN"
        rows = api_post("servicos", {
            "nome": nome, "duracao_minutos": 60, "preco": 0.0,
            "comissao_servico": 0, "ativo": True,
        })
        sid = rows[0]["id"] if rows else None
        if sid:
            servicos_db[key] = sid
        return "servico", sid

    stats = dict(comandas_criadas=0, comandas_puladas=0, clientes_novos=0,
                 itens_criados=0, comandas_backfill=0, erros=0, ambiguas=0)
    erros_log = []
    ambiguas_log = []

    for numero, header in cabecalho.items():
        try:
            comanda_id = comandas_db.get(numero)
            comanda_nova = comanda_id is None

            if comanda_nova:
                cliente_id, criado, ambiguo = resolver_cliente(header["cliente_nome"], header["celular"])
                if ambiguo:
                    stats["ambiguas"] += 1
                    ambiguas_log.append(
                        f"{numero}: '{header['cliente_nome']}' (tel planilha: {header['celular'] or '-'}) "
                        f"-- {len(clientes_por_nome[header['cliente_nome'].strip().lower()])} clientes com esse nome no banco, "
                        f"nenhum com telefone batendo"
                    )
                    continue
                if criado:
                    stats["clientes_novos"] += 1
                if not cliente_id:
                    erros_log.append(f"{numero}: cliente não criado")
                    stats["erros"] += 1
                    continue

                data_iso = _data_iso(header["data"])
                payload = {
                    "cliente_id": cliente_id,
                    "unidade_id": unidade_id,
                    "numero": numero,
                    "status": "fechada",
                    "data_abertura": data_iso,
                    "data_fechamento": data_iso,
                    "valor_total": header["subtotal"],
                    "desconto": header["desconto"],
                    "valor_final": header["total"],
                    "observacoes": header["obs"] or None,
                }
                if args.dry_run:
                    comanda_id = f"DRY-RUN-{numero}"
                else:
                    rows = api_post("comandas", payload)
                    if not rows:
                        erros_log.append(f"{numero}: comanda não criada")
                        stats["erros"] += 1
                        continue
                    comanda_id = rows[0]["id"]
                comandas_db[numero] = comanda_id
                stats["comandas_criadas"] += 1
            else:
                stats["comandas_puladas"] += 1

            # itens: só grava se veio arquivo de itens E essa comanda ainda não tem nenhum
            if caminho_itens and numero in itens_por_comanda:
                ja_tem_itens = itens_count_db.get(comanda_id, 0) > 0
                if ja_tem_itens:
                    continue
                if not comanda_nova:
                    stats["comandas_backfill"] += 1

                linhas = itens_por_comanda[numero]
                agrupado = defaultdict(list)
                for it in linhas:
                    agrupado[it["produto_servico"]].append(it)

                for produto_servico, grupo in agrupado.items():
                  try:
                    tipo, ps_id = get_servico_ou_produto(produto_servico)
                    if not ps_id:
                        continue
                    quantidade = grupo[0]["quantidade"]
                    subtotal_item = sum(g["total"] for g in grupo)
                    preco_unit = subtotal_item / quantidade if quantidade else 0

                    item_payload = {
                        "comanda_id": comanda_id,
                        "tipo": tipo,
                        "quantidade": int(quantidade),
                        "preco_unitario": round(preco_unit, 2),
                        "subtotal": round(subtotal_item, 2),
                    }
                    item_payload["servico_id" if tipo == "servico" else "produto_id"] = ps_id

                    if args.dry_run:
                        item_id = "DRY-RUN"
                    else:
                        item_rows = api_post("comanda_itens", item_payload)
                        if not item_rows:
                            continue
                        item_id = item_rows[0]["id"]
                    stats["itens_criados"] += 1

                    # Agrupa por profissional -- a mesma pessoa pode aparecer 2x na
                    # planilha pro mesmo produto/serviço (repetiu o procedimento na
                    # mesma comanda). A tabela tem unique(comanda_item_id, profissional_id),
                    # então cada profissional só pode ter UMA linha aqui: soma a
                    # participação dele em vez de tentar inserir duas vezes.
                    linhas_por_prof = defaultdict(list)
                    for linha in grupo:
                        linhas_por_prof[linha["profissional"]].append(linha)
                    profs_distintos = list(linhas_por_prof.keys())
                    n_profs = len(profs_distintos)
                    acumulado = 0.0
                    for i, nome_prof in enumerate(profs_distintos):
                        prof_id = get_or_create_profissional(nome_prof)
                        if not prof_id:
                            continue
                        if i < n_profs - 1:
                            part = round(100.0 * len(linhas_por_prof[nome_prof]) / len(grupo), 2)
                            acumulado += part
                        else:
                            part = round(100 - acumulado, 2)
                        valor_base = round(subtotal_item * (part / 100), 2)
                        if not args.dry_run:
                            api_post("comanda_item_profissionais", {
                                "comanda_item_id": item_id,
                                "profissional_id": prof_id,
                                "percentual_participacao": part,
                                "percentual_comissao": 0,
                                "valor_base": valor_base,
                                "valor_comissao": 0,
                            })
                  except Exception as e:
                    # erro num grupo (ex: produto duplicado por profissional) não
                    # deve abortar os outros itens dessa mesma comanda
                    erros_log.append(f"{numero} / {produto_servico[:40]}: {str(e)[:120]}")
                    stats["erros"] += 1
        except Exception as e:
            erros_log.append(f"{numero}: {str(e)[:150]}")
            stats["erros"] += 1

    prefixo = "[DRY-RUN] " if args.dry_run else ""
    print(f"\n{prefixo}Comandas criadas:         {stats['comandas_criadas']}")
    print(f"{prefixo}Comandas já existiam:     {stats['comandas_puladas']}")
    print(f"{prefixo}  (dessas, completadas com itens agora: {stats['comandas_backfill']})")
    print(f"{prefixo}Clientes novos criados:   {stats['clientes_novos']}")
    if caminho_itens:
        print(f"{prefixo}Itens de comanda criados: {stats['itens_criados']}")
    print(f"{prefixo}Ambíguas (não importadas): {stats['ambiguas']}")
    print(f"{prefixo}Erros:                    {stats['erros']}")
    for e in erros_log[:20]:
        print("  ERRO", e)
    if ambiguas_log:
        print(f"\n{len(ambiguas_log)} comandas puladas por nome de cliente ambíguo "
              f"(mais de um cliente com o mesmo nome e telefone não bate):")
        for a in ambiguas_log:
            print("  ", a)
        log_path = Path(__file__).parent / f"ambiguas_{args.unidade}.txt"
        log_path.write_text("\n".join(ambiguas_log))
        print(f"\nLista salva em {log_path}")


if __name__ == "__main__":
    main()
