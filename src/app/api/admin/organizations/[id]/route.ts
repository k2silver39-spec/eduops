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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const { data: current } = await admin.from('organizations').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (typeof body.name === 'string') updates.name = body.name.trim()
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order

  const { data, error } = await admin
    .from('organizations').update(updates).eq('id', id)
    .select('id, name, is_active, sort_order').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 존재하는 기관명입니다.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (typeof updates.name === 'string' && updates.name !== current.name) {
    await admin.from('profiles').update({ organization: updates.name }).eq('organization', current.name)
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx
  const { id } = await params

  const { data: current } = await admin.from('organizations').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization', current.name)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `소속 사용자가 ${count}명 있어 삭제할 수 없습니다.`, member_count: count },
      { status: 409 }
    )
  }

  const { error } = await admin.from('organizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
