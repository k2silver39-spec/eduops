import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReportList from './ReportList'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const [{ data: myReports }, { data: orgReports }] = await Promise.all([
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false }),
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, author:profiles!user_id(id, email, organization)')
      .eq('organization', profile.organization)
      .neq('user_id', user.id)
      .order('period_start', { ascending: false }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <ReportList
      myReports={(myReports ?? []) as any[]}
      orgReports={(orgReports ?? []) as any[]}
    />
  )
}
