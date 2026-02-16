'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function friendlyError(message: string) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Invalid email or password.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first.'
  return message
}

function LoginPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(params.get('error'))
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      setError(friendlyError(signInError.message))
      setLoading(false)
      return
    }

    await fetch('/api/auth/bootstrap-profile', { method: 'POST' })
    let destination = '/dashboard'
    const userId = signInData.user?.id
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle()
      if (profile?.role === 'SUPERADMIN') destination = '/superadmin'
      if (profile?.role === 'CENTRAL_OPS') destination = '/ops/orders'
    }
    router.replace(destination)
    router.refresh()
  }

  return (
    <main className="mx-auto flex max-w-md px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to continue</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div className="relative">
            <label className="mb-1 block text-sm">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-16 text-sm outline-none focus:border-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-[34px] text-xs text-slate-600"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-lg border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">By continuing, you agree to Terms and Privacy.</p>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md px-4 py-10">
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-600">Loading sign in...</p>
          </section>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
