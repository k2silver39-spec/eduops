import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, organization } = body

  if (!name?.trim() && !organization?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (name?.trim()) updates.name = name.trim()
  if (organization?.trim()) updates.organization = organization.trim()

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
