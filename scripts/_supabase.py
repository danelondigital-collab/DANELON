"""
Configuração e helpers de acesso ao Supabase para os scripts de importação.

A service_role key NÃO fica no código. Ela é lida, nesta ordem:
  1. variável de ambiente SUPABASE_SERVICE_ROLE_KEY
  2. arquivo .env.local na raiz do app (que já está no .gitignore)

Uso:
    from _supabase import SUPABASE_URL, UNIDADES, api_get_all, api_post
"""

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"


def _carrega_env(nome):
    valor = os.environ.get(nome)
    if valor:
        return valor.strip()
    if not ENV_PATH.exists():
        return None
    for linha in ENV_PATH.read_text().splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, _, v = linha.partition("=")
        if chave.strip() == nome:
            return v.strip().strip('"').strip("'")
    return None


SUPABASE_URL = _carrega_env("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = _carrega_env("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit(
        "\nCredenciais do Supabase não encontradas.\n"
        f"Defina SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL no ambiente,\n"
        f"ou garanta que existam em {ENV_PATH}\n"
        "\nA chave fica no painel do Supabase em Settings > API > service_role.\n"
    )

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

UNIDADES = {
    "morumbi": "7649a21a-2018-4758-960c-fe56041cfbc8",
    "santoandre": "304d3a99-072f-46eb-b111-2ba03c26d834",
    "alphaville": "05efad46-1e43-4b4e-89b4-325a8e582d89",
    "goiania": "7a3a87eb-948a-4432-b8a7-a1a67d597c7b",
}


def api_get(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{'?' + params if params else ''}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def api_get_all(path, params="", page=1000):
    resultados, offset = [], 0
    while True:
        sep = "&" if params else ""
        lote = api_get(path, f"{params}{sep}limit={page}&offset={offset}")
        if not lote:
            break
        resultados.extend(lote)
        if len(lote) < page:
            break
        offset += page
    return resultados


def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=HEADERS, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"POST {path} erro: {e.read().decode()[:300]}")


def api_patch(path, params, data):
    body = json.dumps(data).encode()
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read()) if r.length else []
