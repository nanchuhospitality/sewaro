import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'SUPERADMIN' | 'BUSINESS_ADMIN' | 'CENTRAL_OPS'

export async function requireRole(role?: AppRole) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,business_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    redirect('/login')
  }

  if (role && profile.role !== role) {
    if (profile.role === 'SUPERADMIN') {
      redirect('/superadmin')
    }
    if (profile.role === 'CENTRAL_OPS') {
      redirect('/ops/orders')
    }
    redirect('/dashboard')
  }

  return { user, profile, supabase }
}
