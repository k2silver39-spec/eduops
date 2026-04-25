'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  organization: string
  agency_type: string
  role: string
  status: string
  created_at: string
}

const AGENCY_TYPE_BADGE: Record<string, string> = {
  '주관기관': 'bg-purple-100 text-purple-700',
  '운영기관': 'bg-blue-100 text-blue-700',
  '협력기관': 'bg-green-100 text-green-700',
}

type Tab = 'pending' | 'all'

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', approved: '승인', rejected: '거절',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
}

interface ConfirmState {
  userId: string
  action: 'approve' | 'reject' | 'role'
  label: string
  nextValue: string
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'pending')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [orgFilter, setOrgFilter] = useState('all')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsers = useCallback(async (t: Tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/users?tab=${t}`)
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers(tab) }, [tab, fetchUsers])

  const changeTab = (t: Tab) => {
    setTab(t)
    setOrgFilter('all')
    router.replace(`/admin/users?tab=${t}`)
  }

  const orgs = ['all', ...Array.from(new Set(users.map((u) => u.organization))).sort()]

  const filtered = tab === 'all' && orgFilter !== 'all'
    ? users.filter((u) => u.organization === orgFilter)
    : users

  const doAction = async () => {
    if (!confirm) return
    setActionLoading(true)
    const body: Record<string, string> = {}
    if (confirm.action === 'approve') body.status = 'approved'
    else if (confirm.action === 'reject') body.status = 'rejected'
    else body.role = confirm.nextValue

    await fetch(`/api/admin/users/${confirm.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setConfirm(null)
    setActionLoading(false)
    fetchUsers(tab)
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">사용자 관리</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-4">
        {([['pending', '승인 대기'], ['all', '전체 사용자']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => changeTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 기관 필터 (전체 탭에서만) */}
      {tab === 'all' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {orgs.map((org) => (
            <button
              key={org}
              onClick={() => setOrgFilter(org)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                orgFilter === org ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {org === 'all' ? '전체' : org}
            </button>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">소속 기관</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관구분</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">가입일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                {tab === 'all' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">역할</th>}
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={tab === 'all' ? 7 : 6} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={tab === 'all' ? 7 : 6} className="px-4 py-10 text-center text-sm text-gray-400">사용자가 없습니다.</td></tr>
              ) : filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{user.email}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{user.organization}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${AGENCY_TYPE_BADGE[user.agency_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {user.agency_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[user.status] ?? user.status}
                    </span>
                  </td>
                  {tab === 'all' && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium ${user.role === 'super_admin' ? 'text-purple-700' : 'text-gray-600'}`}>
                        {user.role === 'super_admin' ? '슈퍼관리자' : '일반사용자'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex gap-1.5 justify-end">
                      {user.status === 'pending' && (
                        <>
                          <button
                            onClick={() => setConfirm({ userId: user.id, action: 'approve', label: `${user.email}(${user.organization}) 계정을 승인하시겠습니까?`, nextValue: 'approved' })}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >승인</button>
                          <button
                            onClick={() => setConfirm({ userId: user.id, action: 'reject', label: `${user.email}(${user.organization}) 계정을 거절하시겠습니까?`, nextValue: 'rejected' })}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >거절</button>
                        </>
                      )}
                      {tab === 'all' && user.status === 'approved' && (
                        <button
                          onClick={() => setConfirm({
                            userId: user.id,
                            action: 'role',
                            label: user.role === 'super_admin'
                              ? `${user.email}(${user.organization}) 계정을 일반사용자로 변경하시겠습니까?`
                              : `${user.email}(${user.organization}) 계정을 슈퍼관리자로 변경하시겠습니까?`,
                            nextValue: user.role === 'super_admin' ? 'user' : 'super_admin',
                          })}
                          className="px-2.5 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {user.role === 'super_admin' ? '→ 일반' : '→ 관리자'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <p className="text-sm font-medium text-gray-900 mb-5">{confirm.label}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button
                onClick={doAction}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl text-sm"
              >
                {actionLoading ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
