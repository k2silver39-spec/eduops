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
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const org   = searchParams.get('organization') ?? 'all'

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

  if (org !== 'all') query = query.eq('organization', org)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
