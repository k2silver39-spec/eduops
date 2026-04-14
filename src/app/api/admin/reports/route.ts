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
  const status       = searchParams.get('status') ?? 'all'
  const type         = searchParams.get('type') ?? 'all'
  const organization = searchParams.get('organization') ?? 'all'

  let query = admin
    .from('reports')
    .select('id, type, period_label, period_start, period_end, status, revision_reason, submitted_at, created_at, organization, author:profiles!user_id(name, id)')
    .order('created_at', { ascending: false })

  if (status !== 'all')       query = query.eq('status', status)
  if (type !== 'all')         query = query.eq('type', type)
  if (organization !== 'all') query = query.eq('organization', organization)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
