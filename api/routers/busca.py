from __future__ import annotations

from fastapi import APIRouter, Query

from ..core.supabase import get_supabase

router = APIRouter(prefix="/api/busca", tags=["busca"])


@router.get("/autocomplete")
async def autocomplete(q: str = Query(..., min_length=1, max_length=80)):
    sb = get_supabase()

    # ILIKE com wildcards — para um catálogo pequeno-médio é suficiente.
    # Se crescer, basta migrar para websearch_to_tsquery contra produtos.busca_tsv.
    res = (
        sb.table("produtos")
        .select("id, slug, nome, preco, preco_promocional, imagens")
        .eq("ativo", True)
        .ilike("nome", f"%{q}%")
        .limit(8)
        .execute()
    )
    return {"items": res.data or []}
