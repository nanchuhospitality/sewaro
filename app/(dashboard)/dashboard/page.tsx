import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function DashboardHomePage() {
  const { profile, supabase, user } = await requireRole()
  const admin = createAdminClient()

  let business:
    | {
        id: string
        name: string
        slug: string
        is_active: boolean
        enable_nova_delivers_menu: boolean
        nova_delivers_commission_percent: number
        enable_nova_mart_menu: boolean
        nova_mart_commission_percent: number
      }
    | null = null

  if (profile.business_id) {
    const withCommission = await supabase
      .from('businesses')
      .select('id,name,slug,is_active,enable_nova_delivers_menu,nova_delivers_commission_percent,enable_nova_mart_menu,nova_mart_commission_percent')
      .eq('id', profile.business_id)
      .maybeSingle()

    const schemaError = withCommission.error?.message?.toLowerCase() || ''
    if (withCommission.data) {
      business = withCommission.data
    } else if (
      withCommission.error &&
      (
        schemaError.includes('nova_delivers_commission_percent') ||
        schemaError.includes('enable_nova_delivers_menu') ||
        schemaError.includes('nova_mart_commission_percent') ||
        schemaError.includes('enable_nova_mart_menu')
      )
    ) {
      const fallback = await supabase.from('businesses').select('id,name,slug,is_active').eq('id', profile.business_id).maybeSingle()
      business = fallback.data
        ? {
            ...fallback.data,
            enable_nova_delivers_menu: false,
            nova_delivers_commission_percent: 0,
            enable_nova_mart_menu: false,
            nova_mart_commission_percent: 0,
          }
        : null
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
        .select('id')
        .eq('business_id', business.id)
        .eq('status', 'DELIVERED')
        .limit(5000)).data || []
    : []

  const deliveredOrderIds = deliveredOrders.map((order) => order.id)
  let deliveredItemsBySource: Array<{ order_id: string; source: 'DELIVERS' | 'MART'; line_total_npr: number }> = []
  if (deliveredOrderIds.length > 0) {
    const itemsRes = await admin
      .from('nova_order_items')
      .select('order_id,source,line_total_npr')
      .in('order_id', deliveredOrderIds)
    const sourceSchemaError = itemsRes.error?.message?.toLowerCase() || ''
    if (itemsRes.data) {
      deliveredItemsBySource = (itemsRes.data as any[]).map((row) => ({
        order_id: String(row.order_id),
        source: row.source === 'MART' ? 'MART' : 'DELIVERS',
        line_total_npr: Number(row.line_total_npr || 0),
      }))
    } else if (itemsRes.error && sourceSchemaError.includes('source')) {
      const fallbackItems = await admin
        .from('nova_order_items')
        .select('order_id,line_total_npr')
        .in('order_id', deliveredOrderIds)
      deliveredItemsBySource = (fallbackItems.data || []).map((row: any) => ({
        order_id: String(row.order_id),
        source: 'DELIVERS',
        line_total_npr: Number(row.line_total_npr || 0),
      }))
    }
  }

  const deliversCompletedOrderIds = new Set(deliveredItemsBySource.filter((item) => item.source === 'DELIVERS').map((item) => item.order_id))
  const martCompletedOrderIds = new Set(deliveredItemsBySource.filter((item) => item.source === 'MART').map((item) => item.order_id))
  const deliversCompletedCount = deliversCompletedOrderIds.size
  const martCompletedCount = martCompletedOrderIds.size
  const deliversSubtotal = deliveredItemsBySource
    .filter((item) => item.source === 'DELIVERS')
    .reduce((sum, item) => sum + Math.max(0, item.line_total_npr), 0)
  const martSubtotal = deliveredItemsBySource
    .filter((item) => item.source === 'MART')
    .reduce((sum, item) => sum + Math.max(0, item.line_total_npr), 0)
  const deliversCommissionPercent = Math.max(0, Number(business?.nova_delivers_commission_percent || 0))
  const deliversCommissionEarned = Math.round(deliversSubtotal * (deliversCommissionPercent / 100))
  const martCommissionPercent = Math.max(0, Number(business?.nova_mart_commission_percent || 0))
  const martCommissionEarned = Math.round(martSubtotal * (martCommissionPercent / 100))

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

          {business.enable_nova_delivers_menu || business.enable_nova_mart_menu ? (
            <div className="space-y-3">
              {business.enable_nova_delivers_menu ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Partner</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">Nova Delivers</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                      <p className="text-sm text-emerald-700">Orders completed</p>
                      <p className="mt-1 text-3xl font-semibold text-emerald-900">{deliversCompletedCount}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-5 shadow-sm">
                      <p className="text-sm font-medium text-emerald-800">Commission earned</p>
                      <p className="mt-1 text-3xl font-bold text-emerald-950">{deliversCommissionEarned}</p>
                      <p className="mt-1 text-xs text-emerald-800">At {deliversCommissionPercent}% on delivered Delivers items</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {business.enable_nova_mart_menu ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Partner</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">Nova Mart</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                      <p className="text-sm text-blue-700">Orders completed</p>
                      <p className="mt-1 text-3xl font-semibold text-blue-900">{martCompletedCount}</p>
                    </div>
                    <div className="rounded-xl border border-blue-300 bg-blue-100 p-5 shadow-sm">
                      <p className="text-sm font-medium text-blue-800">Commission earned</p>
                      <p className="mt-1 text-3xl font-bold text-blue-950">{martCommissionEarned}</p>
                      <p className="mt-1 text-xs text-blue-800">At {martCommissionPercent}% on delivered Mart items</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
