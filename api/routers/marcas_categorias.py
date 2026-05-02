from __future__ import annotations

from fastapi import APIRouter

from ..core.supabase import get_supabase

router = APIRouter(tags=["taxonomia"])


@router.get("/api/marcas")
async def list_marcas():
    sb = get_supabase()
    res = (
        sb.table("marcas")
        .select("id, nome, slug, logo_url, ordem")
        .eq("ativo", True)
        .order("ordem")
        .order("nome")
        .execute()
    )
    return {"items": res.data or []}


@router.get("/api/categorias")
async def list_categorias():
    sb = get_supabase()
    res = (
        sb.table("categorias")
        .select("id, nome, slug, parent_id, ordem")
        .order("ordem")
        .order("nome")
        .execute()
    )
    return {"items": res.data or []}


@router.get("/api/banners")
async def list_banners():
    sb = get_supabase()
    res = (
        sb.table("banners")
        .select("id, titulo, imagem_url, link, ordem")
        .eq("ativo", True)
        .order("ordem")
        .execute()
    )
    return {"items": res.data or []}
