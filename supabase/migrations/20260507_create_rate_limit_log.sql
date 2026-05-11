CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_log_lookup_idx
  ON public.rate_limit_log (user_id, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS rate_limit_log_created_at_idx
  ON public.rate_limit_log (created_at);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '24 hours';
$$;
