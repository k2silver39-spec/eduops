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

export async function GET() {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data, error } = await admin
    .from('admin_notifications')
    .select('id, type, title, body, reference_id, is_read, created_at')
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count, error: countError } = await admin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

  return NextResponse.json({
    notifications: data ?? [],
    unreadCount: count ?? 0,
  })
}

export async function PATCH(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const body = await request.json().catch(() => ({}))
  const { id, all } = body as { id?: string; all?: boolean }

  if (all === true) {
    const { error } = await admin
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('is_read', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing id or all flag' }, { status: 400 })
  }

  const { error } = await admin
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
