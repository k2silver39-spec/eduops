-- ============================================================
-- events 테이블
-- ============================================================
CREATE TABLE events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization text        NOT NULL DEFAULT '',
  agency_type  text,
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  start_at     timestamptz NOT NULL,
  end_at       timestamptz NOT NULL,
  is_allday    boolean     NOT NULL DEFAULT false,
  color        text        NOT NULL DEFAULT 'blue'
               CHECK (color IN ('blue','green','red','orange','purple','gray')),
  source       text        NOT NULL DEFAULT 'manual'
               CHECK (source IN ('manual','document','report')),
  source_id    uuid,
  is_public    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 날짜 범위 조회 성능 인덱스
CREATE INDEX events_start_at_idx ON events (start_at);
CREATE INDEX events_org_idx      ON events (organization);
CREATE INDEX events_source_idx   ON events (source, source_id);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 읽기: 본인 기관 일정 OR 주관기관 공개 일정
CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    organization = (
      SELECT organization FROM profiles WHERE id = auth.uid()
    )
    OR (
      agency_type = '주관기관' AND is_public = true
    )
  );

-- 삽입: 로그인 사용자, user_id = 본인
CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- 수정: 본인 작성 일정만
CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- 삭제: 본인 작성 일정만
CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    auth.uid() = user_id
  );

-- super_admin 전체 권한 (service_role key 사용 시 RLS 우회되므로
-- 앱 레벨에서 admin client 사용하는 것과 동일 효과)

-- ============================================================
-- Storage 버킷: calendar-imports (임시 업로드용, private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('calendar-imports', 'calendar-imports', false)
ON CONFLICT DO NOTHING;
