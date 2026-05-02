from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core.schemas import FreteIn, FreteOut
from ..core.supabase import get_supabase

router = APIRouter(prefix="/api/frete", tags=["frete"])


@router.post("/calcular", response_model=FreteOut)
async def calcular(payload: FreteIn) -> FreteOut:
    sb = get_supabase()

    cep = payload.cep
    res = (
        sb.table("fretes_regra")
        .select("uf, faixa_cep_inicio, faixa_cep_fim, valor, prazo_dias, por_kg, ordem")
        .lte("faixa_cep_inicio", cep)
        .gte("faixa_cep_fim", cep)
        .order("ordem")
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=400,
            detail="Não há regra de frete para esse CEP. Entre em contato.",
        )

    regra = res.data[0]
    valor = float(regra["valor"]) + float(regra["por_kg"]) * float(payload.peso_total)
    regiao = regra.get("uf") or "Brasil"

    return FreteOut(
        valor=round(valor, 2),
        prazo_dias=int(regra["prazo_dias"]),
        regiao=regiao,
    )
