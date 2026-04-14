import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function getAuthContext(inquiryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: profile }, { data: inquiry }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('inquiries').select('user_id').eq('id', inquiryId).single(),
  ])

  return { user, profile, inquiry, admin }
}

// 문의 수정
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, inquiry, admin } = ctx
  const isAdmin = profile?.role === 'super_admin'
  const isOwner = inquiry?.user_id === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) updates.title = body.title
  if (body.content !== undefined) updates.content = body.content
  if (body.status !== undefined) updates.status = body.status

  const { data, error } = await admin
    .from('inquiries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 문의 삭제
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, inquiry, admin } = ctx
  const isAdmin = profile?.role === 'super_admin'
  const isOwner = inquiry?.user_id === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('inquiries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
