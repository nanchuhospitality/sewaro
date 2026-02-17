import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'
import { addNovaOrderItem, deleteNovaOrderItem, updateNovaOrderDetails, updateNovaOrderItem, updateNovaOrderStatus } from '@/actions/ops'
import AutoRefresh from '@/components/ops/AutoRefresh'
import NovaMenuItemPicker from '@/components/ops/NovaMenuItemPicker'
import { buildNovaMenuOptions } from '@/lib/utils/novaMenu'

type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'

function statusColor(status: string) {
  if (status === 'DELIVERED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'OUT_FOR_DELIVERY') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (status === 'PREPARING') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'ACCEPTED') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function minutesSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 60000))
}

function isUrgentOrder(order: { status: string; created_at: string }) {
  const age = minutesSince(order.created_at)
  if (order.status === 'NEW') return age >= 5
  if (order.status === 'ACCEPTED' || order.status === 'PREPARING') return age >= 15
  if (order.status === 'OUT_FOR_DELIVERY') return age >= 25
  return false
}

export default async function CentralOpsOrdersPage({
  searchParams,
}: {
  searchParams?: { status?: string; order?: string; q?: string; priority?: string }
}) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const statusFilter = String(searchParams?.status || '').trim().toUpperCase() as OrderStatus | ''
  const selectedOrderId = String(searchParams?.order || '').trim()
  const searchQuery = String(searchParams?.q || '').trim().toLowerCase()
  const priorityFilter = String(searchParams?.priority || '').trim().toUpperCase()

  let ordersQuery = supabase
    .from('nova_orders')
    .select('id,order_code,business_name_snapshot,room,source,status,customer_phone,note,subtotal_npr,delivery_charge_npr,total_npr,created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (statusFilter) {
    ordersQuery = ordersQuery.eq('status', statusFilter)
  }

  const { data: orders, error: ordersError } = await ordersQuery
  if (ordersError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load orders. Run migration <code>0023_create_nova_orders.sql</code> and refresh.
        </div>
      </main>
    )
  }

  const orderIds = (orders || []).map((order) => order.id)
  const { data: orderItems } = orderIds.length
    ? await supabase
        .from('nova_order_items')
        .select('id,order_id,item_name,variant_name,quantity,unit_price_npr,line_total_npr')
        .in('order_id', orderIds)
    : {
        data: [] as Array<{
          id: string
          order_id: string
          item_name: string
          variant_name: string | null
          quantity: number
          unit_price_npr: number
          line_total_npr: number
        }>,
      }

  const { data: novaMenuRow } = await supabase.from('nova_delivers_menu').select('items,variants').eq('id', 1).maybeSingle()
  const novaMenuOptions = buildNovaMenuOptions(novaMenuRow || null)

  const itemsByOrder = new Map<string, Array<{ id: string; item_name: string; variant_name: string | null; quantity: number; unit_price_npr: number; line_total_npr: number }>>()
  for (const item of orderItems || []) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, [])
    itemsByOrder.get(item.order_id)!.push(item)
  }

  const baseOrders = orders || []
  const statusCounts = {
    ALL: baseOrders.length,
    NEW: baseOrders.filter((order) => order.status === 'NEW').length,
    ACCEPTED: baseOrders.filter((order) => order.status === 'ACCEPTED').length,
    PREPARING: baseOrders.filter((order) => order.status === 'PREPARING').length,
    OUT_FOR_DELIVERY: baseOrders.filter((order) => order.status === 'OUT_FOR_DELIVERY').length,
    DELIVERED: baseOrders.filter((order) => order.status === 'DELIVERED').length,
    CANCELLED: baseOrders.filter((order) => order.status === 'CANCELLED').length,
  }

  let filteredOrders = baseOrders.filter((order) => {
    if (!searchQuery) return true
    const haystack = [order.order_code, order.business_name_snapshot, order.room || '', order.customer_phone || '', order.note || '']
      .join(' ')
      .toLowerCase()
    return haystack.includes(searchQuery)
  })

  if (priorityFilter === 'URGENT') {
    filteredOrders = filteredOrders.filter((order) => isUrgentOrder(order))
  } else if (priorityFilter === 'NORMAL') {
    filteredOrders = filteredOrders.filter((order) => !isUrgentOrder(order))
  }

  filteredOrders.sort((a, b) => {
    const aUrgent = isUrgentOrder(a) ? 1 : 0
    const bUrgent = isUrgentOrder(b) ? 1 : 0
    if (aUrgent !== bUrgent) return bUrgent - aUrgent
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || null
  const selectedOrderItems = selectedOrder ? itemsByOrder.get(selectedOrder.id) || [] : []
  const orderItemsLocked = selectedOrder ? !['NEW', 'ACCEPTED'].includes(selectedOrder.status) : true
  const openOrders = filteredOrders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status))
  const urgentOrders = filteredOrders.filter((order) => isUrgentOrder(order))

  const buildOrderHref = (orderId: string) => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (searchQuery) params.set('q', searchQuery)
    if (priorityFilter) params.set('priority', priorityFilter)
    params.set('order', orderId)
    return `/ops/orders?${params.toString()}`
  }

  const buildStatusHref = (status: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (searchQuery) params.set('q', searchQuery)
    if (priorityFilter) params.set('priority', priorityFilter)
    return `/ops/orders${params.toString() ? `?${params.toString()}` : ''}`
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AutoRefresh everyMs={4000} />
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Central Ops</h1>
        <div className="mt-3 flex gap-2 text-sm">
          <Link href="/ops/orders" className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white">
            Orders
          </Link>
          <Link href="/ops/support" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Support
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-600">Urgency-first queue for fast triage at higher order volume.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Visible Queue</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{filteredOrders.length}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs uppercase tracking-wide text-amber-700">Urgent</p>
            <p className="mt-1 text-xl font-semibold text-amber-900">{urgentOrders.length}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs uppercase tracking-wide text-blue-700">Active</p>
            <p className="mt-1 text-xl font-semibold text-blue-900">{openOrders.length}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Completed</p>
            <p className="mt-1 text-xl font-semibold text-emerald-900">{filteredOrders.filter((order) => order.status === 'DELIVERED').length}</p>
          </div>
        </div>

        <form className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search code, hotel, room, phone"
            className="min-w-[220px] flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select name="priority" defaultValue={priorityFilter} className="rounded border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="">All Priority</option>
            <option value="URGENT">Urgent only</option>
            <option value="NORMAL">Normal only</option>
          </select>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
          <a href={buildStatusHref(statusFilter)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            Reset Search
          </a>
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            { status: '', label: 'ALL', count: statusCounts.ALL },
            { status: 'NEW', label: 'NEW', count: statusCounts.NEW },
            { status: 'ACCEPTED', label: 'ACCEPTED', count: statusCounts.ACCEPTED },
            { status: 'PREPARING', label: 'PREPARING', count: statusCounts.PREPARING },
            { status: 'OUT_FOR_DELIVERY', label: 'OUT_FOR_DELIVERY', count: statusCounts.OUT_FOR_DELIVERY },
            { status: 'DELIVERED', label: 'DELIVERED', count: statusCounts.DELIVERED },
            { status: 'CANCELLED', label: 'CANCELLED', count: statusCounts.CANCELLED },
          ].map((row) => (
            <a
              key={row.label}
              href={buildStatusHref(row.status)}
              className={`rounded border px-2 py-1 ${
                (row.status || '') === statusFilter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {row.label} ({row.count})
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">No orders match this filter.</div>
          ) : null}
          {filteredOrders.map((order) => {
            const isSelected = selectedOrder?.id === order.id
            const ageMins = minutesSince(order.created_at)
            const urgent = isUrgentOrder(order)
            return (
              <Link
                key={order.id}
                href={buildOrderHref(order.id)}
                className={`block rounded-xl border bg-white p-4 shadow-sm transition ${
                  isSelected ? 'border-slate-900 ring-1 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{order.order_code}</p>
                      {urgent ? (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          URGENT
                        </span>
                      ) : null}
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">{ageMins}m</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {order.business_name_snapshot}
                      {order.room ? ` • Room ${order.room}` : ''}
                      {' • '}
                      {order.source}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(order.created_at).toLocaleString()}
                      {order.customer_phone ? ` • ${order.customer_phone}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(order.status)}`}>{order.status}</span>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{order.total_npr}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:h-fit">
          {!selectedOrder ? (
            <p className="text-sm text-slate-600">Select an order to view full details.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{selectedOrder.order_code}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {minutesSince(selectedOrder.created_at)}m
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {selectedOrder.business_name_snapshot}
                  {selectedOrder.room ? ` • Room ${selectedOrder.room}` : ''}
                  {' • '}
                  {selectedOrder.source}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(selectedOrder.created_at).toLocaleString()}
                  {selectedOrder.customer_phone ? ` • ${selectedOrder.customer_phone}` : ''}
                </p>
              </div>

              <form
                action={async (formData) => {
                  'use server'
                  await updateNovaOrderStatus(formData)
                }}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="order_id" value={selectedOrder.id} />
                <select name="status" defaultValue={selectedOrder.status} className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
                  <option value="NEW">NEW</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="PREPARING">PREPARING</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save</button>
              </form>

              <form
                action={async (formData) => {
                  'use server'
                  await updateNovaOrderDetails(formData)
                }}
                className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <input type="hidden" name="order_id" value={selectedOrder.id} />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit Order</p>
                <input name="room" defaultValue={selectedOrder.room || ''} placeholder="Room" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                <input
                  name="customer_phone"
                  defaultValue={selectedOrder.customer_phone || ''}
                  placeholder="Customer phone"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <textarea
                  name="note"
                  defaultValue={selectedOrder.note || ''}
                  placeholder="Order note"
                  rows={2}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">Save Details</button>
              </form>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                {orderItemsLocked ? (
                  <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Item editing is locked once an order is PREPARING or beyond.
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  {selectedOrderItems.map((item, index) => (
                    <div key={item.id || `${selectedOrder.id}-${index}`} className="space-y-1 rounded border border-slate-200 bg-white p-2">
                      <form
                        action={async (formData) => {
                          'use server'
                          await updateNovaOrderItem(formData)
                        }}
                        className="space-y-1"
                      >
                        <input type="hidden" name="order_id" value={selectedOrder.id} />
                        <input type="hidden" name="order_item_id" value={item.id} />
                        <div className="grid grid-cols-1 gap-1">
                          <input
                            name="item_name"
                            defaultValue={item.item_name}
                            disabled={orderItemsLocked}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <input
                            name="variant_name"
                            defaultValue={item.variant_name || ''}
                            placeholder="Variant (optional)"
                            disabled={orderItemsLocked}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            name="quantity"
                            type="number"
                            min={1}
                            defaultValue={item.quantity}
                            disabled={orderItemsLocked}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <input
                            name="unit_price_npr"
                            type="number"
                            min={0}
                            defaultValue={item.unit_price_npr}
                            disabled={orderItemsLocked}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <div className="flex items-center justify-end text-xs font-medium text-slate-700">{item.line_total_npr}</div>
                        </div>
                        <button
                          disabled={orderItemsLocked}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save
                        </button>
                      </form>
                      <form
                        action={async (formData) => {
                          'use server'
                          await deleteNovaOrderItem(formData)
                        }}
                      >
                        <input type="hidden" name="order_id" value={selectedOrder.id} />
                        <input type="hidden" name="order_item_id" value={item.id} />
                        <button
                          disabled={orderItemsLocked}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
                <form
                  action={async (formData) => {
                    'use server'
                    await addNovaOrderItem(formData)
                  }}
                  className="mt-2 grid grid-cols-1 gap-1 rounded border border-dashed border-slate-300 bg-white p-2"
                >
                  <input type="hidden" name="order_id" value={selectedOrder.id} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Item</p>
                  <NovaMenuItemPicker options={novaMenuOptions} submitLabel="Add" disabled={orderItemsLocked} />
                </form>
                {selectedOrder.note ? <p className="mt-2 text-xs text-slate-600">Note: {selectedOrder.note}</p> : null}
                <div className="mt-3 border-t border-slate-200 pt-2 text-sm">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Subtotal</span>
                    <span>{selectedOrder.subtotal_npr}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Delivery</span>
                    <span>{selectedOrder.delivery_charge_npr}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{selectedOrder.total_npr}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
