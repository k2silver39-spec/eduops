'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
      {ok ? (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      )}
      {label}
    </span>
  )
}

function PrivacyModal({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">개인정보 수집·이용 동의</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 text-sm text-gray-700 leading-relaxed space-y-4">
          <p>
            한국보건복지인재원은 의료AI 사업관리시스템 이용 및 서비스 제공을 위하여 아래와 같이
            개인정보를 수집·이용하고자 합니다. 내용을 자세히 읽으신 후 동의 여부를 결정하여 주십시오.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-2">
            <p className="font-semibold text-gray-800">○ 개인정보의 수집·이용에 관한 사항</p>
            <ul className="space-y-1 pl-2 text-gray-700">
              <li>- 수집항목: 이메일, 기관명</li>
              <li>- 수집목적: 회원가입 및 관리, 사업관리서비스 제공</li>
              <li>- 보유기간: 회원탈퇴시까지</li>
            </ul>
          </div>
          <p className="text-gray-500 text-xs">
            ※ 위의 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.
            그러나 동의를 거부할 경우, 회원가입 진행이 제한됩니다.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            닫기
          </button>
          <button onClick={onAgree} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
            동의합니다
          </button>
        </div>
      </div>
    </div>
  )
}

function checkPassword(pw: string) {
  return {
    length:  pw.length >= 8,
    upper:   /[a-zA-Z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
  }
}

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    organization: '',
    agency_type: '운영기관' as '운영기관' | '협력기관',
  })
  const [showPw, setShowPw]           = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [orgLoading, setOrgLoading] = useState(true)

  useEffect(() => {
    fetch('/api/organizations')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setOrgs(Array.isArray(data) ? data : []))
      .catch(() => setOrgs([]))
      .finally(() => setOrgLoading(false))
  }, [])

  const pwCheck = useMemo(() => checkPassword(formData.password), [formData.password])
  const pwAllOk = Object.values(pwCheck).every(Boolean)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!privacyAgreed) { setError('개인정보 수집·이용에 동의해주세요.'); return }
    if (!pwAllOk) { setError('비밀번호 조건을 모두 충족해주세요.'); return }
    if (formData.password !== formData.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }

    setLoading(true)
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: formData.email,
        organization: formData.organization,
        agency_type: formData.agency_type,
        role: 'user',
        status: 'pending',
        privacy_agreed: true,
        privacy_agreed_at: new Date().toISOString(),
      })

      if (profileError) {
        setError('프로필 저장 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      router.push('/auth/pending?new=true')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
            <p className="mt-2 text-sm text-gray-500">의료AI 사업관리시스템</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                id="email" name="email" type="email" required
                value={formData.email} onChange={handleChange}
                placeholder="example@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">소속 기관명</label>
              {orgLoading ? (
                <div className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-400 bg-gray-50 flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  기관 목록 불러오는 중...
                </div>
              ) : orgs.length === 0 ? (
                <div className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm text-amber-700 bg-amber-50">
                  등록된 기관이 없습니다. 관리자에게 문의하세요.
                </div>
              ) : (
                <select
                  id="organization" name="organization" required
                  value={formData.organization} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                >
                  <option value="">기관을 선택하세요</option>
                  {orgs.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="agency_type" className="block text-sm font-medium text-gray-700 mb-1">기관구분</label>
              <select
                id="agency_type" name="agency_type" required
                value={formData.agency_type} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                <option value="운영기관">운영기관</option>
                <option value="협력기관">협력기관</option>
              </select>
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <div className="relative">
                <input
                  id="password" name="password"
                  type={showPw ? 'text' : 'password'} required
                  value={formData.password} onChange={handleChange}
                  placeholder="8자 이상, 영문·숫자·특수문자 포함"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>

              {/* 비밀번호 조건 체크리스트 */}
              {formData.password.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 bg-gray-50 rounded-lg px-3 py-2">
                  <CheckItem ok={pwCheck.length}  label="8자 이상" />
                  <CheckItem ok={pwCheck.upper}   label="영문 포함" />
                  <CheckItem ok={pwCheck.number}  label="숫자 포함" />
                  <CheckItem ok={pwCheck.special} label="특수문자 포함" />
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
              <div className="relative">
                <input
                  id="passwordConfirm" name="passwordConfirm"
                  type={showPwConfirm ? 'text' : 'password'} required
                  value={formData.passwordConfirm} onChange={handleChange}
                  placeholder="비밀번호 재입력"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPwConfirm} />
                </button>
              </div>
              {formData.passwordConfirm.length > 0 && formData.password !== formData.passwordConfirm && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {/* 개인정보 동의 */}
            <div className={`border rounded-xl px-4 py-3 transition-colors ${privacyAgreed ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => {
                    setPrivacyAgreed(e.target.checked)
                    if (error === '개인정보 수집·이용에 동의해주세요.') setError('')
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-sm text-gray-700 leading-snug">
                  개인정보 수집·이용에 동의합니다.{' '}
                  <span className="text-red-500 font-medium">(필수)</span>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="ml-1.5 text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium"
                  >
                    [내용보기]
                  </button>
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pwAllOk}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg text-sm transition mt-2"
            >
              {loading ? '처리 중...' : '가입 신청'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>

      {showPrivacyModal && (
        <PrivacyModal
          onAgree={() => { setPrivacyAgreed(true); setShowPrivacyModal(false); if (error === '개인정보 수집·이용에 동의해주세요.') setError('') }}
          onClose={() => setShowPrivacyModal(false)}
        />
      )}
    </div>
  )
}
