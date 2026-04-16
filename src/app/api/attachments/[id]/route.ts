import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: attachment } = await admin.from('attachments').select('*').eq('id', id).single()
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await admin.storage
    .from('attachments')
    .createSignedUrl(attachment.storage_path, 60)

  if (!data?.signedUrl) return NextResponse.json({ error: 'URL 생성 실패' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: attachment } = await admin.from('attachments').select('*').eq('id', id).single()
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.storage.from('attachments').remove([attachment.storage_path])
  await admin.from('attachments').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
