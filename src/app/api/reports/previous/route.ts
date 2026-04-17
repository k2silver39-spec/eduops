import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/reports/previous?type=weekly&before=2026-04-14
// 현재 기간 이전에 제출된 가장 최근 보고서의 content 반환 (참고 표시용)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')   // 'weekly' | 'monthly'
  const before = searchParams.get('before') // ISO date (e.g. '2026-04-14')

  if (!type || !before) {
    return NextResponse.json({ error: 'Missing params: type, before' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('reports')
    .select('content, period_label')
    .eq('user_id', user.id)
    .eq('type', type)
    .eq('status', 'submitted')
    .lt('period_start', before)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return NextResponse.json(null)
  return NextResponse.json(data)
}
