import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendEmail,
  signupApprovedTemplate,
  inquiryReplyTemplate,
  reportRevisionTemplate,
  reportReminderTemplate,
} from './email'
import { sendPushNotification } from './push'

export type UserNotificationType =
  | 'signup_approved'
  | 'inquiry_reply'
  | 'report_revision'
  | 'report_reminder'

export type AdminNotificationType = 'new_inquiry' | 'new_report'

const SYSTEM_NAME = '의료AI 사업관리시스템'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function notifyUser(
  userId: string,
  type: UserNotificationType,
  title: string,
  body: string,
  referenceId?: string
): Promise<void> {
  const admin = createAdminClient()

  // 1) notifications 테이블 insert (실패해도 계속)
  const { error: insertError } = await admin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    reference_id: referenceId ?? null,
  })

  if (insertError) {
    console.error('[notify] notifications insert error:', insertError)
  }

  // 2) 사용자 이메일 조회
  const { data: userData, error: getUserError } =
    await admin.auth.admin.getUserById(userId)

  if (getUserError || !userData?.user?.email) {
    if (getUserError) {
      console.error('[notify] getUserById error:', getUserError)
    }
    return
  }

  const email = userData.user.email

  // 3) 타입별 템플릿 선택
  let template: { subject: string; html: string } | null = null

  if (type === 'signup_approved') {
    template = signupApprovedTemplate()
  } else if (type === 'inquiry_reply') {
    template = inquiryReplyTemplate({
      inquiryTitle: title,
      inquiryId: referenceId ?? '',
    })
  } else if (type === 'report_revision') {
    template = reportRevisionTemplate({
      reportLabel: title,
      revisionComment: body,
      reportId: referenceId ?? '',
    })
  } else if (type === 'report_reminder') {
    template = reportReminderTemplate({ periodLabel: body })
  }

  // 4) 이메일 발송
  if (template) {
    const result = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    })
    if (!result.ok) {
      console.error('[notify] sendEmail failed:', result.error)
    }
  }

  // 5) 푸시 알림 전송 (실패해도 계속)
  try {
    const url = referenceId
      ? type === 'inquiry_reply'
        ? `/inquiries/${referenceId}`
        : `/reports/${referenceId}`
      : type === 'report_reminder'
        ? '/reports'
        : '/'
    await sendPushNotification(userId, { title, body, url })
  } catch (err) {
    console.error('[notify] sendPushNotification failed:', err)
  }
}

export async function notifyAdmins(
  type: AdminNotificationType,
  title: string,
  body: string,
  referenceId?: string
): Promise<void> {
  const admin = createAdminClient()

  // 1) admin_notifications 테이블 insert
  const { error: insertError } = await admin.from('admin_notifications').insert({
    type,
    title,
    body,
    reference_id: referenceId ?? null,
  })

  if (insertError) {
    console.error('[notify] admin_notifications insert error:', insertError)
  }

  // 2) 관리자 수신 이메일 파싱
  const raw = process.env.ADMIN_NOTIFICATION_EMAIL ?? ''
  const toList = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (toList.length === 0) {
    console.warn('[notify] ADMIN_NOTIFICATION_EMAIL not configured. Skipping admin email.')
    return
  }

  // 3) 관리자용 단순 HTML
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px;">${escapeHtml(title)}</h2>
      <p style="font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(body)}</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
      <p style="font-size: 12px; color: #999; margin: 0;">
        본 메일은 ${escapeHtml(SYSTEM_NAME)} 관리자에게 자동 발송되었습니다.
      </p>
    </div>
  `

  // 4) sendEmail
  const result = await sendEmail({
    to: toList,
    subject: `[${SYSTEM_NAME}] ${title}`,
    html,
  })

  if (!result.ok) {
    console.error('[notify] admin sendEmail failed:', result.error)
  }
}
