import { createClient } from '@supabase/supabase-js'

// RLS를 우회하는 서버 전용 admin 클라이언트 (서버 컴포넌트/미들웨어에서만 사용)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
