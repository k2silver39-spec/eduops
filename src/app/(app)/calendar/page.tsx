import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CalendarView from './CalendarView'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, organization')
    .eq('id', user!.id)
    .single()

  let organizations: string[] = []
  if (profile?.role === 'super_admin') {
    const { data: orgs } = await admin
      .from('profiles')
      .select('organization')
      .eq('status', 'approved')
    if (orgs) {
      organizations = [...new Set(orgs.map((p: { organization: string }) => p.organization).filter(Boolean))]
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] md:h-screen">
        <p className="text-sm text-gray-500">프로필을 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] md:h-screen flex flex-col">
      <CalendarView
        profile={{
          id:           profile.id,
          role:         profile.role,
          organization: profile.organization ?? '',
        }}
        organizations={organizations}
      />
    </div>
  )
}
