CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id           bigserial   PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  model        text,
  input_chars  integer     NOT NULL DEFAULT 0,
  output_chars integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'success'
               CHECK (status IN ('success', 'error')),
  error_message text,
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_audit_log_user_idx
  ON public.ai_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_audit_log_endpoint_idx
  ON public.ai_audit_log (endpoint, created_at DESC);

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
