'use client'

import { usePathname } from 'next/navigation'

const RESERVED = new Set(['login', 'dashboard', 'superadmin', 'ops', 'support', 'track', 'onboarding', 'auth', 'api'])

function shouldShowHeader(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return false
  return RESERVED.has(parts[0])
}

export default function AppHeader() {
  const pathname = usePathname()
  if (!shouldShowHeader(pathname)) return null

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-lg font-semibold">Sewaro by Nanchu Hospitality</p>
        </div>
      </div>
    </header>
  )
}
