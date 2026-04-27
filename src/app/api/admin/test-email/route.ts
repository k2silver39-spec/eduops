import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET() {
  // 관리자 인증
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 환경변수 진단
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const diagnosis = {
    env: {
      RESEND_API_KEY: apiKey ? `set (${apiKey.slice(0, 8)}...)` : 'MISSING',
      RESEND_FROM_EMAIL: fromEmail || 'MISSING (fallback: onboarding@resend.dev)',
      ADMIN_NOTIFICATION_EMAIL: adminEmail || 'MISSING',
      NEXT_PUBLIC_APP_URL: appUrl || 'MISSING',
    },
    sendResult: null as unknown,
  }

  if (!apiKey) {
    return NextResponse.json({ ...diagnosis, error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  // 실제 발송 테스트
  try {
    const resend = new Resend(apiKey)
    const toEmail = adminEmail || user.email!
    const { data, error } = await resend.emails.send({
      from: `테스트 <${fromEmail ?? 'onboarding@resend.dev'}>`,
      to: toEmail,
      subject: '[진단] eduops 이메일 발송 테스트',
      html: `
        <div style="font-family: sans-serif; padding: 24px;">
          <h2>이메일 발송 테스트</h2>
          <p>이 메일이 수신되었다면 Resend 연동이 정상입니다.</p>
          <p>발신: ${fromEmail ?? 'onboarding@resend.dev'}</p>
          <p>수신: ${toEmail}</p>
          <p>시각: ${new Date().toISOString()}</p>
        </div>
      `,
    })

    diagnosis.sendResult = error
      ? { ok: false, error }
      : { ok: true, id: data?.id, to: toEmail }

    return NextResponse.json(diagnosis)
  } catch (err) {
    diagnosis.sendResult = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
    return NextResponse.json(diagnosis, { status: 500 })
  }
}
