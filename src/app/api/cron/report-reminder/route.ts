import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notifications/notify'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 이번 주 월요일 날짜 계산 (UTC 기준)
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon, ..., 4=Thu
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday)
  monday.setUTCHours(0, 0, 0, 0)

  const weekStart = monday.toISOString().split('T')[0]

  const year = monday.getUTCFullYear()
  const month = monday.getUTCMonth() + 1
  const weekOfMonth = Math.ceil(monday.getUTCDate() / 7)
  const periodLabel = `${year}년 ${String(month).padStart(2, '0')}월 ${weekOfMonth}주차`

  // 승인된 사용자 전체 조회
  const { data: approvedUsers, error: usersError } = await admin
    .from('profiles')
    .select('id')
    .eq('status', 'approved')

  if (usersError) {
    console.error('[cron] fetch approved users error:', usersError)
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  if (!approvedUsers || approvedUsers.length === 0) {
    return NextResponse.json({ sent: 0, total: 0, unsubmitted: 0 })
  }

  // 이번 주 주간보고 제출 완료 사용자 조회 (draft 제외)
  const { data: submittedReports } = await admin
    .from('reports')
    .select('user_id')
    .eq('type', 'weekly')
    .eq('period_start', weekStart)
    .in('status', ['submitted', 'revision_requested', 'approved'])

  const submittedUserIds = new Set(
    (submittedReports ?? []).map((r: { user_id: string }) => r.user_id)
  )

  // 미제출 사용자 필터링
  const unsubmittedUsers = approvedUsers.filter(
    (u: { id: string }) => !submittedUserIds.has(u.id)
  )

  let sent = 0
  for (const user of unsubmittedUsers) {
    try {
      await notifyUser(
        user.id,
        'report_reminder',
        '주간보고 작성 안내',
        periodLabel
      )
      sent++
    } catch (err) {
      console.error('[cron] notifyUser failed for', user.id, err)
    }
  }

  return NextResponse.json({
    sent,
    total: approvedUsers.length,
    unsubmitted: unsubmittedUsers.length,
    weekStart,
    periodLabel,
  })
}
