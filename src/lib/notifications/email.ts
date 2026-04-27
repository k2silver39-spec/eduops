import { Resend } from 'resend'

const SYSTEM_NAME = '의료AI 사업관리시스템'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appUrl(path: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) return undefined
  const trimmedBase = base.replace(/\/+$/, '')
  const trimmedPath = path.startsWith('/') ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

function shell(args: {
  heading: string
  bodyHtml: string
  ctaUrl?: string
  ctaLabel?: string
}): string {
  const { heading, bodyHtml, ctaUrl, ctaLabel } = args
  const cta =
    ctaUrl && ctaLabel
      ? `
        <div style="margin-top: 24px; text-align: center;">
          <a href="${ctaUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">${escapeHtml(ctaLabel)}</a>
        </div>
      `
      : ''

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px;">${escapeHtml(heading)}</h2>
      <div style="font-size: 14px; color: #333; line-height: 1.6;">
        ${bodyHtml}
      </div>
      ${cta}
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
      <p style="font-size: 12px; color: #999; margin: 0;">
        본 메일은 ${escapeHtml(SYSTEM_NAME)}에서 자동 발송되었습니다.
      </p>
    </div>
  `
}

export async function sendEmail(args: {
  to: string | string[]
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const { to, subject, html } = args

  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY is not configured. Skipping send.')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

    const { error } = await resend.emails.send({
      from: `${SYSTEM_NAME} <${fromEmail}>`,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[email] send error:', error)
      return { ok: false, error: typeof error === 'string' ? error : JSON.stringify(error) }
    }

    return { ok: true }
  } catch (err) {
    console.error('[email] send exception:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'unknown error' }
  }
}

export function signupApprovedTemplate(): { subject: string; html: string } {
  const subject = `[${SYSTEM_NAME}] 가입이 승인되었습니다`
  const ctaUrl = appUrl('/')
  const html = shell({
    heading: '가입이 승인되었습니다',
    bodyHtml: `
      <p>${escapeHtml(SYSTEM_NAME)} 가입이 승인되었습니다.</p>
      <p>이제 로그인하여 모든 기능을 이용하실 수 있습니다.</p>
    `,
    ctaUrl,
    ctaLabel: ctaUrl ? '시스템 바로가기' : undefined,
  })
  return { subject, html }
}

export function inquiryReplyTemplate(args: {
  inquiryTitle: string
  inquiryId: string
}): { subject: string; html: string } {
  const { inquiryTitle, inquiryId } = args
  const subject = `[${SYSTEM_NAME}] 문의에 답변이 등록되었습니다`
  const ctaUrl = appUrl(`/inquiries/${inquiryId}`)
  const html = shell({
    heading: '문의에 답변이 등록되었습니다',
    bodyHtml: `
      <p>아래 문의에 새 답변이 등록되었습니다.</p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600;">${escapeHtml(inquiryTitle)}</p>
      </div>
      <p>아래 버튼을 눌러 답변을 확인해 주세요.</p>
    `,
    ctaUrl,
    ctaLabel: ctaUrl ? '문의 답변 확인' : undefined,
  })
  return { subject, html }
}

export function reportRevisionTemplate(args: {
  reportLabel: string
  revisionComment: string
  reportId: string
}): { subject: string; html: string } {
  const { reportLabel, revisionComment, reportId } = args
  const subject = `[${SYSTEM_NAME}] 보고 정정 요청`
  const ctaUrl = appUrl(`/reports/${reportId}`)
  const escapedComment = escapeHtml(revisionComment).replace(/\r?\n/g, '<br />')
  const html = shell({
    heading: '보고 정정 요청',
    bodyHtml: `
      <p>관리자가 아래 보고에 대한 정정을 요청했습니다.</p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600;">${escapeHtml(reportLabel)}</p>
        <p style="margin: 0; color: #555; font-size: 13px;">${escapedComment}</p>
      </div>
      <p>아래 버튼을 눌러 보고를 수정해 주세요.</p>
    `,
    ctaUrl,
    ctaLabel: ctaUrl ? '보고 수정하기' : undefined,
  })
  return { subject, html }
}

export function reportReminderTemplate(args: {
  periodLabel: string
}): { subject: string; html: string } {
  const { periodLabel } = args
  const subject = `[${SYSTEM_NAME}] 보고 작성 안내`
  const ctaUrl = appUrl('/reports')
  const html = shell({
    heading: '보고 작성 안내',
    bodyHtml: `
      <p>${escapeHtml(periodLabel)} 보고 작성 기간입니다.</p>
      <p>아직 보고를 작성하지 않으셨다면, 아래 버튼을 눌러 작성을 진행해 주세요.</p>
    `,
    ctaUrl,
    ctaLabel: ctaUrl ? '보고 작성하기' : undefined,
  })
  return { subject, html }
}
