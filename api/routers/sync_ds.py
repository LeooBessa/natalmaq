"""Sincronização DS WEBSERVICE (Delphi) -> Supabase.

Rotas (todas protegidas por SYNC_SECRET / CRON_SECRET):
  GET  /api/sync/ds/probe   -> diagnóstico: mostra o FORMATO REAL das respostas
                               do DS (login/produtos/estoque) p/ validar campos.
  GET|POST /api/sync/ds      -> executa o sync (resumível, time-boxed ~50s).
                               Cron da Vercel chama via GET.

Regras de negócio:
  * Chave de match: produtos.codigo == DS codigo_produto.
  * PRESERVA fotos: a coluna `imagens` NUNCA entra no payload de UPDATE.
  * PRESERVA slug/destaque/complementares em produtos existentes.
  * categoria_id derivado de codigo_linha (ds_categorias.LINHA_TO_SLUG).
  * Produtos novos (codigo inédito) são inseridos com imagens=[] e slug gerado.
"""
from __future__ import annotations

import re
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, Request

from ..core.ds_categorias import LINHA_TO_SLUG, slug_para_linha
from ..core.ds_client import DSClient, extrair_codigo, extrair_estoque_qtd
from ..core.settings import get_settings
from ..core.supabase import get_supabase

router = APIRouter(prefix="/api/sync/ds", tags=["sync"])

QREG = 500            # registros por página no DS
TIME_BUDGET = 50.0    # segundos por invocação (maxDuration=60)
WRITE_BATCH = 500     # linhas por upsert no Supabase


# ── Auth ──────────────────────────────────────────────────────────────────
def _check_secret(request: Request, authorization: str | None, secret_q: str | None) -> None:
    s = get_settings()
    aceitos = {t for t in (s.sync_secret, s.cron_secret) if t}
    if not aceitos:
        raise HTTPException(500, "SYNC_SECRET/CRON_SECRET não configurados")
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    token = token or secret_q
    if token not in aceitos:
        raise HTTPException(401, "secret inválido")


# ── Helpers ─────────────────────────────────────────────────────────────────
def _num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _slugify(nome: str, codigo: str) -> str:
    base = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-zA-Z0-9]+", "-", base).strip("-").lower()
    base = base[:60] or "produto"
    return f"{base}-{codigo}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _promo_ativa(p: dict[str, Any]) -> float | None:
    """Preço promocional só se > 0 e dentro da janela (inicio/fim) do DS."""
    preco = _num(p.get("preco_promocao"))
    if not preco or preco <= 0:
        return None
    agora = _now_iso()
    fim = p.get("fim_promocao")
    ini = p.get("inicio_promocao")
    if fim and str(fim) < agora:
        return None
    if ini and str(ini) > agora:
        return None
    return preco


def _read_state(sb) -> dict[str, Any]:
    res = sb.table("sync_state").select("*").eq("id", "ds_produtos").limit(1).execute()
    if res.data:
        return res.data[0]
    sb.table("sync_state").insert({"id": "ds_produtos", "phase": "full"}).execute()
    return {"id": "ds_produtos", "phase": "full", "stats": {}, "last_alt": None}


def _write_state(sb, phase: str, last_alt: str | None, stats: dict[str, Any]) -> None:
    sb.table("sync_state").update(
        {
            "phase": phase,
            "last_alt": last_alt,
            "last_run": _now_iso(),
            "stats": stats,
            "updated_at": _now_iso(),
        }
    ).eq("id", "ds_produtos").execute()


def _cat_map(sb) -> dict[str, str]:
    """slug -> categoria_id, APENAS das 14 categorias DS.

    Filtro explícito por slug é obrigatório: a tabela categorias tem ~1000+
    linhas-lixo (auto-categorização antiga) e o PostgREST corta em 1000 por
    padrão — sem o filtro, as categorias limpas ficavam de fora.
    """
    slugs = sorted(set(LINHA_TO_SLUG.values()))
    res = sb.table("categorias").select("id, slug").in_("slug", slugs).execute()
    return {row["slug"]: row["id"] for row in (res.data or [])}


