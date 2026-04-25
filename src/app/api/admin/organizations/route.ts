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
  return { admin }
}

export async function GET() {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data: orgs, error } = await admin
    .from('organizations')
    .select('id, name, is_active, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: members } = await admin.from('profiles').select('organization')
  const counts = new Map<string, number>()
  for (const m of members ?? []) {
    if (!m.organization) continue
    counts.set(m.organization, (counts.get(m.organization) ?? 0) + 1)
  }

  return NextResponse.json(
    (orgs ?? []).map(o => ({ ...o, member_count: counts.get(o.name) ?? 0 }))
  )
}

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const body = await request.json().catch(() => ({}))
  const name: string = (body.name ?? '').trim()
  const sort_order: number = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0
  if (!name) return NextResponse.json({ error: '기관명을 입력해 주세요.' }, { status: 400 })

  const { data, error } = await admin
    .from('organizations')
    .insert({ name, sort_order, is_active: true })
    .select('id, name, is_active, sort_order, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 존재하는 기관명입니다.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
