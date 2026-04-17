import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function getAuthContext(reportId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: profile }, { data: report }] = await Promise.all([
    admin.from('profiles').select('role, organization').eq('id', user.id).single(),
    admin.from('reports').select('*, author:profiles!user_id(name)').eq('id', reportId).single(),
  ])

  return { user, profile, report, admin }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, report } = ctx
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = report.user_id === user.id
  const isSameOrg = profile?.organization === report.organization
  const isSubmitted = ['submitted', 'approved', 'revision_requested', 'resubmitted', 'revision_approved'].includes(report.status)

  if (!isAdmin && !isOwner && !(isSameOrg && isSubmitted)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(report)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, report, admin } = ctx
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = report.user_id === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.content !== undefined) updates.content = body.content
  if (body.revision_reason !== undefined) updates.revision_reason = body.revision_reason

  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'submitted' || body.status === 'resubmitted') {
      updates.submitted_at = new Date().toISOString()
    }
  }

  const { data, error } = await admin
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select('*, author:profiles!user_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
