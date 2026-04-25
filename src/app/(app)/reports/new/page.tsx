import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReportForm from '../ReportForm'

export default async function NewReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const [{ data: profile }, { data: existingReports }] = await Promise.all([
    admin
      .from('profiles')
      .select('organization, agency_type, status')
      .eq('id', user.id)
      .single(),
    admin
      .from('reports')
      .select('id, type, period_start')
      .eq('user_id', user.id),
  ])

  if (!profile || profile.status !== 'approved') redirect('/auth/pending')

  return (
    <ReportForm
      mode="create"
      userProfile={{ organization: profile.organization, agency_type: profile.agency_type ?? undefined }}
      existingReports={(existingReports ?? []) as { id: string; type: string; period_start: string }[]}
    />
  )
}
