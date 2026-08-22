#!/usr/bin/env python3
"""
Importa clientes de um export .xls do sistema de origem para uma unidade.

Substitui os antigos importar_clientes_<unidade>.py, que tinham o caminho do
arquivo e o id da unidade escritos no código.

Colunas esperadas na planilha (aba única, primeira linha = cabeçalho):
    0 Nome | 1 Observação | 2 Telefone | 3 Celular | 4 E-mail | 5 CPF |
    7 Aniversário | 8 Endereço | 9 Número | 10 Rua(bairro) | 11 Cidade | 12 Estado

Deduplicação: pula quem já existe na unidade com o mesmo nome + telefone.

Exemplos:
    python3 importar_clientes.py --unidade morumbi --arquivo "~/Downloads/Lista-de-Clientes.xls" --dry-run
    python3 importar_clientes.py --unidade morumbi --arquivo "~/Downloads/Lista-de-Clientes.xls"
"""

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

import xlrd

from _supabase import UNIDADES, api_get_all, api_post

COL = dict(nome=0, obs=1, telefone=2, celular=3, email=4, cpf=5,
           nascimento=7, logradouro=8, numero=9, bairro=10, cidade=11, estado=12)


def _s(v):
    return str(v).strip() if v else ""


def _data(v):
    s = _s(v)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _telefone(v):
    v = re.sub(r"[ \-()]", "", _s(v))
    if v.startswith("55") and len(v) > 11:
        v = v[2:]
    return v or None


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--unidade", required=True, choices=sorted(UNIDADES),
                   help="unidade de destino")
    p.add_argument("--arquivo", required=True, help="caminho do .xls exportado")
    p.add_argument("--dry-run", action="store_true",
                   help="só mostra o que seria feito, não escreve no banco")
    args = p.parse_args()

    caminho = Path(args.arquivo).expanduser()
    if not caminho.exists():
        sys.exit(f"Arquivo não encontrado: {caminho}")

    unidade_id = UNIDADES[args.unidade]
    ws = xlrd.open_workbook(str(caminho)).sheet_by_index(0)
    print(f"Planilha: {caminho.name} ({ws.nrows - 1} linhas)")
    print(f"Unidade:  {args.unidade}")

    existentes = api_get_all("clientes", f"unidade_id=eq.{unidade_id}&select=nome,telefone")
    chaves = {(c["nome"].strip().lower(), (c.get("telefone") or "").strip())
              for c in existentes}
    nomes = {c["nome"].strip().lower() for c in existentes}
    print(f"Base atual: {len(existentes)} clientes\n")

    novos, criados, pulados, homonimos, erros = [], 0, 0, [], []

    for r in range(1, ws.nrows):
        nome = _s(ws.cell_value(r, COL["nome"]))
        if not nome:
            continue
        tel = (_telefone(ws.cell_value(r, COL["celular"]))
               or _telefone(ws.cell_value(r, COL["telefone"])))

        if (nome.lower(), tel or "") in chaves:
            pulados += 1
            continue
        if nome.lower() in nomes:
            homonimos.append(nome)

        payload = {
            "nome": nome,
            "telefone": tel,
            "email": _s(ws.cell_value(r, COL["email"])) or None,
            "cpf": _s(ws.cell_value(r, COL["cpf"])) or None,
            "data_nascimento": _data(ws.cell_value(r, COL["nascimento"])),
            "observacoes": _s(ws.cell_value(r, COL["obs"])) or None,
            "logradouro": _s(ws.cell_value(r, COL["logradouro"])) or None,
            "numero": _s(ws.cell_value(r, COL["numero"])) or None,
            "bairro": _s(ws.cell_value(r, COL["bairro"])) or None,
            "cidade": _s(ws.cell_value(r, COL["cidade"])) or None,
            "estado": _s(ws.cell_value(r, COL["estado"])) or None,
            "unidade_id": unidade_id,
            "ativo": True,
        }
        novos.append(payload)

        if not args.dry_run:
            try:
                api_post("clientes", payload)
                criados += 1
                chaves.add((nome.lower(), tel or ""))
                nomes.add(nome.lower())
            except Exception as e:
                erros.append(f"{nome}: {e}")

    if args.dry_run:
        print(f"[DRY-RUN] seriam inseridos: {len(novos)}")
        print(f"[DRY-RUN] já existiam:      {pulados}")
        for c in novos[:10]:
            print(f"   {c['nome'][:38]:<38} tel={c['telefone'] or '-'}")
        if len(novos) > 10:
            print(f"   ... e mais {len(novos) - 10}")
    else:
        print(f"Criados: {criados} | Pulados: {pulados} | Erros: {len(erros)}")
        for e in erros:
            print("  ERRO", e)

    if homonimos:
        print(f"\nAtenção: {len(homonimos)} com nome já existente na unidade mas "
              f"telefone diferente (podem ser duplicatas):")
        for n in homonimos[:15]:
            print(f"   {n}")


if __name__ == "__main__":
    main()
