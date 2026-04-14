import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Nav from '@/components/layout/Nav'
import MobileHeader from '@/components/layout/MobileHeader'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('name, organization, role, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status === 'pending') redirect('/auth/pending')
  if (profile.status === 'rejected') redirect('/auth/rejected')

  const userProfile = {
    name: profile.name as string,
    organization: profile.organization as string,
    role: profile.role as string,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav profile={userProfile} />
      <MobileHeader />

      <div className="md:pl-60">
        <main className="pt-14 mobile-content-pb md:pt-0 md:pb-0 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
