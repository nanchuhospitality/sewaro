import Link from 'next/link'
import { addSupportTicketItem, cancelSupportTicket, placeSupportTicketOrder } from '@/actions/ops'
import { requireRole } from '@/lib/auth/requireRole'
import AutoRefresh from '@/components/ops/AutoRefresh'
import SupportReplyForm from '@/components/ops/SupportReplyForm'
import NovaMenuItemPicker from '@/components/ops/NovaMenuItemPicker'
import { buildNovaMenuOptions } from '@/lib/utils/novaMenu'

function statusColor(status: string) {
  if (status === 'PLACED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'CLOSED_TIMEOUT') return 'bg-slate-100 text-slate-600 border-slate-300'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

export default async function CentralOpsSupportPage({ searchParams }: { searchParams?: { ticket?: string } }) {
  const { supabase } = await requireRole('CENTRAL_OPS')
  const selectedTicketId = String(searchParams?.ticket || '').trim()

  const { data: supportTickets, error } = await supabase
    .from('nova_support_tickets')
    .select('id,ticket_code,business_name_snapshot,room,status,note,cart_json,subtotal_npr,delivery_charge_npr,total_npr,created_at,expires_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load support tickets. Run migration <code>0024_create_nova_support_tickets.sql</code> and refresh.
        </div>
      </main>
    )
  }

  const supportTicketIds = (supportTickets || []).map((ticket) => ticket.id)
  const { data: supportMessages } = supportTicketIds.length
    ? await supabase
        .from('nova_support_messages')
        .select('id,ticket_id,sender_type,message,created_at')
        .in('ticket_id', supportTicketIds)
        .order('created_at', { ascending: true })
    : { data: [] as Array<{ id: string; ticket_id: string; sender_type: string; message: string; created_at: string }> }

  const messagesByTicket = new Map<string, Array<{ id: string; sender_type: string; message: string; created_at: string }>>()
  for (const message of supportMessages || []) {
    if (!messagesByTicket.has(message.ticket_id)) messagesByTicket.set(message.ticket_id, [])
    messagesByTicket.get(message.ticket_id)!.push(message)
  }

  const { data: novaMenuRow } = await supabase.from('nova_delivers_menu').select('items,variants').eq('id', 1).maybeSingle()
  const novaMenuOptions = buildNovaMenuOptions(novaMenuRow || null)

  const selectedTicket = (supportTickets || []).find((ticket) => ticket.id === selectedTicketId) || null
  const selectedMessages = selectedTicket ? (messagesByTicket.get(selectedTicket.id) || []) : []

  const buildTicketHref = (ticketId: string) => {
    const params = new URLSearchParams()
    params.set('ticket', ticketId)
    return `/ops/support?${params.toString()}`
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AutoRefresh everyMs={4000} />
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Central Ops</h1>
        <div className="mt-3 flex gap-2 text-sm">
          <Link href="/ops/orders" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Orders
          </Link>
          <Link href="/ops/support" className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white">
            Support
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-600">Support tickets from customers who need help placing an order.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {(supportTickets || []).map((ticket) => {
            const isSelected = selectedTicketId === ticket.id
            return (
              <Link
                key={ticket.id}
                href={buildTicketHref(ticket.id)}
                className={`block rounded-xl border bg-white p-4 shadow-sm transition ${
                  isSelected ? 'border-slate-900 ring-1 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ticket.ticket_code}</p>
                    <p className="text-sm text-slate-600">
                      {ticket.business_name_snapshot}
                      {ticket.room ? ` • Room ${ticket.room}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(ticket.created_at).toLocaleString()} • Expires {new Date(ticket.expires_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(ticket.status)}`}>{ticket.status}</span>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{ticket.total_npr}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:h-fit">
          {!selectedTicket ? (
            <p className="text-sm text-slate-600">Select a support ticket to view full details.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedTicket.ticket_code}</p>
                <p className="text-sm text-slate-600">
                  {selectedTicket.business_name_snapshot}
                  {selectedTicket.room ? ` • Room ${selectedTicket.room}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(selectedTicket.created_at).toLocaleString()} • Expires {new Date(selectedTicket.expires_at).toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Chat</p>
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {selectedMessages.map((message) => (
                    <div key={message.id} className="rounded bg-white px-2 py-1.5 text-xs text-slate-700">
                      <span className="font-semibold">{message.sender_type}</span>: {message.message}
                    </div>
                  ))}
                </div>
                <SupportReplyForm ticketId={selectedTicket.id} />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                <div className="mb-3 space-y-1.5">
                  {(Array.isArray(selectedTicket.cart_json) ? selectedTicket.cart_json : []).map((item: any, index: number) => {
                    const itemName = String(item?.item_name || '').trim()
                    const variantName = String(item?.variant_name || '').trim()
                    const qty = Number(item?.quantity || 0)
                    const unit = Number(item?.unit_price_npr || 0)
                    if (!itemName || !Number.isFinite(qty) || qty <= 0) return null
                    const lineTotal = qty * unit
                    return (
                      <div key={`${selectedTicket.id}-item-${index}`} className="flex items-center justify-between text-sm">
                        <p className="text-slate-700">
                          {qty} x {itemName}
                          {variantName ? ` (${variantName})` : ''}
                        </p>
                        <p className="font-medium text-slate-900">{lineTotal}</p>
                      </div>
                    )
                  })}
                </div>
                <form
                  action={async (formData) => {
                    'use server'
                    await addSupportTicketItem(formData)
                  }}
                  className="mb-3 grid grid-cols-1 gap-1 rounded border border-dashed border-slate-300 bg-white p-2"
                >
                  <input type="hidden" name="ticket_id" value={selectedTicket.id} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Item</p>
                  <NovaMenuItemPicker options={novaMenuOptions} submitLabel="Add" disabled={selectedTicket.status !== 'OPEN'} />
                </form>
                {selectedTicket.note ? <p className="mb-2 text-xs text-slate-600">Note: {selectedTicket.note}</p> : null}
                <div className="flex items-center justify-between text-slate-700">
                  <span>Subtotal</span>
                  <span>{selectedTicket.subtotal_npr}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Delivery</span>
                  <span>{selectedTicket.delivery_charge_npr}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{selectedTicket.total_npr}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <form
                  action={async (formData) => {
                    'use server'
                    await placeSupportTicketOrder(formData)
                  }}
                >
                  <input type="hidden" name="ticket_id" value={selectedTicket.id} />
                  <button
                    disabled={selectedTicket.status !== 'OPEN'}
                    className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Place Order
                  </button>
                </form>
                <form
                  action={async (formData) => {
                    'use server'
                    await cancelSupportTicket(formData)
                  }}
                >
                  <input type="hidden" name="ticket_id" value={selectedTicket.id} />
                  <button
                    disabled={selectedTicket.status !== 'OPEN'}
                    className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
