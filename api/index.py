"""
Entrypoint Vercel — todo o `/api/*` é roteado para este arquivo
(via vercel.json: rewrites /api/:path* → /api/index.py).
A função `app` (FastAPI ASGI) é detectada automaticamente pelo @vercel/python.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import busca, frete, marcas_categorias, pedidos, produtos, sync_ds

app = FastAPI(
    title="Natalmaq API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Em produção mesmo origem (Next + API na Vercel) → CORS aberto não é problema.
# Em dev, `vercel dev` também serve tudo no mesmo host.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(produtos.router)
app.include_router(busca.router)
app.include_router(marcas_categorias.router)
app.include_router(frete.router)
app.include_router(pedidos.router)
app.include_router(sync_ds.router)
