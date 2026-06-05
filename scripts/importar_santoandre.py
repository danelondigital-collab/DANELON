"""
Importação completa das comandas de Santo André
Fontes:
  - Vendas-Comandas-Pacotes-2019a062026-SA.xls  (cabeçalho das comandas)
  - Vendas-Produtos-Serviços-Completo 2019a062026-SA.xls (itens + profissionais)
"""

import os, sys, json, time, xlrd
from datetime import datetime
from collections import defaultdict
import urllib.request, urllib.error

SUPABASE_URL = "https://bfsbkljoaejkgxqoeeeg.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmc2JrbGpvYWVqa2d4cW9lZWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI4MjU0MywiZXhwIjoyMDkxODU4NTQzfQ.A_2_LqWNLxrB-TM2ROko7yCWggYcK7rSVLrGim6I_rA"
SA_UNIDADE   = "304d3a99-072f-46eb-b111-2ba03c26d834"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ─── HTTP helpers ────────────────────────────────────────────────────────────

def api_get(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{'?' + params if params else ''}"
    req = urllib.request.Request(url, headers={**HEADERS, "Prefer": "count=exact"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def api_post(path, data):
    body = json.dumps(data).encode()
    req  = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"POST {path} erro: {err[:200]}")

def api_patch(path, params, data):
    body = json.dumps(data).encode()
    url  = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()) if r.length else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"PATCH {path} erro: {err[:200]}")

def api_get_all(path, params="", page=1000):
    """Busca todos os registros paginando."""
    results, offset = [], 0
    while True:
        sep = "&" if params else ""
        chunk = api_get(path, f"{params}{sep}limit={page}&offset={offset}")
        if not chunk: break
        results.extend(chunk)
        if len(chunk) < page: break
        offset += page
    return results

# ─── Carregar planilhas ───────────────────────────────────────────────────────

print("📂 Carregando planilhas...")

wb_totais = xlrd.open_workbook("/Users/jorgesouza/Documents/Claude/Projects/DANALON/danelon-app/scripts/Vendas-Comandas-Pacotes-2019a062026-SA.xls")
ws_totais = wb_totais.sheet_by_index(0)

wb_itens = xlrd.open_workbook("/Users/jorgesouza/Documents/Claude/Projects/DANALON/danelon-app/scripts/Vendas-Produtos-Serviços-Completo 2019a062026-SA.xls")
ws_itens = wb_itens.sheet_by_index(0)

def _float(v):
    try: return float(v)
    except: return 0.0

# Indexar cabeçalhos das comandas
comandas_header = {}
for r in range(1, ws_totais.nrows):
    num = str(ws_totais.cell_value(r,2)).strip()
    if not num: continue
    comandas_header[num] = {
        "cliente_nome": str(ws_totais.cell_value(r,0)).strip(),
        "celular":      str(ws_totais.cell_value(r,1)).strip(),
        "data":         str(ws_totais.cell_value(r,4)).strip(),
        "subtotal":     _float(ws_totais.cell_value(r,5)),
        "desconto":     _float(ws_totais.cell_value(r,6)),
        "total":        _float(ws_totais.cell_value(r,10)),
        "obs":          str(ws_totais.cell_value(r,3)).strip(),
    }

# Indexar itens por comanda
itens_por_comanda = defaultdict(list)
for r in range(1, ws_itens.nrows):
    num = str(ws_itens.cell_value(r,2)).strip()
    if not num: continue
    itens_por_comanda[num].append({
        "cliente_nome":   str(ws_itens.cell_value(r,0)).strip(),
        "celular":        str(ws_itens.cell_value(r,1)).strip(),
        "data":           str(ws_itens.cell_value(r,3)).strip(),
        "profissional":   str(ws_itens.cell_value(r,4)).strip(),
        "produto_servico":str(ws_itens.cell_value(r,5)).strip(),
        "categoria":      str(ws_itens.cell_value(r,6)).strip(),
        "quantidade":     _float(ws_itens.cell_value(r,7)) or 1,
        "total":          _float(ws_itens.cell_value(r,8)),
    })

print(f"  Comandas (header): {len(comandas_header)}")
print(f"  Comandas (itens):  {len(itens_por_comanda)}")

# ─── Carregar dados existentes do banco ──────────────────────────────────────

print("\n🔄 Carregando dados do banco...")

