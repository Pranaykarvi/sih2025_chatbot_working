
from supabase import create_client
from app.config import SUPABASE_URL, SUPABASE_KEY

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase credentials missing")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

