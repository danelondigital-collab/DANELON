"""
Varre as conversas novas do Kommo num período e descobre, por canal, quem
mandou a PRIMEIRA mensagem de cada uma: o cliente ou a própria Danelon
(equipe ou automação como ManyChat).

Por que isso existe como script avulso e não roda na página: a API do Kommo
não deixa filtrar eventos de mensagem por lead — só por período. Pra saber
quem começou cada conversa é preciso buscar TODOS os eventos de mensagem do
período inteiro e cruzar com as conversas novas. Para 28 dias isso já passa
de 40 mil eventos e leva uns 5 minutos — bem acima do limite de 60s de uma
rota da Vercel. Por isso roda manualmente e guarda o resultado no Supabase
(tabela kommo_iniciativa_snapshot); o relatório de funil só lê esse snapshot.

Uso:
    python3 scripts/kommo_iniciativa.py [dias]

    dias: tamanho da janela terminando ontem (padrão: 28)
"""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _supabase import SUPABASE_URL, HEADERS as SB_HEADERS  # noqa: E402

ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"


def _carrega_env(nome):
    for linha in ENV_PATH.read_text().splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, _, v = linha.partition("=")
        if chave.strip() == nome:
            return v.strip().strip('"').strip("'")
    raise SystemExit(f"{nome} não encontrado em {ENV_PATH}")


SUBDOMAIN = _carrega_env("KOMMO_SUBDOMAIN")
TOKEN = _carrega_env("KOMMO_ACCESS_TOKEN")
BASE = f"https://{SUBDOMAIN}.kommo.com/api/v4"

CANAL_LABEL = {
    "waba": "WhatsApp",
    "instagram_business": "Instagram (DM)",
    "tiktok_kommo": "TikTok (DM)",
    "facebook": "Facebook",
}


def kommo_get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Authorization": f"Bearer {TOKEN}"})
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(req) as r:
                if r.status == 204:
                    return None
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(1.5 * (tentativa + 1))
                continue
            if e.code == 204:
                return None
            raise
    raise RuntimeError("Erro na API do Kommo: 429 repetido")


def buscar_conversas(from_unix: int, to_unix: int):
    """Conversas novas no período (com lead_id e canal), paginando a caixa de entrada."""
    conversas = []
    page = 1
    while page <= 30:
        data = kommo_get(f"/leads/unsorted?limit=250&page={page}")
        if not data:
            break
        items = data.get("_embedded", {}).get("unsorted", [])
        if not items:
            break
        crossed = False
        for item in items:
            ca = item.get("created_at", 0)
            if ca > to_unix:
                continue
            if ca < from_unix:
                crossed = True
                break
            leads = item.get("_embedded", {}).get("leads", [])
            lead_id = leads[0]["id"] if leads else None
            canal = CANAL_LABEL.get((item.get("metadata") or {}).get("service", ""), "Outro")
            conversas.append({"lead_id": lead_id, "canal": canal})
        if crossed:
            break
        if not data.get("_links", {}).get("next") or len(items) < 250:
            break
        page += 1
    return conversas


def buscar_primeira_mensagem_por_lead(from_unix: int, to_unix: int, lead_ids: set, budget_s: int = 480):
    """Varre TODOS os eventos de mensagem do período e acha, por lead, o mais antigo."""
    primeiro_por_lead = {}
    page = 1
    t0 = time.time()
    while True:
        data = kommo_get(
            f"/events?filter[type][]=incoming_chat_message&filter[type][]=outgoing_chat_message"
            f"&filter[created_at][from]={from_unix}&filter[created_at][to]={to_unix}&limit=250&page={page}"
        )
        if not data:
            break
        events = data.get("_embedded", {}).get("events", [])
        if not events:
            break
        for ev in events:
            lead_id = ev.get("entity_id")
            if ev.get("entity_type") != "lead" or lead_id not in lead_ids:
                continue
            ca = ev.get("created_at", 0)
            typ = ev.get("type")
            atual = primeiro_por_lead.get(lead_id)
            if atual is None or ca < atual[0]:
                primeiro_por_lead[lead_id] = (ca, typ)
        if not data.get("_links", {}).get("next") or len(events) < 250:
            break
        page += 1
        if time.time() - t0 > budget_s:
            print(f"  [aviso] orçamento de {budget_s}s estourado na página {page}, parando a varredura")
            break
    return primeiro_por_lead


