import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createRawClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('email, organization, role')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { organization } = body

  if (!organization?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ organization: organization.trim() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { password } = body as { password?: string }
  if (!password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const verifyClient = createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: user.email!,
    password,
  })
  if (signInError) {
    return NextResponse.json({ error: 'wrong_password' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role === 'super_admin') {
    return NextResponse.json({ error: 'admin_cannot_withdraw' }, { status: 403 })
  }

  const [{ data: userReports }, { data: userInquiries }] = await Promise.all([
    admin.from('reports').select('id').eq('user_id', user.id),
    admin.from('inquiries').select('id').eq('user_id', user.id),
  ])
  const reportIds: string[] = (userReports ?? []).map((r: { id: string }) => r.id)
  const inquiryIds: string[] = (userInquiries ?? []).map((r: { id: string }) => r.id)

  const collectAndDelete = async (entityType: 'report' | 'inquiry', ids: string[]) => {
    if (ids.length === 0) return
    const { data: atts } = await admin
      .from('attachments')
      .select('storage_path')
      .eq('entity_type', entityType)
      .in('entity_id', ids)
    const paths = (atts ?? []).map((a: { storage_path: string }) => a.storage_path).filter(Boolean)
    if (paths.length > 0) {
      try { await admin.storage.from('attachments').remove(paths) } catch { /* best-effort */ }
    }
    await admin.from('attachments').delete().eq('entity_type', entityType).in('entity_id', ids)
  }

  await collectAndDelete('report', reportIds)
  await collectAndDelete('inquiry', inquiryIds)

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  try { await supabase.auth.signOut() } catch { /* ignore */ }
  return NextResponse.json({ success: true })
}
