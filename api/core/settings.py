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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
