import Link from 'next/link'
import { addSupportTicketItem, cancelSupportTicket, placeSupportTicketOrder } from '@/actions/ops'
import { requireRole } from '@/lib/auth/requireRole'
import AutoRefresh from '@/components/ops/AutoRefresh'
import SupportReplyForm from '@/components/ops/SupportReplyForm'
import NovaMenuItemPicker from '@/components/ops/NovaMenuItemPicker'
import { buildNovaMenuOptions } from '@/lib/utils/novaMenu'

type TicketStatus = 'OPEN' | 'PLACED' | 'CANCELLED' | 'CLOSED_TIMEOUT'

function statusColor(status: string) {
  if (status === 'PLACED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'CLOSED_TIMEOUT') return 'bg-slate-100 text-slate-600 border-slate-300'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

function minutesSince(iso: string | null) {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 60000))
}

function minutesUntil(iso: string | null) {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - Date.now()
  return Math.floor(ms / 60000)
}

export default async function CentralOpsSupportPage({
  searchParams,
}: {
  searchParams?: { ticket?: string; status?: string; q?: string; priority?: string }
}) {
  const { supabase } = await requireRole('CENTRAL_OPS')
  const selectedTicketId = String(searchParams?.ticket || '').trim()
  const statusFilter = String(searchParams?.status || '').trim().toUpperCase() as TicketStatus | ''
  const searchQuery = String(searchParams?.q || '').trim().toLowerCase()
  const priorityFilter = String(searchParams?.priority || '').trim().toUpperCase()

  let ticketsQuery = supabase
    .from('nova_support_tickets')
    .select('id,ticket_code,business_name_snapshot,room,status,note,cart_json,subtotal_npr,delivery_charge_npr,total_npr,created_at,expires_at,last_activity_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (statusFilter) ticketsQuery = ticketsQuery.eq('status', statusFilter)
  const { data: supportTickets, error } = await ticketsQuery

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
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

  const baseTickets = supportTickets || []
  const statusCounts = {
    ALL: baseTickets.length,
    OPEN: baseTickets.filter((ticket) => ticket.status === 'OPEN').length,
    PLACED: baseTickets.filter((ticket) => ticket.status === 'PLACED').length,
    CANCELLED: baseTickets.filter((ticket) => ticket.status === 'CANCELLED').length,
    CLOSED_TIMEOUT: baseTickets.filter((ticket) => ticket.status === 'CLOSED_TIMEOUT').length,
  }

  const isUrgentTicket = (ticket: { id: string; status: string; expires_at: string | null }) => {
    if (ticket.status !== 'OPEN') return false
    const messages = messagesByTicket.get(ticket.id) || []
    const lastMessage = messages[messages.length - 1]
    const lastFromCustomer = lastMessage?.sender_type === 'CUSTOMER'
    const waitMinutes = lastFromCustomer ? minutesSince(lastMessage.created_at) : 0
    const expiringSoon = minutesUntil(ticket.expires_at) <= 15
    return waitMinutes >= 2 || expiringSoon
  }

  let filteredTickets = baseTickets.filter((ticket) => {
    if (!searchQuery) return true
    const haystack = [ticket.ticket_code, ticket.business_name_snapshot, ticket.room || '', ticket.note || ''].join(' ').toLowerCase()
    return haystack.includes(searchQuery)
  })

  if (priorityFilter === 'URGENT') {
    filteredTickets = filteredTickets.filter((ticket) => isUrgentTicket(ticket))
  } else if (priorityFilter === 'NORMAL') {
    filteredTickets = filteredTickets.filter((ticket) => !isUrgentTicket(ticket))
  }

  filteredTickets.sort((a, b) => {
    const aUrgent = isUrgentTicket(a) ? 1 : 0
    const bUrgent = isUrgentTicket(b) ? 1 : 0
    if (aUrgent !== bUrgent) return bUrgent - aUrgent
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) || filteredTickets[0] || null
  const selectedMessages = selectedTicket ? messagesByTicket.get(selectedTicket.id) || [] : []
  const urgentTickets = filteredTickets.filter((ticket) => isUrgentTicket(ticket))

  const buildTicketHref = (ticketId: string) => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (searchQuery) params.set('q', searchQuery)
    if (priorityFilter) params.set('priority', priorityFilter)
    params.set('ticket', ticketId)
    return `/ops/support?${params.toString()}`
  }

  const buildStatusHref = (status: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (searchQuery) params.set('q', searchQuery)
    if (priorityFilter) params.set('priority', priorityFilter)
    return `/ops/support${params.toString() ? `?${params.toString()}` : ''}`
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
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
        <p className="mt-3 text-sm text-slate-600">High-throughput support queue with waiting-customer prioritization.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Visible Queue</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{filteredTickets.length}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs uppercase tracking-wide text-amber-700">Urgent</p>
            <p className="mt-1 text-xl font-semibold text-amber-900">{urgentTickets.length}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs uppercase tracking-wide text-blue-700">Open</p>
            <p className="mt-1 text-xl font-semibold text-blue-900">{filteredTickets.filter((ticket) => ticket.status === 'OPEN').length}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Placed</p>
            <p className="mt-1 text-xl font-semibold text-emerald-900">{filteredTickets.filter((ticket) => ticket.status === 'PLACED').length}</p>
          </div>
        </div>

        <form className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search ticket, hotel, room, note"
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
            { status: 'OPEN', label: 'OPEN', count: statusCounts.OPEN },
            { status: 'PLACED', label: 'PLACED', count: statusCounts.PLACED },
            { status: 'CANCELLED', label: 'CANCELLED', count: statusCounts.CANCELLED },
            { status: 'CLOSED_TIMEOUT', label: 'CLOSED_TIMEOUT', count: statusCounts.CLOSED_TIMEOUT },
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">No support tickets match this filter.</div>
          ) : null}
          {filteredTickets.map((ticket) => {
            const isSelected = selectedTicket?.id === ticket.id
            const urgent = isUrgentTicket(ticket)
            const msgs = messagesByTicket.get(ticket.id) || []
            const lastMessage = msgs[msgs.length - 1]
            const waitingOnOps = lastMessage?.sender_type === 'CUSTOMER'
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{ticket.ticket_code}</p>
                      {urgent ? (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          URGENT
                        </span>
                      ) : null}
                      {waitingOnOps && ticket.status === 'OPEN' ? (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          Waiting on Ops
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600">
                      {ticket.business_name_snapshot}
                      {ticket.room ? ` • Room ${ticket.room}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(ticket.created_at).toLocaleString()} • Expires in {Math.max(0, minutesUntil(ticket.expires_at))}m
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{selectedTicket.ticket_code}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(selectedTicket.status)}`}>{selectedTicket.status}</span>
                </div>
                <p className="text-sm text-slate-600">
                  {selectedTicket.business_name_snapshot}
                  {selectedTicket.room ? ` • Room ${selectedTicket.room}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(selectedTicket.created_at).toLocaleString()} • Expires in {Math.max(0, minutesUntil(selectedTicket.expires_at))}m
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Chat</p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
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
