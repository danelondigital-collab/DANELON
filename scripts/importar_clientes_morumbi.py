"""
Importação de clientes do Morumbi a partir de Lista-de-Clientes (1).xls
"""

import json, time, xlrd
from datetime import datetime
import urllib.request, urllib.error

SUPABASE_URL = "https://bfsbkljoaejkgxqoeeeg.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmc2JrbGpvYWVqa2d4cW9lZWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI4MjU0MywiZXhwIjoyMDkxODU4NTQzfQ.A_2_LqWNLxrB-TM2ROko7yCWggYcK7rSVLrGim6I_rA"
MORUMBI_ID   = "7649a21a-2018-4758-960c-fe56041cfbc8"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def api_get(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{'?' + params if params else ''}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def api_get_all(path, params="", page=1000):
    results, offset = [], 0
    while True:
        sep = "&" if params else ""
        chunk = api_get(path, f"{params}{sep}limit={page}&offset={offset}")
        if not chunk: break
        results.extend(chunk)
        if len(chunk) < page: break
        offset += page
    return results

def api_post(path, data):
    body = json.dumps(data).encode()
    req  = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"POST {path} erro: {err[:300]}")

def api_patch(path, params, data):
    body = json.dumps(data).encode()
    url  = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read()) if r.length else []

def _str(v):
    return str(v).strip() if v else ""

def _float(v):
    try: return float(v)
    except: return None

def parse_data(s):
    s = s.strip()
    if not s: return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except: pass
    return None

def normaliza_telefone(v):
    v = _str(v)
    if not v: return None
    v = v.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if v.startswith("55") and len(v) > 11:
        v = v[2:]
    return v or None

print("📂 Carregando planilha...")
wb = xlrd.open_workbook("/tmp/danelon-check/scripts/Lista-de-Clientes (1).xls")
ws = wb.sheet_by_index(0)
print(f"  Linhas: {ws.nrows - 1}")

print("\n🔄 Carregando clientes existentes do Morumbi...")
existentes = api_get_all("clientes", f"unidade_id=eq.{MORUMBI_ID}&select=id,nome,telefone")
chave_existente = set()
for c in existentes:
    chave_existente.add((c["nome"].strip().lower(), (c.get("telefone") or "").strip()))
print(f"  Clientes já cadastrados: {len(existentes)}")

print(f"\n🚀 Iniciando importação de {ws.nrows - 1} clientes...\n")

criados = 0
pulados = 0
erros = 0
erros_log = []

for r in range(1, ws.nrows):
    nome = _str(ws.cell_value(r, 0))
    if not nome:
        continue

    telefone = normaliza_telefone(ws.cell_value(r, 3)) or normaliza_telefone(ws.cell_value(r, 2))
    chave = (nome.lower(), telefone or "")

    if chave in chave_existente:
        pulados += 1
        continue

    payload = {
        "nome": nome,
        "telefone": telefone,
        "email": _str(ws.cell_value(r, 4)) or None,
        "cpf": _str(ws.cell_value(r, 5)) or None,
        "data_nascimento": parse_data(_str(ws.cell_value(r, 7))),
        "observacoes": _str(ws.cell_value(r, 1)) or None,
        "logradouro": _str(ws.cell_value(r, 8)) or None,
        "numero": _str(ws.cell_value(r, 9)) or None,
        "bairro": _str(ws.cell_value(r, 10)) or None,
        "cidade": _str(ws.cell_value(r, 11)) or None,
        "estado": _str(ws.cell_value(r, 12)) or None,
        "unidade_id": MORUMBI_ID,
        "ativo": True,
    }

    try:
        api_post("clientes", payload)
        criados += 1
        chave_existente.add(chave)
    except Exception as e:
        erros += 1
        erros_log.append(f"{nome}: {e}")
        print(f"  ⚠️  Erro em {nome}: {e}")

    if (criados + pulados) % 200 == 0:
        print(f"  [{r}/{ws.nrows-1}] Criados: {criados} | Pulados: {pulados} | Erros: {erros}")

print(f"\n✅ Importação concluída!")
print(f"  Clientes criados:  {criados}")
print(f"  Pulados (já existiam): {pulados}")
print(f"  Erros:             {erros}")

if erros_log:
    with open("/tmp/erros_importacao_clientes_morumbi.txt", "w") as f:
        f.write("\n".join(erros_log))
    print(f"\n  Log de erros salvo em /tmp/erros_importacao_clientes_morumbi.txt")
