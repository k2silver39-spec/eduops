'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function PrivacyModal({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">개인정보 수집·이용 동의</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 overflow-y-auto flex-1 text-sm text-gray-700 leading-relaxed space-y-4">
          <p>
            한국보건복지인재원은 의료AI 직무교육사업 관리시스템 이용 및 서비스 제공을 위하여 아래와 같이
            개인정보를 수집·이용하고자 합니다. 내용을 자세히 읽으신 후 동의 여부를 결정하여 주십시오.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-2">
            <p className="font-semibold text-gray-800">○ 개인정보의 수집·이용에 관한 사항</p>
            <ul className="space-y-1 pl-2 text-gray-700">
              <li>- 수집항목: 이메일, 성명, 기관명</li>
              <li>- 수집목적: 회원가입 및 관리, 사업관리서비스 제공</li>
              <li>- 보유기간: 회원탈퇴시까지</li>
            </ul>
          </div>

          <p className="text-gray-500 text-xs">
            ※ 위의 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.
            그러나 동의를 거부할 경우, 회원가입 진행이 제한됩니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onAgree}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            동의합니다
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    organization: '',
    agency_type: '운영기관' as '운영기관' | '협력기관',
  })
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!privacyAgreed) {
      setError('개인정보 수집·이용에 동의해주세요.')
      return
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (formData.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

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
        name: formData.name,
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
            <p className="mt-2 text-sm text-gray-500">의료AI 직무교육사업 관리시스템</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                id="name" name="name" type="text" required
                value={formData.name} onChange={handleChange}
                placeholder="홍길동"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

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
              <input
                id="organization" name="organization" type="text" required
                value={formData.organization} onChange={handleChange}
                placeholder="OO대학교 / OO기업"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                id="password" name="password" type="password" required
                value={formData.password} onChange={handleChange}
                placeholder="6자 이상"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
              <input
                id="passwordConfirm" name="passwordConfirm" type="password" required
                value={formData.passwordConfirm} onChange={handleChange}
                placeholder="비밀번호 재입력"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
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
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition mt-2"
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

      {/* 개인정보 동의 모달 */}
      {showPrivacyModal && (
        <PrivacyModal
          onAgree={() => { setPrivacyAgreed(true); setShowPrivacyModal(false); if (error === '개인정보 수집·이용에 동의해주세요.') setError('') }}
          onClose={() => setShowPrivacyModal(false)}
        />
      )}
    </div>
  )
}
