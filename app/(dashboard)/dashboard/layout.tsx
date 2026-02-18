import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requireRole()

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

  let business: { name: string; slug: string; enable_nova_delivers_menu: boolean; enable_nova_mart_menu: boolean } | null = null
  if (profile.business_id) {
    const withNovaFlag = await supabase
      .from('businesses')
      .select('name,slug,enable_nova_delivers_menu,enable_nova_mart_menu')
      .eq('id', profile.business_id)
      .maybeSingle()

    const schemaError = withNovaFlag.error?.message?.toLowerCase() || ''
    if (withNovaFlag.data) {
      business = withNovaFlag.data
    } else if (
      withNovaFlag.error &&
      (schemaError.includes('enable_nova_delivers_menu') || schemaError.includes('enable_nova_mart_menu'))
    ) {
      const fallback = await supabase.from('businesses').select('name,slug').eq('id', profile.business_id).maybeSingle()
      if (fallback.data) {
        business = { ...fallback.data, enable_nova_delivers_menu: false, enable_nova_mart_menu: false }
      }
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 border-b border-slate-200 pb-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Hotel</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{business?.name || 'No hotel linked'}</p>
        </div>
        <nav className="space-y-2 text-sm">
          <Link href="/dashboard" className="block rounded px-2 py-1 hover:bg-slate-100">Overview</Link>
          <Link href="/dashboard/rooms" className="block rounded px-2 py-1 hover:bg-slate-100">Rooms & QR</Link>
          <Link href="/dashboard/menu" className="block rounded px-2 py-1 hover:bg-slate-100">Menu</Link>
          <Link href="/dashboard/feedback" className="block rounded px-2 py-1 hover:bg-slate-100">Feedback</Link>
          <Link href="/dashboard/settings" className="block rounded px-2 py-1 hover:bg-slate-100">Settings</Link>
        </nav>
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="px-2 text-xs uppercase tracking-wide text-slate-500">Partner</p>
          <div className="mt-2 space-y-1">
            {business?.enable_nova_delivers_menu && business.slug ? (
              <Link href="/dashboard/partner" className="block rounded px-2 py-1 text-sm hover:bg-slate-100">
                Nova Delivers
              </Link>
            ) : (
              <p className="px-2 text-sm text-slate-400">Nova Delivers (disabled)</p>
            )}
            {business?.enable_nova_mart_menu && business.slug ? (
              <Link href="/dashboard/partner?partner=mart" className="block rounded px-2 py-1 text-sm hover:bg-slate-100">
                Nova Mart
              </Link>
            ) : (
              <p className="px-2 text-sm text-slate-400">Nova Mart (disabled)</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </aside>
      <section>{children}</section>
    </div>
  )
}
