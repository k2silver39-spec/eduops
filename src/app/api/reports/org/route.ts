import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/reports/org?year=2026&month=4
// 현재 사용자와 같은 기관의 주간보고 목록 반환 (월간보고 작성 시 참고용)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year  = parseInt(searchParams.get('year')  ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (!year || !month) {
    return NextResponse.json({ error: 'Missing params: year, month' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('organization')
    .eq('id', user.id)
    .single()

  if (!profile?.organization) return NextResponse.json([])

  // 해당 월에 속하는 주간보고 조회 (period_start 기준)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth  = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data } = await admin
    .from('reports')
    .select('id, period_label, period_start, status, content, author:profiles!user_id(id, email, organization)')
    .eq('organization', profile.organization)
    .eq('type', 'weekly')
    .gte('period_start', monthStart)
    .lt('period_start', nextMonth)
    .order('period_start', { ascending: true })

  return NextResponse.json(data ?? [])
}
