-- =====================================================
-- 보고서 양식 v2 마이그레이션
-- 실행 순서: reports-schema.sql 이후 실행
-- =====================================================

-- ─────────────────────────────────────────────────
-- 1. 기존 주간 보고서 → v2 형식 마이그레이션
--    (version 필드가 없거나 2 미만인 레코드 대상)
-- ─────────────────────────────────────────────────
UPDATE reports
SET content = jsonb_build_object(
  'version', 2,
  'org_info', jsonb_build_object(
    'operator',           organization,
    'operator_name',      (SELECT name FROM profiles WHERE profiles.id = reports.user_id),
    'operator_position',  '실무담당자',
    'partner1',           '',
    'partner2',           ''
  ),
  'kpi_rows', jsonb_build_array(
    jsonb_build_object('target', '', 'actual', ''),
    jsonb_build_object('target', '', 'actual', ''),
    jsonb_build_object('target', '', 'actual', ''),
    jsonb_build_object('target', '', 'actual', ''),
    jsonb_build_object('target', '', 'actual', ''),
    jsonb_build_object('target', '', 'actual', '')
  ),
  'activity_rows', jsonb_build_array(
    jsonb_build_object(
      'current_week', COALESCE(content->>'completed', ''),
      'next_week',    COALESCE(content->>'next_plan', ''),
      'note',         ''
    ),
    jsonb_build_object('current_week', '', 'next_week', '', 'note', ''),
    jsonb_build_object(
      'current_week', COALESCE(content->>'issues', ''),
      'next_week',    '',
      'note',         ''
    )
  )
)
WHERE
  type = 'weekly'
  AND (
    content->>'version' IS NULL
    OR (content->>'version')::int < 2
  );

-- ─────────────────────────────────────────────────
-- 2. 기존 월간 보고서 → v2 형식 마이그레이션
-- ─────────────────────────────────────────────────
UPDATE reports
SET content = jsonb_build_object(
  'version', 2,
  'org_info', jsonb_build_object(
    'operator',           organization,
    'operator_name',      (SELECT name FROM profiles WHERE profiles.id = reports.user_id),
    'operator_position',  '사업책임자',
    'partner1',           '',
    'partner2',           ''
  ),
  'quantitative', jsonb_build_object('target', '', 'actual', ''),
  'qualitative',  jsonb_build_object(
    'target', COALESCE(content->>'achievements', ''),
    'actual',  ''
  ),
  'achievement_plan', COALESCE(content->>'next_month_plan', ''),
  'budget', jsonb_build_object(
    'operator_gov',  jsonb_build_object('budget', '', 'executed', ''),
    'operator_self', jsonb_build_object('budget', '', 'executed', ''),
    'partner1_gov',  jsonb_build_object('budget', '', 'executed', ''),
    'partner1_self', jsonb_build_object('budget', '', 'executed', '')
  ),
  'budget_plan', COALESCE(content->>'issues', '')
)
WHERE
  type = 'monthly'
  AND (
    content->>'version' IS NULL
    OR (content->>'version')::int < 2
  );

-- ─────────────────────────────────────────────────
-- 확인 쿼리 (실행 후 검증)
-- ─────────────────────────────────────────────────
-- SELECT type, count(*), min((content->>'version')::int) as min_ver
-- FROM reports
-- GROUP BY type;