# ── Construção de payloads (linha uniforme p/ o RPC ds_upsert_produtos) ───────
def _produto_row(p: dict[str, Any], cat_map: dict[str, str]) -> dict[str, Any] | None:
    """Linha uniforme p/ jsonb_to_recordset. slug sempre presente (usado só em
    INSERT; o RPC preserva slug/imagens/destaque nos produtos existentes)."""
    codigo = extrair_codigo(p)
    if not codigo:
        return None
    nome = str(p.get("descricao") or p.get("nome") or f"Produto {codigo}").strip()

    linha = p.get("codigo_linha") or p.get("linha")
    linha_str = str(linha).strip() if linha is not None else None
    categoria_id = None
    if linha_str:
        slug = slug_para_linha(linha_str)
        if slug:
            categoria_id = cat_map.get(slug)

    alt = p.get("data_hora_alt")
    return {
        "codigo": codigo,
        "slug": _slugify(nome, codigo),
        "nome": nome,
        "preco": _num(p.get("preco_venda")) or 0,
        "preco_promocional": _promo_ativa(p),
        "preco_custo": _num(p.get("preco_custo")),
        "ativo": str(p.get("inativo", "N")).strip().upper() not in ("S", "SIM", "1", "TRUE", "T"),
        "categoria_id": categoria_id,
        "codigo_linha": linha_str,
        "unidade": (str(p["unidade"]).strip() if p.get("unidade") is not None else None),
        "referencia": (str(p["referencia"]).strip() if p.get("referencia") is not None else None),
        "codigo_barra": (str(p["codigo_barra"]).strip() if p.get("codigo_barra") is not None else None),
        "ds_updated_at": (str(alt) if alt else None),
        "synced_at": _now_iso(),
    }


# ── Passos do sync ───────────────────────────────────────────────────────────
def _sync_produtos_page(sb, ds: DSClient, page: int, cat_map: dict[str, str],
                        alt_inicio: str | None) -> dict[str, Any]:
    raw = ds.get_produtos(qreg=QREG, page=page, data_hora_alt_inicio=alt_inicio)
    if not raw:
        return {"count": 0, "upserted": 0, "last_alt": None}

    rows = [r for r in (_produto_row(p, cat_map) for p in raw) if r]
    upserted = 0
    for i in range(0, len(rows), WRITE_BATCH):
        sb.rpc("ds_upsert_produtos", {"rows": rows[i : i + WRITE_BATCH]}).execute()
        upserted += len(rows[i : i + WRITE_BATCH])

    last_alt = None
    for p in raw:
        a = p.get("data_hora_alt")
        if a and (last_alt is None or str(a) > last_alt):
            last_alt = str(a)

    return {"count": len(raw), "upserted": upserted, "last_alt": last_alt}


def _sync_estoque_page(sb, ds: DSClient, page: int, alt_inicio: str | None) -> dict[str, Any]:
    raw = ds.get_estoque(qreg=QREG, page=page, data_hora_alt_inicio=alt_inicio)
    if not raw:
        return {"count": 0, "updated": 0}

    now = _now_iso()
    qtd: dict[str, int] = {}
    for r in raw:
        c = extrair_codigo(r)
        q = extrair_estoque_qtd(r)
        if c is not None and q is not None:
            qtd[c] = int(round(q))
    rows = [{"codigo": c, "estoque": q, "synced_at": now} for c, q in qtd.items()]

    updated = 0
    for i in range(0, len(rows), WRITE_BATCH):
        res = sb.rpc("ds_update_estoque", {"rows": rows[i : i + WRITE_BATCH]}).execute()
        updated += res.data if isinstance(res.data, int) else len(rows[i : i + WRITE_BATCH])

    return {"count": len(raw), "updated": updated}


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/probe")
async def probe(
    request: Request,
    authorization: str | None = Header(default=None),
    secret: str | None = Query(default=None),
):
    """Diagnóstico: mostra o formato REAL das respostas do DS (sem segredos)."""
    _check_secret(request, authorization, secret)
    ds = DSClient()
    login = ds.login()
    empresa = (login.get("empresas") or [{}])[0]

    produtos = ds.get_produtos(qreg=3, page=1)
    estoque = ds.get_estoque(qreg=3, page=1)

    def keys(lst: list[dict[str, Any]]) -> list[str]:
        return sorted(lst[0].keys()) if lst else []

    return {
        "login": {
            "keys": sorted(login.keys()),
            "empresa_keys": sorted(empresa.keys()),
            "empresa_nome": empresa.get("nome") or empresa.get("nome_empresa"),
            "tem_token_empresa": bool(
                empresa.get("token_empresa") or empresa.get("token_integra")
            ),
        },
        "produtos": {
            "qtd": len(produtos),
            "keys": keys(produtos),
            "amostra": produtos[0] if produtos else None,
            "tem_codigo_linha": bool(produtos and "codigo_linha" in produtos[0]),
        },
        "estoque": {
            "qtd": len(estoque),
            "keys": keys(estoque),
            "amostra": estoque[0] if estoque else None,
        },
    }


