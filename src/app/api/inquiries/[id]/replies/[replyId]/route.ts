import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return null

  return { admin }
}

// 답변 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  const { replyId } = await params
  const ctx = await getAdminUser()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Missing content' }, { status: 400 })

  const { data, error } = await ctx.admin
    .from('inquiry_replies')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', replyId)
    .select('*, admin:profiles!admin_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 답변 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  const { replyId } = await params
  const ctx = await getAdminUser()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await ctx.admin.from('inquiry_replies').delete().eq('id', replyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
