-- =====================================================
-- 기관구분(agency_type) 컬럼 추가 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- 1. profiles 테이블에 agency_type 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_type text
    NOT NULL DEFAULT '운영기관'
    CHECK (agency_type IN ('주관기관', '운영기관', '협력기관'));

-- 2. 기존 데이터 기본값 설정 (이미 DEFAULT로 처리되지만 명시적으로)
-- UPDATE public.profiles SET agency_type = '운영기관' WHERE agency_type IS NULL;

-- 3. 확인 쿼리
-- SELECT agency_type, count(*) FROM profiles GROUP BY agency_type;
