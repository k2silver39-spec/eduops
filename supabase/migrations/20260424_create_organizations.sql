CREATE TABLE IF NOT EXISTS public.organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  is_active  boolean     NOT NULL DEFAULT true,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_active_sort_idx
  ON public.organizations (is_active, sort_order, name);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_public_select"
  ON public.organizations FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "organizations_admin_select_all"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "organizations_admin_write"
  ON public.organizations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE OR REPLACE FUNCTION public.set_organizations_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_set_updated_at ON public.organizations;
CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE PROCEDURE public.set_organizations_updated_at();

INSERT INTO public.organizations (name, is_active, sort_order)
SELECT DISTINCT organization, true, 0
FROM public.profiles
WHERE organization IS NOT NULL AND organization <> ''
ON CONFLICT (name) DO NOTHING;