def salvar_snapshot(canal, periodo_inicio, periodo_fim, total, cliente_iniciou, nos_iniciamos):
    # Upsert manual: apaga o snapshot desse canal/período (se existir) e insere de novo.
    import urllib.parse

    filtro = (
        f"canal=eq.{urllib.parse.quote(canal)}"
        f"&periodo_inicio=eq.{periodo_inicio}&periodo_fim=eq.{periodo_fim}"
    )
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/kommo_iniciativa_snapshot?{filtro}",
        headers=SB_HEADERS,
        method="DELETE",
    )
    with urllib.request.urlopen(req):
        pass

    body = json.dumps(
        {
            "canal": canal,
            "periodo_inicio": str(periodo_inicio),
            "periodo_fim": str(periodo_fim),
            "total": total,
            "cliente_iniciou": cliente_iniciou,
            "nos_iniciamos": nos_iniciamos,
        }
    ).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/kommo_iniciativa_snapshot", data=body, headers=SB_HEADERS, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    dias = int(sys.argv[1]) if len(sys.argv) > 1 else 28
    end_date = datetime.now(timezone.utc).date() - timedelta(days=1)
    start_date = end_date - timedelta(days=dias - 1)
    tz = timezone(timedelta(hours=-3))
    from_unix = int(datetime.combine(start_date, datetime.min.time()).replace(tzinfo=tz).timestamp())
    to_unix = int(datetime.combine(end_date, datetime.max.time()).replace(tzinfo=tz).timestamp())

    print(f"Período: {start_date} .. {end_date} ({dias} dias)\n")

    t0 = time.time()
    conversas = buscar_conversas(from_unix, to_unix)
    lead_ids = {c["lead_id"] for c in conversas if c["lead_id"]}
    print(f"[{time.time() - t0:.1f}s] Conversas novas no período: {len(conversas)} (com lead_id: {len(lead_ids)})")

    t1 = time.time()
    primeiro_por_lead = buscar_primeira_mensagem_por_lead(from_unix, to_unix, lead_ids)
    print(f"[{time.time() - t1:.1f}s] Leads com primeira mensagem encontrada: {len(primeiro_por_lead)}/{len(lead_ids)}\n")

    por_canal = {}
    for c in conversas:
        canal = c["canal"]
        d = por_canal.setdefault(canal, {"total": 0, "cliente_iniciou": 0, "nos_iniciamos": 0, "sem_dado": 0})
        d["total"] += 1
        evento = primeiro_por_lead.get(c["lead_id"])
        if evento is None:
            d["sem_dado"] += 1
            continue
        if evento[1] == "incoming_chat_message":
            d["cliente_iniciou"] += 1
        else:
            d["nos_iniciamos"] += 1

    print("=== Resultado por canal ===")
    for canal, d in sorted(por_canal.items(), key=lambda x: -x[1]["total"]):
        pct_nos = d["nos_iniciamos"] / d["total"] * 100 if d["total"] else 0
        print(
            f"  {canal:20s} total={d['total']:5d}  cliente_iniciou={d['cliente_iniciou']:5d}  "
            f"nos_iniciamos={d['nos_iniciamos']:5d} ({pct_nos:.1f}%)  sem_dado={d['sem_dado']}"
        )
        salvar_snapshot(canal, start_date, end_date, d["total"], d["cliente_iniciou"], d["nos_iniciamos"])

    print("\nSnapshot salvo em kommo_iniciativa_snapshot.")


if __name__ == "__main__":
    main()
