import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function DashboardHomePage() {
  const { profile, supabase, user } = await requireRole()
  const admin = createAdminClient()

  let business:
    | { id: string; name: string; slug: string; is_active: boolean; nova_delivers_commission_percent: number }
    | null = null

  if (profile.business_id) {
    const withCommission = await supabase
      .from('businesses')
      .select('id,name,slug,is_active,nova_delivers_commission_percent')
      .eq('id', profile.business_id)
      .maybeSingle()

    const schemaError = withCommission.error?.message?.toLowerCase() || ''
    if (withCommission.data) {
      business = withCommission.data
    } else if (withCommission.error && schemaError.includes('nova_delivers_commission_percent')) {
      const fallback = await supabase.from('businesses').select('id,name,slug,is_active').eq('id', profile.business_id).maybeSingle()
      business = fallback.data ? { ...fallback.data, nova_delivers_commission_percent: 0 } : null
    }
  }

  const views = business
    ? (await supabase
        .from('menu_page_views')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)).count || 0
    : 0

  const deliveredOrders = business
    ? (await admin
        .from('nova_orders')
        .select('id,subtotal_npr')
        .eq('business_id', business.id)
        .eq('status', 'DELIVERED')
        .limit(5000)).data || []
    : []

  const completedOrderCount = deliveredOrders.length
  const deliveredSubtotal = deliveredOrders.reduce((sum, order) => sum + Number(order.subtotal_npr || 0), 0)
  const commissionPercent = Math.max(0, Number(business?.nova_delivers_commission_percent || 0))
  const commissionEarned = Math.round(deliveredSubtotal * (commissionPercent / 100))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Signed in as {user.email}</p>
      </div>

      {business ? (
        <div className="space-y-4">
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

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Partner</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Nova Delivers</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-sm text-emerald-700">Orders completed</p>
                <p className="mt-1 text-3xl font-semibold text-emerald-900">{completedOrderCount}</p>
              </div>
              <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-5 shadow-sm">
                <p className="text-sm font-medium text-emerald-800">Commission earned</p>
                <p className="mt-1 text-3xl font-bold text-emerald-950">{commissionEarned}</p>
                <p className="mt-1 text-xs text-emerald-800">At {commissionPercent}% on delivered subtotal</p>
              </div>
            </div>
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
