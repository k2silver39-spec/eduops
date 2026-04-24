-- ============================================================
-- notices 테이블
-- ============================================================
CREATE TABLE notices (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  content    text        NOT NULL,
  is_pinned  boolean     NOT NULL DEFAULT false,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notices_created_at_idx ON notices (created_at DESC);
CREATE INDEX notices_pinned_idx     ON notices (is_pinned, is_active);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- 읽기: 로그인한 사용자는 is_active=true 공지만 조회
CREATE POLICY "notices_select" ON notices
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND is_active = true
  );

-- super_admin 전체 CRUD (service_role / admin client 사용)
-- 앱 레벨에서 createAdminClient()로 RLS 우회하므로 별도 정책 불필요
