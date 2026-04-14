import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import ReportForm from '../../ReportForm'
import type { WeeklyContent, MonthlyContent, ReportType } from '../../ReportForm'

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  const { data: report } = await admin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) notFound()

  // 본인 보고서만 수정 가능
  if (report.user_id !== user.id) notFound()

  // 상태에 따른 접근 제어
  const allowedStatuses = isResubmit
    ? ['revision_approved']
    : ['draft', 'submitted']

  if (!allowedStatuses.includes(report.status)) redirect(`/reports/${id}`)

  // 기간 파싱
  const type = report.type as ReportType
  let initialWeeklyDate: string | undefined
  let initialMonthlyYear: number | undefined
  let initialMonthlyMonth: number | undefined

  if (type === 'weekly') {
    const monday = getMondayOfWeek(new Date(report.period_start + 'T00:00:00'))
    initialWeeklyDate = toDateStr(monday)
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
    />
  )
}
