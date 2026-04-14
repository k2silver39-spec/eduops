-- ============================================================
-- 업무보고 시스템 - reports 테이블 스키마
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization    text        NOT NULL,
  type            text        NOT NULL CHECK (type IN ('weekly', 'monthly')),
  period_label    text        NOT NULL,
  period_start    date        NOT NULL,
  period_end      date        NOT NULL,
  content         jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'submitted', 'revision_requested', 'revision_approved')),
  revision_reason text,
  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 본인 보고서 읽기
CREATE POLICY "본인 보고서 읽기"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

-- 같은 기관 제출된 보고서 읽기 (submitted 이상)
CREATE POLICY "같은 기관 제출 보고서 읽기"
  ON public.reports FOR SELECT
  USING (
    status IN ('submitted', 'revision_requested', 'revision_approved')
    AND organization = (SELECT organization FROM public.profiles WHERE id = auth.uid())
  );

-- super_admin 전체 읽기
CREATE POLICY "super_admin 보고서 읽기"
  ON public.reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 본인 보고서 작성
CREATE POLICY "본인 보고서 작성"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 보고서 수정
CREATE POLICY "본인 보고서 수정"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);

-- super_admin 전체 수정
CREATE POLICY "super_admin 보고서 수정"
  ON public.reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
