import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function CentralOpsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('CENTRAL_OPS')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-1">
            <Link href="/ops/orders" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
              Orders
            </Link>
            <Link href="/ops/support" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Support
            </Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <div>{children}</div>
    </div>
  )
}
