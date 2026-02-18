import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import { createAdminClient } from '@/lib/supabase/admin'

type RangeKey = 'today' | '7d' | '30d' | 'all'

type DashboardOrder = {
  id: string
  order_code: string
  status: string
  room: string | null
  subtotal_npr: number
  delivery_charge_npr: number
  total_npr: number
  created_at: string
}

function getSinceDate(range: RangeKey) {
  const now = new Date()
  if (range === 'all') return null
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const d = new Date(now)
  d.setDate(d.getDate() - (range === '7d' ? 6 : 29))
  d.setHours(0, 0, 0, 0)
  return d
}

function toInt(value: unknown) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

export default async function PartnerDashboardPage({ searchParams }: { searchParams?: { range?: string; partner?: string } }) {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')
  const admin = createAdminClient()

  if (!profile.business_id) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-700">No business linked yet.</p>
      </div>
    )
  }

  const range = (['today', '7d', '30d', 'all'].includes(String(searchParams?.range || '7d')) ? String(searchParams?.range || '7d') : '7d') as RangeKey
  const partnerKey = String(searchParams?.partner || '').toLowerCase() === 'mart' ? 'MART' : 'DELIVERS'
  const partnerLabel = partnerKey === 'MART' ? 'Nova Mart' : 'Nova Delivers'
  const since = getSinceDate(range)

  const withPartner = await supabase
    .from('businesses')
    .select('id,name,slug,is_active,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_commission_percent,nova_delivers_delivery_charge_npr,nova_delivers_support_phone,enable_nova_mart_menu,enable_nova_mart_ordering,nova_mart_commission_percent,nova_mart_delivery_charge_npr,nova_mart_support_phone')
    .eq('id', profile.business_id)
    .maybeSingle()

  let business = withPartner.data
  const schemaError = withPartner.error?.message?.toLowerCase() || ''
  if (
    !business &&
    (
      schemaError.includes('enable_nova_delivers_menu') ||
      schemaError.includes('enable_nova_delivers_ordering') ||
      schemaError.includes('nova_delivers_delivery_charge_npr') ||
      schemaError.includes('nova_delivers_support_phone') ||
      schemaError.includes('nova_delivers_commission_percent') ||
      schemaError.includes('enable_nova_mart_menu') ||
      schemaError.includes('enable_nova_mart_ordering') ||
      schemaError.includes('nova_mart_commission_percent') ||
      schemaError.includes('nova_mart_delivery_charge_npr') ||
      schemaError.includes('nova_mart_support_phone')
    )
  ) {
    const fallback = await supabase
      .from('businesses')
      .select('id,name,slug,is_active')
      .eq('id', profile.business_id)
      .maybeSingle()
    business = fallback.data
      ? {
          ...fallback.data,
          enable_nova_delivers_menu: false,
          enable_nova_delivers_ordering: false,
          nova_delivers_commission_percent: 0,
          nova_delivers_delivery_charge_npr: 0,
          nova_delivers_support_phone: null,
          enable_nova_mart_menu: false,
          enable_nova_mart_ordering: false,
          nova_mart_commission_percent: 0,
          nova_mart_delivery_charge_npr: 0,
          nova_mart_support_phone: null,
        }
      : null
  }

  if (!business) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
        Could not load partner data.
      </div>
    )
  }

  let orders: DashboardOrder[] = []
  let ordersErrorText: string | null = null

  let ordersQuery = admin
    .from('nova_orders')
    .select('id,order_code,status,room,subtotal_npr,delivery_charge_npr,total_npr,created_at')
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (since) ordersQuery = ordersQuery.gte('created_at', since.toISOString())
  const ordersRes = await ordersQuery
  if (ordersRes.data) {
    orders = ordersRes.data as DashboardOrder[]
  } else {
    ordersErrorText = ordersRes.error?.message || 'Could not load orders.'
  }

  const orderIds = orders.map((order) => order.id)
  type OrderItemRow = { order_id: string; source: 'DELIVERS' | 'MART'; item_name: string; quantity: number; line_total_npr: number }
  let orderItems: OrderItemRow[] = []
  if (orderIds.length > 0) {
    const itemsRes = await admin
      .from('nova_order_items')
      .select('order_id,source,item_name,quantity,line_total_npr')
      .in('order_id', orderIds)
    const schemaError = itemsRes.error?.message?.toLowerCase() || ''
    if (itemsRes.data) {
      orderItems = (itemsRes.data as any[]).map((row) => ({
        order_id: String(row.order_id),
        source: row.source === 'MART' ? 'MART' : 'DELIVERS',
        item_name: String(row.item_name || ''),
        quantity: toInt(row.quantity),
        line_total_npr: toInt(row.line_total_npr),
      }))
    } else if (itemsRes.error && schemaError.includes('source')) {
      const fallbackItems = await admin
        .from('nova_order_items')
        .select('order_id,item_name,quantity,line_total_npr')
        .in('order_id', orderIds)
      orderItems = (fallbackItems.data as any[] || []).map((row) => ({
        order_id: String(row.order_id),
        source: 'DELIVERS',
        item_name: String(row.item_name || ''),
        quantity: toInt(row.quantity),
        line_total_npr: toInt(row.line_total_npr),
      }))
    }
  }

  const orderPartnerMap = new Map<string, Set<'DELIVERS' | 'MART'>>()
  for (const item of orderItems) {
    if (!orderPartnerMap.has(item.order_id)) orderPartnerMap.set(item.order_id, new Set())
    orderPartnerMap.get(item.order_id)!.add(item.source)
  }

  const filteredOrders = orders.filter((order) => orderPartnerMap.get(order.id)?.has(partnerKey as 'DELIVERS' | 'MART'))
  const totalOrders = filteredOrders.length
  const completedOrders = filteredOrders.filter((order) => order.status === 'DELIVERED')
  const failedOrders = filteredOrders.filter((order) => order.status === 'CANCELLED')
  const inProgressOrders = filteredOrders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status))

  const completedOrderIdSet = new Set(completedOrders.map((order) => order.id))
  const partnerCompletedItems = orderItems.filter((item) => item.source === partnerKey && completedOrderIdSet.has(item.order_id))

  const grossSales = partnerCompletedItems.reduce((sum, item) => sum + toInt(item.line_total_npr), 0)
  const deliveryCollected = completedOrders.reduce((sum, order) => sum + toInt(order.delivery_charge_npr), 0)
  const totalCustomerPaid = completedOrders.reduce((sum, order) => sum + toInt(order.total_npr), 0)

  const commissionPercent = partnerKey === 'MART' ? toInt(business.nova_mart_commission_percent) : toInt(business.nova_delivers_commission_percent)
  const commissionEarned = Math.round(grossSales * (commissionPercent / 100))

  const completionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0
  const cancellationRate = totalOrders > 0 ? Math.round((failedOrders.length / totalOrders) * 100) : 0
  const avgOrderValue = completedOrders.length > 0 ? Math.round(totalCustomerPaid / completedOrders.length) : 0

  const byDateMap = new Map<string, { total: number; delivered: number; cancelled: number }>()
  for (const order of filteredOrders) {
    const day = order.created_at.slice(0, 10)
    if (!byDateMap.has(day)) byDateMap.set(day, { total: 0, delivered: 0, cancelled: 0 })
    const row = byDateMap.get(day)!
    row.total += 1
    if (order.status === 'DELIVERED') row.delivered += 1
    if (order.status === 'CANCELLED') row.cancelled += 1
  }
  const trendRows = [...byDateMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)

  const roomMap = new Map<string, number>()
  for (const order of filteredOrders) {
    const room = (order.room || 'No room').toUpperCase()
    roomMap.set(room, (roomMap.get(room) || 0) + 1)
  }
  const topRooms = [...roomMap.entries()]
    .map(([room, count]) => ({ room, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const itemMap = new Map<string, number>()
  for (const item of partnerCompletedItems) {
    const key = String(item.item_name || '').trim() || 'Unknown item'
    itemMap.set(key, (itemMap.get(key) || 0) + toInt(item.quantity))
  }
  const topItems = [...itemMap.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
  const recentOrders = filteredOrders.slice(0, 50)

  const rangeHref = (next: RangeKey) => `/dashboard/partner?partner=${partnerKey.toLowerCase()}&range=${next}`

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold">{partnerLabel} Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Owner analytics for {business.name}.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a href={rangeHref('today')} className={`rounded border px-2 py-1 ${range === 'today' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>Today</a>
          <a href={rangeHref('7d')} className={`rounded border px-2 py-1 ${range === '7d' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>Last 7 days</a>
          <a href={rangeHref('30d')} className={`rounded border px-2 py-1 ${range === '30d' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>Last 30 days</a>
          <a href={rangeHref('all')} className={`rounded border px-2 py-1 ${range === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>All time</a>
        </div>
      </div>

      {(partnerKey === 'DELIVERS' ? !business.enable_nova_delivers_menu : !business.enable_nova_mart_menu) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {partnerLabel} is currently disabled for this business.
        </div>
      ) : null}

      {ordersErrorText ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{ordersErrorText}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Analytics reads are scoped securely by your business id on the server.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Placed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalOrders}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{completedOrders.length}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-red-700">Failed</p>
          <p className="mt-1 text-2xl font-semibold text-red-900">{failedOrders.length}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-blue-700">In Progress</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900">{inProgressOrders.length}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Revenue (Delivered Only)</p>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-600">Gross Sales (Subtotal)</span><span className="font-semibold">{grossSales}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Delivery Charge Collected</span><span className="font-semibold">{deliveryCollected}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Total Customer Paid</span><span className="font-semibold">{totalCustomerPaid}</span></div>
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-emerald-800">Commission Earned</p>
              <p className="mt-1 text-2xl font-bold text-emerald-950">{commissionEarned}</p>
              <p className="text-xs text-emerald-800">{commissionPercent}% on delivered {partnerLabel} item subtotal</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Performance</p>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-600">Completion Rate</span><span className="font-semibold">{completionRate}%</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Cancellation Rate</span><span className="font-semibold">{cancellationRate}%</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Average Order Value</span><span className="font-semibold">{avgOrderValue}</span></div>
            <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between"><span className="text-slate-600">Ordering Status</span><span className="font-semibold">{partnerKey === 'MART' ? (business.enable_nova_mart_ordering ? 'Enabled' : 'Disabled') : (business.enable_nova_delivers_ordering ? 'Enabled' : 'Disabled')}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Support Phone</span><span className="font-semibold">{partnerKey === 'MART' ? (business.nova_mart_support_phone || 'Not set') : (business.nova_delivers_support_phone || 'Not set')}</span></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <p className="text-sm text-slate-500">Top Rooms</p>
          <div className="mt-2 space-y-1.5 text-sm">
            {topRooms.length === 0 ? <p className="text-slate-500">No room data.</p> : null}
            {topRooms.map((row) => (
              <div key={row.room} className="flex items-center justify-between">
                <span className="text-slate-700">{row.room}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <p className="text-sm text-slate-500">Top Items (Delivered)</p>
          <div className="mt-2 space-y-1.5 text-sm">
            {topItems.length === 0 ? <p className="text-slate-500">No item data.</p> : null}
            {topItems.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700">{row.name}</span>
                <span className="font-semibold">{row.qty}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <p className="text-sm text-slate-500">Order Trend (Daily)</p>
          <div className="mt-2 space-y-1.5 text-sm">
            {trendRows.length === 0 ? <p className="text-slate-500">No order trend yet.</p> : null}
            {trendRows.map(([day, row]) => (
              <div key={day} className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-slate-600">{day}</span>
                <span className="text-slate-700">Total {row.total} • Done {row.delivered} • Failed {row.cancelled}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <a href={partnerKey === 'MART' ? `/${business.slug}/mart-menu` : `/${business.slug}/partner-menu`} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
            Open Public Partner Menu
          </a>
          <Link href={`/dashboard/partner/settings?partner=${partnerKey.toLowerCase()}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
            {partnerLabel} Settings
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Order Details</p>
        {recentOrders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No orders in selected range.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Room</th>
                  <th className="px-2 py-2">Subtotal</th>
                  <th className="px-2 py-2">Delivery</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Placed At</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{order.order_code}</td>
                    <td className="px-2 py-2 text-slate-700">{order.status}</td>
                    <td className="px-2 py-2 text-slate-700">{order.room || '-'}</td>
                    <td className="px-2 py-2 text-slate-700">{toInt(order.subtotal_npr)}</td>
                    <td className="px-2 py-2 text-slate-700">{toInt(order.delivery_charge_npr)}</td>
                    <td className="px-2 py-2 text-slate-900 font-medium">{toInt(order.total_npr)}</td>
                    <td className="px-2 py-2 text-slate-600">{new Date(order.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
