-- ────────────────────────────────────────────────────────────────────
-- 보고서 중복 제거 및 기관별 1보고서 제약 마이그레이션
-- 실행 순서: 이 파일을 Supabase SQL Editor 에서 전체 실행
-- ────────────────────────────────────────────────────────────────────

-- 1. 삭제 대상 보고서의 첨부파일 먼저 제거
--    (기관+유형 기준 최신 1건씩만 보존, 나머지 삭제)
DELETE FROM public.attachments
WHERE entity_type = 'report'
  AND entity_id NOT IN (
    SELECT DISTINCT ON (organization, type) id
    FROM public.reports
    ORDER BY organization, type, created_at DESC
  );

-- 2. 기관+유형 기준 최신 1건만 남기고 나머지 보고서 삭제
DELETE FROM public.reports
WHERE id NOT IN (
  SELECT DISTINCT ON (organization, type) id
  FROM public.reports
  ORDER BY organization, type, created_at DESC
);

-- 3. 기관+유형+기간 중복 방지 유니크 제약 추가
--    (이미 있다면 무시)
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_org_type_period_unique;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_org_type_period_unique
  UNIQUE (organization, type, period_start);
