import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'

export default async function DashboardHomePage() {
  const { profile, supabase, user } = await requireRole()

  const business = profile.business_id
    ? (await supabase.from('businesses').select('id,name,slug,is_active').eq('id', profile.business_id).maybeSingle()).data
    : null

  const views = business
    ? (await supabase
        .from('menu_page_views')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)).count || 0
    : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Signed in as {user.email}</p>
      </div>

      {business ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Business</p>
            <p className="mt-1 text-lg font-semibold">{business.name}</p>
            <p className="text-sm text-slate-600">Slug: {business.slug}</p>
            <p className="text-sm text-slate-600">Status: {business.is_active ? 'Active' : 'Inactive'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Menu page views</p>
            <p className="mt-1 text-3xl font-semibold">{views}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">No business linked yet.</p>
          <Link href="/onboarding" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
            Add business
          </Link>
        </div>
      )}
    </div>
  )
}
