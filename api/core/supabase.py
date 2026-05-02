from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .settings import get_settings


@lru_cache
def get_supabase() -> Client:
    """Cliente Supabase com service-role (bypassa RLS).

    Usado por toda a API serverless. Nunca exponha esta chave para o cliente.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
