-- push_subscriptions 테이블이 없으면 생성
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

-- RLS 활성화
alter table push_subscriptions enable row level security;

-- 기존 정책 제거 후 재생성 (테이블이 이미 있을 때를 위해)
drop policy if exists "users manage own push subscriptions" on push_subscriptions;

-- 서비스 롤(admin client)만 사용하므로 RLS 정책은 참고용
-- API 라우트가 admin 클라이언트를 사용해 RLS를 우회하므로 별도 정책 불필요
-- 하지만 직접 접근 차단을 위해 기본 deny 상태 유지 (정책 없음 = 모두 거부)
