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
  const tab = searchParams.get('tab') ?? 'all'

  let query = admin
    .from('profiles')
    .select('id, name, email, organization, role, status, created_at')
    .order('created_at', { ascending: false })

  if (tab === 'pending') query = query.eq('status', 'pending')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
