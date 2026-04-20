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
  const type = searchParams.get('type')   // 'weekly' | 'monthly' | null(전체)
  const before = searchParams.get('before') // ISO date (e.g. '2026-04-14')

  if (!before) {
    return NextResponse.json({ error: 'Missing param: before' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 같은 기관 소속이면 불러올 수 있도록 organization 기준으로 조회
  const { data: profile } = await admin
    .from('profiles')
    .select('organization')
    .eq('id', user.id)
    .single()

  if (!profile?.organization) return NextResponse.json(null)

  let query = admin
    .from('reports')
    .select('content, period_label')
    .eq('organization', profile.organization)
    .neq('status', 'draft')
    .lt('period_start', before)
    .order('period_start', { ascending: false })
    .limit(1)

  if (type) {
    query = query.eq('type', type)
  }

  const { data } = await query.maybeSingle()

  if (!data) return NextResponse.json(null)
  return NextResponse.json(data)
}
