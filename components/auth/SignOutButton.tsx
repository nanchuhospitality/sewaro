'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSignOut = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      onClick={onSignOut}
      disabled={loading}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
