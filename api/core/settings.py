from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = Field(default="", alias="SUPABASE_JWT_SECRET")
    loja_whatsapp: str = Field(default="", alias="NEXT_PUBLIC_LOJA_WHATSAPP")
    loja_nome: str = Field(default="Natalmaq", alias="NEXT_PUBLIC_LOJA_NOME")

    # ── Integração DS WEBSERVICE (Delphi) ──────────────────────────────
    ds_api_base: str = Field(
        default="http://delphi.serveftp.com:3579", alias="DS_API_BASE"
    )
    ds_api_email: str = Field(default="", alias="DS_API_EMAIL")
    ds_api_senha: str = Field(default="", alias="DS_API_SENHA")
    # Token compartilhado para proteger as rotas /api/sync/* (cron + manual).
    # Vercel Cron envia automaticamente "Authorization: Bearer <CRON_SECRET>".
    sync_secret: str = Field(default="", alias="SYNC_SECRET")
    cron_secret: str = Field(default="", alias="CRON_SECRET")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