# Clientes do Santo André
clientes_db = {c["nome"].strip().lower(): c["id"]
               for c in api_get_all("clientes", f"unidade_id=eq.{SA_UNIDADE}&select=id,nome")}
print(f"  Clientes: {len(clientes_db)}")

# Serviços (globais)
servicos_db = {s["nome"].strip().lower(): s["id"]
               for s in api_get_all("servicos", "select=id,nome")}
print(f"  Serviços: {len(servicos_db)}")

# Produtos (globais)
produtos_db = {p["nome"].strip().lower(): p["id"]
               for p in api_get_all("produtos", "select=id,nome")}
print(f"  Produtos: {len(produtos_db)}")

# Profissionais do Santo André
profissionais_db = {p["nome"].strip().lower(): p["id"]
                    for p in api_get_all("profissionais", f"unidade_id=eq.{SA_UNIDADE}&select=id,nome")}
print(f"  Profissionais: {len(profissionais_db)}")

# Comandas já importadas (pelo campo numero)
# Verificar se campo numero existe
try:
    existing = api_get("comandas", f"unidade_id=eq.{SA_UNIDADE}&select=id,numero&limit=1")
    HAS_NUMERO = "numero" in (existing[0] if existing else {})
except:
    HAS_NUMERO = False

if HAS_NUMERO:
    comandas_db = {c["numero"]: c["id"]
                   for c in api_get_all("comandas", f"unidade_id=eq.{SA_UNIDADE}&select=id,numero&numero=not.is.null")}
    print(f"  Comandas já importadas: {len(comandas_db)}")
else:
    comandas_db = {}
    print("  ⚠️  Campo 'numero' não existe na tabela comandas — será criado via migration")

# ─── Cache e helpers ──────────────────────────────────────────────────────────

_cliente_cache   = dict(clientes_db)
_servico_cache   = dict(servicos_db)
_produto_cache   = dict(produtos_db)
_prof_cache      = dict(profissionais_db)

def parse_data(s):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%dT00:00:00")
        except: pass
    return datetime.now().strftime("%Y-%m-%dT00:00:00")

def get_or_create_cliente(nome, celular):
    key = nome.lower()
    if key in _cliente_cache:
        return _cliente_cache[key]
    tel = celular.strip().replace("55","",1) if celular.startswith("55") else celular
    rows = api_post("clientes", {
        "nome": nome, "telefone": tel or None,
        "unidade_id": SA_UNIDADE, "ativo": True
    })
    nid = rows[0]["id"] if rows else None
    if nid: _cliente_cache[key] = nid
    return nid

def get_or_create_profissional(nome):
    key = nome.lower()
    if key in _prof_cache:
        return _prof_cache[key]
    rows = api_post("profissionais", {
        "nome": nome, "telefone": "+55 (00) 00000-0000",
        "comissao_padrao": 0, "cor_agenda": "#94a3b8",
        "unidade_id": SA_UNIDADE, "ativo": False
    })
    nid = rows[0]["id"] if rows else None
    if nid: _prof_cache[key] = nid
    return nid

def get_servico_ou_produto(nome):
    key = nome.lower()
    # Tenta serviço primeiro
    if key in _servico_cache:
        return "servico", _servico_cache[key]
    if key in _produto_cache:
        return "produto", _produto_cache[key]
    # Cria como serviço novo
    rows = api_post("servicos", {
        "nome": nome, "duracao_minutos": 60,
        "preco": 0.0, "comissao_servico": 0, "ativo": True
    })
    nid = rows[0]["id"] if rows else None
    if nid: _servico_cache[key] = nid
    return "servico", nid

# ─── Importação principal ─────────────────────────────────────────────────────

print(f"\n🚀 Iniciando importação de {len(itens_por_comanda)} comandas...\n")

stats = {"criadas":0, "puladas":0, "erros":0, "itens":0, "prof_inativos":0}
erros_log = []

comandas_ordenadas = sorted(itens_por_comanda.keys(),
    key=lambda x: int(x.replace("C#","").replace("P#","")) if x[2:].isdigit() else 0)

