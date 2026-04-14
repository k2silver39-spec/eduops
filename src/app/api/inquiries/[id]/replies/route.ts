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

  return { user, admin }
}

// 답변 등록
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAdminUser()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user, admin } = ctx
  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Missing content' }, { status: 400 })

  const { data, error } = await admin
    .from('inquiry_replies')
    .insert({ inquiry_id: id, admin_id: user.id, content: content.trim() })
    .select('*, admin:profiles!admin_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
