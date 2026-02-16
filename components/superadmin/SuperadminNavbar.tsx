'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/auth/SignOutButton'

function linkClass(active: boolean) {
  return active
    ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white'
    : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
}

export default function SuperadminNavbar() {
  const pathname = usePathname()
  const isOverview = pathname === '/superadmin'
  const isMenuBuilder = pathname === '/superadmin/menu'
  const isNewBusiness = pathname === '/superadmin/businesses/new'
  const isOpsUsers = pathname === '/superadmin/ops'

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <nav className="flex items-center gap-1">
            <Link href="/superadmin" className={linkClass(isOverview)}>
              Businesses
            </Link>
            <Link href="/superadmin/menu" className={linkClass(isMenuBuilder)}>
              Nova Delivers Menu
            </Link>
            <Link href="/superadmin/businesses/new" className={linkClass(isNewBusiness)}>
              New business
            </Link>
            <Link href="/superadmin/ops" className={linkClass(isOpsUsers)}>
              Central Ops
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
