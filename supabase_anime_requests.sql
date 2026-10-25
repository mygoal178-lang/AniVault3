-- ==============================================================================
-- AniVault: Public Anime Request Queue
-- Run this in Supabase SQL Editor after deploying the app code.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.anime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  note TEXT,
  email TEXT,
  mal_id BIGINT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'imported', 'rejected', 'duplicate')),
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anime_requests_status ON public.anime_requests(status);
CREATE INDEX IF NOT EXISTS idx_anime_requests_created_at ON public.anime_requests(created_at DESC);

DROP TRIGGER IF EXISTS set_anime_requests_updated_at ON public.anime_requests;
CREATE TRIGGER set_anime_requests_updated_at
  BEFORE UPDATE ON public.anime_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.anime_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can submit a request
DROP POLICY IF EXISTS "Public Insert Anime Requests" ON public.anime_requests;
CREATE POLICY "Public Insert Anime Requests"
  ON public.anime_requests FOR INSERT
  TO public, anon, authenticated
  WITH CHECK (true);

-- Only admins can read / update / delete
DROP POLICY IF EXISTS "Admin Read Anime Requests" ON public.anime_requests;
CREATE POLICY "Admin Read Anime Requests"
  ON public.anime_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin Update Anime Requests" ON public.anime_requests;
CREATE POLICY "Admin Update Anime Requests"
  ON public.anime_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin Delete Anime Requests" ON public.anime_requests;
CREATE POLICY "Admin Delete Anime Requests"
  ON public.anime_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());
