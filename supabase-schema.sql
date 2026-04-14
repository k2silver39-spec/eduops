-- ============================================================
-- 교육운영 통합 관리 시스템 - Supabase SQL Schema
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- -------------------------------------------------------
-- 1. profiles 테이블 생성
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  name        text        NOT NULL,
  organization text       NOT NULL,
  role        text        NOT NULL DEFAULT 'user'
                          CHECK (role IN ('super_admin', 'user')),
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 2. RLS 활성화
-- -------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 3. RLS 정책
-- -------------------------------------------------------

-- 본인 프로필 읽기
CREATE POLICY "본인 프로필 읽기"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- super_admin 전체 프로필 읽기
CREATE POLICY "super_admin 전체 읽기"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 본인 프로필 수정 (role, status는 본인이 수정 불가 — super_admin만 가능)
CREATE POLICY "본인 프로필 수정"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

-- super_admin 전체 프로필 수정 (승인/거절 처리 등)
CREATE POLICY "super_admin 전체 수정"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 신규 프로필 삽입 (회원가입 시 본인만)
CREATE POLICY "프로필 생성"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- -------------------------------------------------------
-- 4. 신규 유저 자동 프로필 생성 트리거 (선택사항)
--    — 앱에서 직접 INSERT하는 경우 불필요하면 생략 가능
-- -------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, email, name, organization)
--   VALUES (
--     NEW.id,
--     NEW.email,
--     COALESCE(NEW.raw_user_meta_data->>'name', ''),
--     COALESCE(NEW.raw_user_meta_data->>'organization', '')
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE OR REPLACE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- -------------------------------------------------------
-- 5. 최초 super_admin 계정 설정 방법
--    아래 쿼리에서 이메일을 실제 값으로 바꿔 실행하세요.
-- -------------------------------------------------------
-- UPDATE public.profiles
-- SET role = 'super_admin', status = 'approved'
-- WHERE email = 'admin@example.com';
