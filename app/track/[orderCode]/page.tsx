import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

function statusLabel(status: string) {
  if (status === 'OUT_FOR_DELIVERY') return 'Out for delivery'
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default async function TrackOrderPage({ params }: { params: { orderCode: string } }) {
  const orderCode = String(params.orderCode || '').trim().toUpperCase()
  if (!orderCode) notFound()

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('nova_orders')
    .select('id,business_id,order_code,business_name_snapshot,room,source,status,customer_phone,note,subtotal_npr,delivery_charge_npr,total_npr,created_at,updated_at')
    .eq('order_code', orderCode)
    .maybeSingle()
  if (!order) notFound()

  const { data: business } = await supabase
    .from('businesses')
    .select('slug')
    .eq('id', order.business_id)
    .maybeSingle()

  const backHref = business?.slug
    ? (order.room ? `/${business.slug}/${order.room}` : `/${business.slug}`)
    : '/'

  const { data: items } = await supabase
    .from('nova_order_items')
    .select('item_name,variant_name,quantity,line_total_npr')
    .eq('order_id', order.id)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link
          href={backHref}
          className="mb-3 inline-block rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Track Order</h1>
        <p className="mt-1 text-sm text-slate-600">
          {order.order_code} • {order.business_name_snapshot}
          {order.room ? ` • Room ${order.room}` : ''}
        </p>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-700">
            Status: <span className="font-semibold text-slate-900">{statusLabel(order.status)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Last updated: {new Date(order.updated_at).toLocaleString()}</p>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Items</h2>
        <div className="mt-3 space-y-1.5">
          {(items || []).map((item, idx) => (
            <div key={`${item.item_name}-${idx}`} className="flex items-center justify-between text-sm">
              <p className="text-slate-700">
                {item.quantity} x {item.item_name}
                {item.variant_name ? ` (${item.variant_name})` : ''}
              </p>
              <p className="font-medium text-slate-900">{item.line_total_npr}</p>
            </div>
          ))}
        </div>
        {order.note ? <p className="mt-2 text-xs text-slate-600">Note: {order.note}</p> : null}
        <div className="mt-3 border-t border-slate-200 pt-2 text-sm">
          <div className="flex items-center justify-between text-slate-700">
            <span>Subtotal</span>
            <span>{order.subtotal_npr}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span>Delivery</span>
            <span>{order.delivery_charge_npr}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-slate-900">
            <span>Total</span>
            <span>{order.total_npr}</span>
          </div>
        </div>
      </section>
    </main>
  )
}
