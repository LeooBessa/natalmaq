from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..core.supabase import get_supabase

router = APIRouter(prefix="/api/produtos", tags=["produtos"])

PAGE_SIZE = 24

PRODUTO_SELECT = (
    "id, codigo, slug, nome, descricao, marca_id, categoria_id, preco, "
    "preco_promocional, estoque, peso_kg, imagens, complementares, ativo, destaque, "
    "marca:marcas!produtos_marca_id_fkey(id, nome, slug), "
    "categoria:categorias!produtos_categoria_id_fkey(id, nome, slug)"
)


@router.get("")
async def list_produtos(
    marca: str | None = None,
    categoria: str | None = None,
    q: str | None = None,
    page: int = Query(default=1, ge=1, le=500),
    destaque: bool | None = None,
):
    sb = get_supabase()
    start = (page - 1) * PAGE_SIZE
    end = start + PAGE_SIZE - 1

    query = sb.table("produtos").select(PRODUTO_SELECT, count="exact").eq("ativo", True)

    if marca:
        marca_row = (
            sb.table("marcas").select("id").eq("slug", marca).limit(1).execute()
        )
        if not marca_row.data:
            return {"items": [], "total": 0}
        query = query.eq("marca_id", marca_row.data[0]["id"])

    if categoria:
        cat_row = (
            sb.table("categorias").select("id").eq("slug", categoria).limit(1).execute()
        )
        if not cat_row.data:
            return {"items": [], "total": 0}
        query = query.eq("categoria_id", cat_row.data[0]["id"])

    if destaque:
        query = query.eq("destaque", True)

    if q:
        # ILIKE simples para listagem; busca/autocomplete usa rota dedicada com tsv
        query = query.ilike("nome", f"%{q}%")

    query = query.order("destaque", desc=True).order("nome").range(start, end)
    result = query.execute()

    return {"items": result.data or [], "total": result.count or 0}


@router.get("/{slug}")
async def get_produto(slug: str):
    sb = get_supabase()
    res = (
        sb.table("produtos")
        .select(PRODUTO_SELECT)
        .eq("slug", slug)
        .eq("ativo", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    produto = res.data[0]

    complementares_ids = produto.get("complementares") or []
    complementares_produtos = []
    if complementares_ids:
        comp = (
            sb.table("produtos")
            .select(PRODUTO_SELECT)
            .in_("id", complementares_ids)
            .eq("ativo", True)
            .execute()
        )
        complementares_produtos = comp.data or []

    return {**produto, "complementares_produtos": complementares_produtos}
