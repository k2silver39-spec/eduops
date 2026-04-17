import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReportForm from '../ReportForm'

export default async function NewReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('name, organization, agency_type, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') redirect('/auth/pending')

  return (
    <ReportForm
      mode="create"
      userProfile={{ name: profile.name, organization: profile.organization, agency_type: profile.agency_type ?? undefined }}
    />
  )
}
