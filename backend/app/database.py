from supabase import Client, create_client

from app.config import settings


def get_supabase_client() -> Client:
    supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not settings.SUPABASE_URL or not supabase_key:
        raise ValueError(
            "SUPABASE_URL dan salah satu dari SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY harus di-set di environment variables"
        )
    return create_client(settings.SUPABASE_URL, supabase_key)
