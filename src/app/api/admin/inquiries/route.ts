import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { searchParams } = new URL(request.url)
  const search       = searchParams.get('search') ?? ''
  const status       = searchParams.get('status') ?? 'all'
  const category     = searchParams.get('category') ?? 'all'
  const organization = searchParams.get('organization') ?? 'all'
  const sort         = searchParams.get('sort') ?? 'date'
  const page         = parseInt(searchParams.get('page') ?? '0')
  const pageSize     = 20

  let query = admin
    .from('inquiries')
    .select('id, title, category, is_public, status, organization, created_at, author:profiles!user_id(id, email, organization)', { count: 'exact' })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (sort === 'open') {
    query = query.order('status', { ascending: true }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (search)              query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  if (status === 'open')   query = query.in('status', ['open', 'in_progress'])
  else if (status === 'closed') query = query.eq('status', 'closed')
  if (category !== 'all')      query = query.eq('category', category)
  if (organization !== 'all')  query = query.eq('organization', organization)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inquiries: data ?? [], total: count ?? 0 })
}
