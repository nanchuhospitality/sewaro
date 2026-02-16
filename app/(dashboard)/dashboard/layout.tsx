import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole()

  if (profile.role === 'SUPERADMIN') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-slate-600">You are a superadmin. Use superadmin panel.</p>
        <Link href="/superadmin" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
          Go to superadmin
        </Link>
      </main>
    )
  }

  if (profile.role === 'CENTRAL_OPS') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-slate-600">You are a Central Ops user. Use the ops panel.</p>
        <Link href="/ops/orders" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
          Go to Central Ops
        </Link>
      </main>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <nav className="space-y-2 text-sm">
          <Link href="/dashboard" className="block rounded px-2 py-1 hover:bg-slate-100">Overview</Link>
          <Link href="/dashboard/rooms" className="block rounded px-2 py-1 hover:bg-slate-100">Rooms & QR</Link>
          <Link href="/dashboard/menu" className="block rounded px-2 py-1 hover:bg-slate-100">Menu</Link>
          <Link href="/dashboard/feedback" className="block rounded px-2 py-1 hover:bg-slate-100">Feedback</Link>
          <Link href="/dashboard/settings" className="block rounded px-2 py-1 hover:bg-slate-100">Settings</Link>
        </nav>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </aside>
      <section>{children}</section>
    </div>
  )
}
