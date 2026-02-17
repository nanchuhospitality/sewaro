'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import SignOutButton from '@/components/auth/SignOutButton'

function linkClass(active: boolean) {
  return active
    ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white'
    : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
}

export default function SuperadminNavbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isOverview = pathname === '/superadmin'
  const isMenuPath = pathname === '/superadmin/menu'
  const menuProgram = (searchParams.get('program') || 'delivers').toLowerCase()
  const isMenuBuilderDelivers = isMenuPath && menuProgram !== 'mart'
  const isMenuBuilderMart = isMenuPath && menuProgram === 'mart'
  const isOpsUsers = pathname === '/superadmin/ops'

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <nav className="flex items-center gap-1">
            <Link href="/superadmin" className={linkClass(isOverview)}>
              Businesses
            </Link>
            <Link href="/superadmin/menu?program=delivers" className={linkClass(isMenuBuilderDelivers)}>
              Nova Delivers Menu
            </Link>
            <Link href="/superadmin/menu?program=mart" className={linkClass(isMenuBuilderMart)}>
              Nova Mart Menu
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
