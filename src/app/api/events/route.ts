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

  let from: Date
  let to: Date

  const startParam = searchParams.get('start')
  const endParam   = searchParams.get('end')

  if (startParam && endParam) {
    from = new Date(`${startParam}T00:00:00.000Z`)
    to   = new Date(`${endParam}T23:59:59.999Z`)
  } else {
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    from = new Date(year, month - 1, 1)
    from.setDate(from.getDate() - 7)
    to = new Date(year, month, 1)
    to.setDate(to.getDate() + 7)
  }

  if (profile.role !== 'super_admin') {
    // Two separate queries to avoid PostgREST string-parse issues with Korean org names
    const [ownRes, publicRes] = await Promise.all([
      admin.from('events')
        .select('*')
        .eq('organization', profile.organization)
        .gte('start_at', from.toISOString())
        .lte('start_at', to.toISOString()),
      admin.from('events')
        .select('*')
        .eq('agency_type', '주관기관')
        .eq('is_public', true)
        .gte('start_at', from.toISOString())
        .lte('start_at', to.toISOString()),
    ])

    if (ownRes.error) return NextResponse.json({ error: ownRes.error.message }, { status: 500 })

    const merged = [...(ownRes.data ?? []), ...(publicRes.data ?? [])]
      .filter((e, i, arr) => arr.findIndex((x: { id: string }) => x.id === e.id) === i)
      .sort((a: { start_at: string }, b: { start_at: string }) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      )

    return NextResponse.json(merged)
  }

  // 관리자
  let query = admin
    .from('events')
    .select('*')
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .order('start_at', { ascending: true })

  const org = searchParams.get('organization')
  if (org && org !== 'all') query = query.eq('organization', org)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('group_id')
  const title   = searchParams.get('title')
  if (!groupId && !title) return NextResponse.json({ error: 'group_id or title required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (groupId) {
    let query = admin.from('events').delete().eq('repeat_group_id', groupId)
    if (profile?.role !== 'super_admin') query = query.eq('user_id', user.id)
    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // 제목 기반 삭제: 본인 소유 이벤트에 한정
    const { error } = await admin.from('events').delete()
      .eq('title', title!)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
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
  const { title, description, start_at, end_at, is_allday, color, is_public, repeat_group_id } = body

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
      ...(repeat_group_id ? { repeat_group_id } : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