for idx, num_comanda in enumerate(comandas_ordenadas, 1):
    try:
        # Pular se já importada
        if HAS_NUMERO and num_comanda in comandas_db:
            stats["puladas"] += 1
            continue

        header = comandas_header.get(num_comanda)
        itens  = itens_por_comanda[num_comanda]
        if not itens: continue

        # Dados do cabeçalho
        cliente_nome = (header or itens[0])["cliente_nome"]
        celular      = (header or itens[0]).get("celular","")
        data_str     = (header or itens[0])["data"]
        total        = header["total"] if header else sum(_float(i["total"]) for i in itens)
        desconto     = header["desconto"] if header else 0.0
        subtotal     = header["subtotal"] if header else total + desconto
        obs          = header["obs"] if header else ""

        # Cliente
        cliente_id = get_or_create_cliente(cliente_nome, celular)
        if not cliente_id:
            erros_log.append(f"{num_comanda}: cliente não criado")
            stats["erros"] += 1
            continue

        # Criar comanda
        comanda_payload = {
            "cliente_id":    cliente_id,
            "unidade_id":    SA_UNIDADE,
            "status":        "fechada",
            "data_abertura": parse_data(data_str),
            "data_fechamento": parse_data(data_str),
            "valor_total":   subtotal,
            "desconto":      desconto,
            "valor_final":   total,
            "observacoes":   obs or None,
        }
        if HAS_NUMERO:
            comanda_payload["numero"] = num_comanda

        comanda_rows = api_post("comandas", comanda_payload)
        if not comanda_rows:
            erros_log.append(f"{num_comanda}: comanda não criada")
            stats["erros"] += 1
            continue

        comanda_id = comanda_rows[0]["id"]
        if HAS_NUMERO:
            comandas_db[num_comanda] = comanda_id

        # Agrupar itens por produto_servico para detectar rateio
        item_profs = defaultdict(list)
        for item in itens:
            item_profs[item["produto_servico"]].append(item)

        for produto_servico, linhas in item_profs.items():
            tipo, ps_id = get_servico_ou_produto(produto_servico)
            if not ps_id: continue

            quantidade = linhas[0]["quantidade"]
            preco_unit = sum(_float(l["total"]) for l in linhas) / quantidade if quantidade else 0
            subtotal_item = sum(_float(l["total"]) for l in linhas)

            # Criar item da comanda
            item_payload = {
                "comanda_id":    comanda_id,
                "tipo":          tipo,
                "quantidade":    int(quantidade),
                "preco_unitario": round(preco_unit, 2),
                "subtotal":      round(subtotal_item, 2),
            }
            if tipo == "servico":
                item_payload["servico_id"] = ps_id
            else:
                item_payload["produto_id"] = ps_id

            item_rows = api_post("comanda_itens", item_payload)
            if not item_rows:
                continue

            item_id = item_rows[0]["id"]
            stats["itens"] += 1

            # Rateio entre profissionais
            n_profs = len(linhas)
            participacao = round(100.0 / n_profs, 2)

            for i, linha in enumerate(linhas):
                prof_id = get_or_create_profissional(linha["profissional"])
                if not prof_id: continue

                # Ajusta última participação para fechar 100%
                part = participacao if i < n_profs - 1 else round(100 - participacao * (n_profs-1), 2)
                valor_base = round(subtotal_item * (part / 100), 2)

                api_post("comanda_item_profissionais", {
                    "comanda_item_id":        item_id,
                    "profissional_id":        prof_id,
                    "percentual_participacao": part,
                    "percentual_comissao":    0,
                    "valor_base":             valor_base,
                    "valor_comissao":         0,
                })

        stats["criadas"] += 1

        if idx % 100 == 0 or idx <= 5:
            print(f"  [{idx}/{len(itens_por_comanda)}] Criadas: {stats['criadas']} | Itens: {stats['itens']} | Erros: {stats['erros']}")

    except Exception as e:
        erros_log.append(f"{num_comanda}: {str(e)[:100]}")
        stats["erros"] += 1
        if stats["erros"] <= 5:
            print(f"  ⚠️  Erro em {num_comanda}: {str(e)[:80]}")

print(f"\n✅ Importação concluída!")
print(f"  Comandas criadas:  {stats['criadas']}")
print(f"  Puladas (já existiam): {stats['puladas']}")
print(f"  Itens criados:     {stats['itens']}")
print(f"  Erros:             {stats['erros']}")

if erros_log:
    with open("/tmp/erros_importacao_sa.txt", "w") as f:
        f.write("\n".join(erros_log))
    print(f"\n  Log de erros salvo em /tmp/erros_importacao_sa.txt")
