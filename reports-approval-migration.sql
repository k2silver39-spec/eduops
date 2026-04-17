-- ────────────────────────────────────────────────────────────────────
-- 보고서 승인 워크플로 마이그레이션
-- 실행: Supabase 대시보드 > SQL Editor 에서 전체 실행
-- ────────────────────────────────────────────────────────────────────

-- 1. 기존 status 제약 제거 (있는 경우)
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_status_check;

-- 2. 새 status 제약 추가
--    draft            : 임시저장
--    submitted        : 제출완료
--    approved         : 승인 (관리자)
--    revision_requested : 정정요청 (관리자 → 수행기관)
--    resubmitted      : 정정 재제출 (수행기관 → 관리자)
--    revision_approved  : (레거시) 구버전 호환
ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'approved',
    'revision_requested',
    'resubmitted',
    'revision_approved'
  ));

-- 3. 관리자 정정요청 코멘트 컬럼 추가
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS revision_comment text;

-- 4. 승인 일시 컬럼 추가
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
