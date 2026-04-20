-- profiles 테이블에 개인정보 수집·이용 동의 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_agreed boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_agreed_at timestamptz;
