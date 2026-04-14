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
    .select('organization, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const category = searchParams.get('category') ?? 'all'
  const page = parseInt(searchParams.get('page') ?? '0')
  const pageSize = 20

  const isAdmin = profile.role === 'super_admin'

  let query = admin
    .from('inquiries')
    .select('id, title, category, is_public, status, organization, created_at, author:profiles!user_id(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  // 권한 필터: admin이 아닌 경우 본인 글 + 같은 기관 공개글만
  if (!isAdmin) {
    query = query.or(`user_id.eq.${user.id},and(is_public.eq.true,organization.eq.${profile.organization})`)
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  }
  if (status === 'open') {
    query = query.in('status', ['open', 'in_progress'])
  } else if (status === 'closed') {
    query = query.eq('status', 'closed')
  }
  if (category !== 'all') {
    query = query.eq('category', category)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inquiries: data ?? [], total: count ?? 0 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('organization, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  const body = await request.json()
  const { title, content, category, is_public } = body

  if (!title?.trim() || !content?.trim() || !category) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('inquiries')
    .insert({
      user_id: user.id,
      organization: profile.organization,
      title: title.trim(),
      content: content.trim(),
      category,
      is_public: is_public ?? true,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
