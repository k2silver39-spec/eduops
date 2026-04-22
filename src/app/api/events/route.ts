import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, agency_type, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  // 해당 월 전체 범위 (전후 한 주씩 여유)
  const from = new Date(year, month - 1, 1)
  from.setDate(from.getDate() - 7)
  const to = new Date(year, month, 1)
  to.setDate(to.getDate() + 7)

  let query = admin
    .from('events')
    .select('*')
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .order('start_at', { ascending: true })

  if (profile.role !== 'super_admin') {
    // 본인 기관 일정 + 주관기관 공개 일정
    query = query.or(
      `organization.eq.${profile.organization},and(agency_type.eq.주관기관,is_public.eq.true)`
    )
  } else {
    // 관리자 기관 필터
    const org = searchParams.get('organization')
    if (org && org !== 'all') query = query.eq('organization', org)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, agency_type, status')
    .eq('id', user.id)
    .single()
  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, start_at, end_at, is_allday, color, is_public } = body

  if (!title?.trim() || !start_at || !end_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 주관기관이 아닌 사용자는 is_public 설정 불가
  const canPublish = profile.agency_type === '주관기관'

  const { data, error } = await admin
    .from('events')
    .insert({
      user_id:      user.id,
      organization: profile.organization,
      agency_type:  profile.agency_type,
      title:        title.trim(),
      description:  description?.trim() ?? '',
      start_at,
      end_at,
      is_allday:    is_allday ?? false,
      color:        color ?? 'blue',
      is_public:    canPublish ? (is_public ?? false) : false,
      source:       'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
