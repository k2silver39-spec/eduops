'use client'

import { useCallback, useEffect, useState } from 'react'

interface Organization {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  member_count: number
  created_at: string
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/organizations')
    const data = await res.json()
    setOrgs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setActionLoading(true)
    setError('')
    const nextOrder = orgs.length > 0 ? (orgs[orgs.length - 1].sort_order + 10) : 10
    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), sort_order: nextOrder }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '등록 실패')
    } else {
      setShowAdd(false)
      setNewName('')
      await fetchOrgs()
    }
    setActionLoading(false)
  }

  const handleEditSave = async (id: string) => {
    if (!editName.trim()) return
    setActionLoading(true)
    setError('')
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '수정 실패')
    } else {
      setEditId(null)
      await fetchOrgs()
    }
    setActionLoading(false)
  }

  const handleToggle = async (o: Organization) => {
    await fetch(`/api/admin/organizations/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !o.is_active }),
    })
    await fetchOrgs()
  }

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = orgs[idx]
    const neighbor = orgs[idx + dir]
    if (!target || !neighbor) return
    await Promise.all([
      fetch(`/api/admin/organizations/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: neighbor.sort_order }),
      }),
      fetch(`/api/admin/organizations/${neighbor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: target.sort_order }),
      }),
    ])
    await fetchOrgs()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/organizations/${deleteTarget.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setDeleteError(data.error ?? '삭제 실패')
    } else {
      setDeleteTarget(null)
      await fetchOrgs()
    }
    setActionLoading(false)
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">기관 관리</h1>
        <button
          onClick={() => { setShowAdd(true); setError('') }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + 기관 추가
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-20 text-left px-4 py-3 text-xs font-semibold text-gray-500">순서</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관명</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">소속 사용자</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">등록된 기관이 없습니다.</td></tr>
            ) : orgs.map((o, idx) => (
              <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button disabled={idx === 0} onClick={() => handleMove(idx, -1)} className="p-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs">▲</button>
                    <button disabled={idx === orgs.length - 1} onClick={() => handleMove(idx, 1)} className="p-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs">▼</button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editId === o.id ? (
                    <div className="flex gap-2 items-center">
                      <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditSave(o.id) }} className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => handleEditSave(o.id)} disabled={actionLoading} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors">저장</button>
                      <button onClick={() => { setEditId(null); setError('') }} className="px-2 py-1 border border-gray-200 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">취소</button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-900">{o.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(o)} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${o.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {o.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.member_count}명</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1.5 justify-end">
                    {editId !== o.id && (
                      <button onClick={() => { setEditId(o.id); setEditName(o.name); setError('') }} className="px-2.5 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">수정</button>
                    )}
                    <button onClick={() => { setDeleteTarget(o); setDeleteError('') }} className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">기관 추가</h2>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} placeholder="기관명 입력" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setNewName(''); setError('') }} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleAdd} disabled={actionLoading || !newName.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm transition-colors">{actionLoading ? '추가 중...' : '추가'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-2">기관 삭제</h2>
            <p className="text-sm text-gray-600 mb-1"><span className="font-semibold text-gray-900">{deleteTarget.name}</span> 기관을 삭제하시겠습니까?</p>
            {deleteTarget.member_count > 0 && (
              <p className="text-xs text-amber-600 mb-2">소속 사용자가 {deleteTarget.member_count}명 있습니다. 삭제가 불가능할 수 있습니다.</p>
            )}
            {deleteError && <p className="text-sm text-red-600 mb-2">{deleteError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setDeleteTarget(null); setDeleteError('') }} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleDeleteConfirm} disabled={actionLoading} className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium py-2 rounded-lg text-sm transition-colors">{actionLoading ? '삭제 중...' : '삭제'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
