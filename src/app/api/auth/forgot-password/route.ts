import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const nums    = '23456789'
  const special = '!@#$%^&*'
  const all     = upper + lower + nums + special

  let pw = ''
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += lower[Math.floor(Math.random() * lower.length)]
  pw += nums[Math.floor(Math.random() * nums.length)]
  pw += special[Math.floor(Math.random() * special.length)]
  for (let i = 4; i < 10; i++) {
    pw += all[Math.floor(Math.random() * all.length)]
  }
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email: string = (body.email ?? '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: '이메일을 입력해 주세요.' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: '이메일 발송 서비스가 설정되지 않았습니다. 관리자에게 문의해 주세요.' },
        { status: 500 }
      )
    }

    const admin = createAdminClient()

    // 가입된 이메일 확인
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    // 보안: 이메일 존재 여부 노출 없이 성공 응답
    if (!profile) {
      return NextResponse.json({ ok: true })
    }

    const tempPassword = generateTempPassword()

    // Supabase Admin으로 비밀번호 강제 변경
    const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
      password: tempPassword,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    // Resend로 이메일 발송
    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

    const { error: mailError } = await resend.emails.send({
      from: `의료AI 사업관리시스템 <${fromEmail}>`,
      to: email,
      subject: '[의료AI 관리시스템] 임시 비밀번호 안내',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="font-size: 18px; font-weight: 700; color: #111; margin-bottom: 8px;">임시 비밀번호 안내</h2>
          <p style="color: #555; font-size: 14px; margin-bottom: 24px;">
            아래 임시 비밀번호로 로그인 후 반드시 비밀번호를 변경해 주세요.
          </p>
          <div style="background: #f4f4f5; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #666; margin: 0 0 8px;">임시 비밀번호</p>
            <p style="font-size: 24px; font-weight: 700; color: #1d4ed8; letter-spacing: 3px; margin: 0;">${tempPassword}</p>
          </div>
          <p style="font-size: 12px; color: #999;">
            본인이 요청하지 않은 경우 이 이메일을 무시하셔도 됩니다.<br />
            로그인 후 <strong>내 정보 &gt; 비밀번호 변경</strong>에서 새 비밀번호로 변경하세요.
          </p>
        </div>
      `,
    })

    if (mailError) {
      console.error('Email send error:', mailError)
      return NextResponse.json({ error: '이메일 발송 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
