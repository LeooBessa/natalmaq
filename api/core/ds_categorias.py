"""Mapeamento codigo_linha (DS WEBSERVICE) -> slug da categoria no Supabase.

Fonte: categorias-ds.json (inferido por frequência de palavras-chave nas
descrições, 11.881 produtos). As 14 categorias correspondentes são criadas na
migration 0020_ds_sync.sql. Linhas sem mapeamento ficam sem categoria
(categoria_id = null) e devem ser revisadas no admin.
"""
from __future__ import annotations

# codigo_linha (string, como vem do DS) -> slug da categoria
LINHA_TO_SLUG: dict[str, str] = {
    "1": "transmissao",
    "2": "abrasivos",
    "3": "ferramentas",
    "5": "maquinas",
    "6": "oxicorte",
    "7": "seguranca",
    "8": "solda-arame",
    "10": "pecas",
    "12": "quimicos",
    "14": "ferragens",
    "15": "fixacao",
    "16": "eletrica",
    "18": "seguranca",
    "19": "adesivos",
    "20": "solda-elet",
}


def slug_para_linha(codigo_linha: object) -> str | None:
    """Normaliza o codigo_linha vindo do DS e devolve o slug da categoria."""
    if codigo_linha is None:
        return None
    chave = str(codigo_linha).strip()
    # remove zeros à esquerda mantendo "0" -> "" tratado como None
    chave = chave.lstrip("0") or chave
    return LINHA_TO_SLUG.get(chave) or LINHA_TO_SLUG.get(str(codigo_linha).strip())
