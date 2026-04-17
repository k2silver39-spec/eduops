import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import ReportForm from '../../ReportForm'
import type { ReportType, WeeklyContent, MonthlyContent } from '../../report-types'

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default async function EditReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ resubmit?: string }>
}) {
  const { id } = await params
  const { resubmit } = await searchParams
  const isResubmit = resubmit === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const [{ data: report }, { data: profile }] = await Promise.all([
    admin.from('reports').select('*').eq('id', id).single(),
    admin.from('profiles').select('name, organization, agency_type').eq('id', user.id).single(),
  ])

  if (!report || !profile) notFound()
  if (report.user_id !== user.id) notFound()

  const allowedStatuses = isResubmit ? ['revision_approved'] : ['draft', 'submitted']
  if (!allowedStatuses.includes(report.status)) redirect(`/reports/${id}`)

  const type = report.type as ReportType
  let initialWeeklyDate: string | undefined
  let initialMonthlyYear: number | undefined
  let initialMonthlyMonth: number | undefined

  if (type === 'weekly') {
    initialWeeklyDate = toDateStr(getMondayOfWeek(new Date(report.period_start + 'T00:00:00')))
  } else {
    const d = new Date(report.period_start + 'T00:00:00')
    initialMonthlyYear = d.getFullYear()
    initialMonthlyMonth = d.getMonth() + 1
  }

  const content = report.content as WeeklyContent | MonthlyContent

  return (
    <ReportForm
      mode={isResubmit ? 'resubmit' : 'edit'}
      reportId={id}
      initialType={type}
      initialWeeklyDate={initialWeeklyDate}
      initialMonthlyYear={initialMonthlyYear}
      initialMonthlyMonth={initialMonthlyMonth}
      initialWeeklyContent={type === 'weekly' ? content as WeeklyContent : undefined}
      initialMonthlyContent={type === 'monthly' ? content as MonthlyContent : undefined}
      forceAllowSubmit={isResubmit}
      userProfile={{ name: profile.name, organization: profile.organization, agency_type: profile.agency_type ?? undefined }}
    />
  )
}