@router.api_route("", methods=["GET", "POST"])
async def sync(
    request: Request,
    authorization: str | None = Header(default=None),
    secret: str | None = Query(default=None),
    reset: bool = Query(default=False, description="reinicia o cursor (full do zero)"),
):
    _check_secret(request, authorization, secret)
    t0 = time.monotonic()
    sb = get_supabase()
    ds = DSClient()
    cat_map = _cat_map(sb)

    state = _read_state(sb)
    stats: dict[str, Any] = dict(state.get("stats") or {})
    phase = "full" if reset else (state.get("phase") or "full")
    last_alt = None if reset else state.get("last_alt")

    if reset:
        stats = {}

    produto_page = int(stats.get("produto_page", 1))
    estoque_page = int(stats.get("estoque_page", 1))
    produtos_done = bool(stats.get("produtos_done", False))
    estoque_done = bool(stats.get("estoque_done", False))
    tot_ups = int(stats.get("total_produtos", 0))
    tot_est = int(stats.get("total_estoque", 0))
    max_alt = last_alt

    log: list[str] = []
    try:
        if phase == "full":
            # 1) produtos (preços/características)
            while not produtos_done and (time.monotonic() - t0) < TIME_BUDGET:
                r = _sync_produtos_page(sb, ds, produto_page, cat_map, None)
                tot_ups += r["upserted"]
                if r["last_alt"] and (max_alt is None or r["last_alt"] > max_alt):
                    max_alt = r["last_alt"]
                log.append(f"produtos p{produto_page}: {r['count']} (upsert {r['upserted']})")
                if r["count"] < QREG:
                    produtos_done = True
                else:
                    produto_page += 1
            # 2) estoque (quantidades) — só depois de produtos prontos
            while produtos_done and not estoque_done and (time.monotonic() - t0) < TIME_BUDGET:
                r = _sync_estoque_page(sb, ds, estoque_page, None)
                tot_est += r["updated"]
                log.append(f"estoque p{estoque_page}: {r['count']} (~{r['updated']})")
                if r["count"] < QREG:
                    estoque_done = True
                else:
                    estoque_page += 1

            done = produtos_done and estoque_done
            stats.update(
                produto_page=produto_page, estoque_page=estoque_page,
                produtos_done=produtos_done, estoque_done=estoque_done,
                total_produtos=tot_ups, total_estoque=tot_est,
            )
            novo_phase = "incremental" if done else "full"
            _write_state(sb, novo_phase, max_alt or last_alt, stats)
            return {"ok": True, "phase": novo_phase, "done": done, "log": log,
                    "totais": {"produtos": tot_ups, "estoque": tot_est}}

        # ── incremental ──
        alt = last_alt
        ups = est = 0
        page = 1
        while (time.monotonic() - t0) < TIME_BUDGET:
            r = _sync_produtos_page(sb, ds, page, cat_map, alt)
            ups += r["upserted"]
            if r["last_alt"] and (max_alt is None or r["last_alt"] > max_alt):
                max_alt = r["last_alt"]
            log.append(f"inc produtos p{page}: {r['count']}")
            if r["count"] < QREG:
                break
            page += 1
        page = 1
        while (time.monotonic() - t0) < TIME_BUDGET:
            r = _sync_estoque_page(sb, ds, page, alt)
            est += r["updated"]
            log.append(f"inc estoque p{page}: {r['count']}")
            if r["count"] < QREG:
                break
            page += 1

        stats.update(ultimo_incremental={"produtos": ups, "estoque": est})
        _write_state(sb, "incremental", max_alt or last_alt, stats)
        return {"ok": True, "phase": "incremental", "done": True, "log": log,
                "totais": {"produtos": ups, "estoque": est}}

    except Exception as e:  # noqa: BLE001
        stats["last_error"] = str(e)[:500]
        _write_state(sb, phase, max_alt or last_alt, stats)
        raise HTTPException(500, f"sync falhou: {e}") from e
