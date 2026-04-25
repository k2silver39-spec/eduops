import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { organization, agency_type } = body

  // 사용자는 운영기관/협력기관만 선택 가능. 주관기관은 관리자 승격 시 자동 설정
  const VALID_AGENCY_TYPES = ['운영기관', '협력기관']

  if (!organization?.trim() && !agency_type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (agency_type && !VALID_AGENCY_TYPES.includes(agency_type)) {
    return NextResponse.json({ error: 'Invalid agency_type' }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (organization?.trim()) updates.organization = organization.trim()
  if (agency_type) updates.agency_type = agency_type

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
