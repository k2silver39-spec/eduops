'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  name: string
  email: string
  organization: string
  agency_type: string
}

export default function MyPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Name edit
  const [editName, setEditName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  // Organization edit
  const [editOrg, setEditOrg] = useState('')
  const [orgLoading, setOrgLoading] = useState(false)
  const [orgMsg, setOrgMsg] = useState('')

  // Agency type edit
  const [editAgencyType, setEditAgencyType] = useState('')
  const [agencyTypeLoading, setAgencyTypeLoading] = useState(false)
  const [agencyTypeMsg, setAgencyTypeMsg] = useState('')

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/auth/login')

      const { data } = await supabase
        .from('profiles')
        .select('name, email, organization, agency_type')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setEditName(data.name)
        setEditOrg(data.organization)
        setEditAgencyType(data.agency_type ?? '운영기관')
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleNameSave = async () => {
    if (!editName.trim()) return
    setNameLoading(true)
    setNameMsg('')

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })

    if (!res.ok) {
      setNameMsg('저장에 실패했습니다.')
    } else {
      setProfile(prev => prev ? { ...prev, name: editName.trim() } : prev)
      setNameMsg('저장되었습니다.')
    }
    setNameLoading(false)
    setTimeout(() => setNameMsg(''), 2500)
  }

  const handleOrgSave = async () => {
    if (!editOrg.trim()) return
    setOrgLoading(true)
    setOrgMsg('')

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization: editOrg.trim() }),
    })

    if (!res.ok) {
      setOrgMsg('저장에 실패했습니다.')
    } else {
      setProfile(prev => prev ? { ...prev, organization: editOrg.trim() } : prev)
      setOrgMsg('저장되었습니다.')
    }
    setOrgLoading(false)
    setTimeout(() => setOrgMsg(''), 2500)
  }

  const handleAgencyTypeSave = async () => {
    setAgencyTypeLoading(true)
    setAgencyTypeMsg('')

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agency_type: editAgencyType }),
    })

    if (!res.ok) {
      setAgencyTypeMsg('저장에 실패했습니다.')
    } else {
      setProfile(prev => prev ? { ...prev, agency_type: editAgencyType } : prev)
      setAgencyTypeMsg('저장되었습니다.')
    }
    setAgencyTypeLoading(false)
    setTimeout(() => setAgencyTypeMsg(''), 2500)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwMsg('')

    if (pwForm.next !== pwForm.confirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (pwForm.next.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setPwLoading(true)

    const res = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    })
    const data = await res.json()

    if (!res.ok) {
      setPwError(data.error === 'wrong_password' ? '현재 비밀번호가 올바르지 않습니다.' : '비밀번호 변경에 실패했습니다.')
    } else {
      setPwMsg('비밀번호가 변경되었습니다.')
      setPwForm({ current: '', next: '', confirm: '' })
    }
    setPwLoading(false)
    setTimeout(() => setPwMsg(''), 3000)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-gray-400">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">

      {/* Profile Info */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">프로필 정보</h2>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">이메일</p>
            <p className="text-sm text-gray-700">{profile?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">소속 기관</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={editOrg}
                onChange={(e) => setEditOrg(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                onClick={handleOrgSave}
                disabled={orgLoading || editOrg.trim() === profile?.organization}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition"
              >
                저장
              </button>
            </div>
            {orgMsg && <p className="text-xs text-blue-600 mt-1.5">{orgMsg}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">기관구분</p>
            <div className="flex gap-2">
              <select
                value={editAgencyType}
                onChange={(e) => setEditAgencyType(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                <option value="주관기관">주관기관</option>
                <option value="운영기관">운영기관</option>
                <option value="협력기관">협력기관</option>
              </select>
              <button
                onClick={handleAgencyTypeSave}
                disabled={agencyTypeLoading || editAgencyType === profile?.agency_type}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition"
              >
                저장
              </button>
            </div>
            {agencyTypeMsg && <p className="text-xs text-blue-600 mt-1.5">{agencyTypeMsg}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">이름</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                onClick={handleNameSave}
                disabled={nameLoading || editName.trim() === profile?.name}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition"
              >
                저장
              </button>
            </div>
            {nameMsg && (
              <p className="text-xs text-blue-600 mt-1.5">{nameMsg}</p>
            )}
          </div>
        </div>
      </section>

      {/* Password Change */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">비밀번호 변경</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">현재 비밀번호</label>
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">새 비밀번호</label>
            <input
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              required
              placeholder="6자 이상"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {pwError && <p className="text-xs text-red-600">{pwError}</p>}
          {pwMsg && <p className="text-xs text-blue-600">{pwMsg}</p>}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition"
          >
            {pwLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium py-2.5 rounded-xl text-sm transition"
      >
        로그아웃
      </button>
    </div>
  )
}
