"""Cliente da API DS WEBSERVICE (Delphi).

Fluxo: POST /api/usuarios/login (form-urlencoded) -> { jwt, empresas[] }.
As demais rotas exigem headers `token_empresa` + `Authorization: Bearer <jwt>`.
O JWT expira em 24h; como as funções serverless são stateless, fazemos login a
cada execução do sync (1 request extra, irrelevante).

IMPORTANTE: este servidor escuta numa porta alta (3579) que muitas redes
domésticas/corporativas bloqueiam na saída. A Vercel alcança normalmente.
"""
from __future__ import annotations

from typing import Any

import httpx

from .settings import get_settings


class DSAuthError(RuntimeError):
    pass


class DSClient:
    def __init__(self, base: str | None = None, timeout: float = 30.0) -> None:
        s = get_settings()
        self.base = (base or s.ds_api_base).rstrip("/")
        self.email = s.ds_api_email
        self.senha = s.ds_api_senha
        self._timeout = timeout
        self._jwt: str | None = None
        self._token_empresa: str | None = None
        self._empresa: dict[str, Any] | None = None

    # ── Autenticação ──────────────────────────────────────────────
    def login(self) -> dict[str, Any]:
        if not self.email or not self.senha:
            raise DSAuthError("DS_API_EMAIL / DS_API_SENHA não configurados")
        with httpx.Client(timeout=self._timeout) as c:
            r = c.post(
                f"{self.base}/api/usuarios/login",
                data={"email": self.email, "senha": self.senha},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise DSAuthError(f"login falhou: HTTP {r.status_code} — {r.text[:300]}")
        data = r.json()
        self._jwt = data.get("jwt")
        empresas = data.get("empresas") or []
        if not self._jwt:
            raise DSAuthError("login não retornou jwt")
        if empresas:
            self._empresa = empresas[0]
            self._token_empresa = (
                empresas[0].get("token_empresa")
                or empresas[0].get("token_integra")
            )
        if not self._token_empresa:
            raise DSAuthError("login não retornou token_empresa")
        return data

    def _ensure_auth(self) -> None:
        if not self._jwt or not self._token_empresa:
            self.login()

    @property
    def _headers(self) -> dict[str, str]:
        self._ensure_auth()
        return {
            "token_empresa": self._token_empresa or "",
            "Authorization": f"Bearer {self._jwt}",
        }

    # ── Rotas de dados ────────────────────────────────────────────
    def get_produtos(
        self,
        *,
        qreg: int = 200,
        page: int = 1,
        codigo_produto: str | None = None,
        data_hora_alt_inicio: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"qreg": qreg, "page": page}
        if codigo_produto:
            params["codigo_produto"] = codigo_produto
        if data_hora_alt_inicio:
            params["data_hora_alt_inicio"] = data_hora_alt_inicio
        return self._get_list("/api/produtos", params)

    def get_estoque(
        self,
        *,
        qreg: int = 200,
        page: int = 1,
        codigo_produto: str | None = None,
        data_hora_alt_inicio: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"qreg": qreg, "page": page}
        if codigo_produto:
            params["codigo_produto"] = codigo_produto
        if data_hora_alt_inicio:
            params["data_hora_alt_inicio"] = data_hora_alt_inicio
        return self._get_list("/api/estoque", params)

    def _get_list(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with httpx.Client(timeout=self._timeout) as c:
            r = c.get(f"{self.base}{path}", params=params, headers=self._headers)
        if r.status_code == 401:
            # token expirou no meio do batch — re-login e tenta 1x
            self.login()
            with httpx.Client(timeout=self._timeout) as c:
                r = c.get(f"{self.base}{path}", params=params, headers=self._headers)
        if r.status_code != 200:
            raise RuntimeError(f"{path} HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
        if isinstance(data, list):
            return data
        # algumas APIs envelopam em {data: [...]} ou {items: [...]}
        for key in ("data", "items", "result", "produtos", "estoque"):
            if isinstance(data, dict) and isinstance(data.get(key), list):
                return data[key]
        if isinstance(data, dict):
            return [data]
        return []


# ── Helpers de extração defensiva (nomes de campos podem variar) ──────────
def _first(d: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def extrair_codigo(row: dict[str, Any]) -> str | None:
    v = _first(row, "codigo_produto", "codigo", "cod_produto", "id_produto")
    return str(v).strip() if v is not None else None


def extrair_estoque_qtd(row: dict[str, Any]) -> float | None:
    v = _first(
        row,
        "estoque",
        "saldo",
        "saldo_estoque",
        "quantidade",
        "qtd",
        "qtde",
        "estoque_atual",
        "quantidade_atual",
    )
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None
