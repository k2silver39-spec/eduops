-- ============================================================
-- 첨부파일 스키마 - Supabase SQL Editor에서 실행하세요.
-- 실행 전: Supabase Dashboard > Storage에서
--   버킷명 'attachments', Public: false 로 먼저 생성하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text        NOT NULL CHECK (entity_type IN ('inquiry', 'report')),
  entity_id    uuid        NOT NULL,
  filename     text        NOT NULL,
  storage_path text        NOT NULL,
  size         bigint      NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = '로그인 사용자 첨부파일 읽기') THEN
    CREATE POLICY "로그인 사용자 첨부파일 읽기"
      ON public.attachments FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = '로그인 사용자 첨부파일 삽입') THEN
    CREATE POLICY "로그인 사용자 첨부파일 삽입"
      ON public.attachments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attachments' AND policyname = '로그인 사용자 첨부파일 삭제') THEN
    CREATE POLICY "로그인 사용자 첨부파일 삭제"
      ON public.attachments FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
