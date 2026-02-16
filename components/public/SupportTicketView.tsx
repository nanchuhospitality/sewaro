'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type Ticket = {
  id: string
  ticket_code: string
  business_name_snapshot: string
  room: string | null
  status: 'OPEN' | 'PLACED' | 'CANCELLED' | 'CLOSED_TIMEOUT'
  note: string | null
  cart_json: Array<{
    item_name?: string
    variant_name?: string | null
    quantity?: number
    unit_price_npr?: number
  }>
  subtotal_npr: number
  delivery_charge_npr: number
  total_npr: number
  placed_order_id: string | null
  expires_at: string
  created_at: string
}

type Message = {
  id: string
  sender_type: 'CUSTOMER' | 'OPS' | 'SYSTEM'
  message: string
  created_at: string
}

export default function SupportTicketView({ ticketId, token }: { ticketId: string; token: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)

  async function loadTicket() {
    const res = await fetch(`/api/nova-support/tickets/${ticketId}?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setStatus(data?.error || 'Could not load support ticket.')
      setLoading(false)
      return
    }
    setTicket(data.ticket)
    setMessages(data.messages || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTicket().catch(() => {
      setStatus('Could not load support ticket.')
      setLoading(false)
    })

    const timer = setInterval(() => {
      loadTicket().catch(() => {})
    }, 10000)

    return () => clearInterval(timer)
  }, [ticketId, token])

  const canSend = useMemo(() => ticket?.status === 'OPEN', [ticket?.status])

  async function onSendMessage(e: FormEvent) {
    e.preventDefault()
    if (!messageInput.trim() || !canSend) return
    setSending(true)
    setStatus(null)
    const res = await fetch(`/api/nova-support/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, message: messageInput.trim() }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) {
      setStatus(data?.error || 'Could not send message.')
      return
    }
    setMessageInput('')
    await loadTicket()
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading support ticket...</p>
  }

  if (!ticket) {
    return <p className="text-sm text-red-600">{status || 'Support ticket not found.'}</p>
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-3 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Need Help Ordering</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ticket {ticket.ticket_code} • {ticket.business_name_snapshot}
          {ticket.room ? ` • Room ${ticket.room}` : ''}
        </p>
        <p className="mt-1 text-xs text-slate-500">Status: {ticket.status}</p>
        <p className="mt-1 text-xs text-slate-500">Expires: {new Date(ticket.expires_at).toLocaleString()}</p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Chat</h2>
        <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.sender_type === 'CUSTOMER'
                  ? 'ml-auto bg-slate-900 text-white'
                  : msg.sender_type === 'OPS'
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              <p>{msg.message}</p>
              <p className="mt-1 text-[11px] opacity-75">{new Date(msg.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <form onSubmit={onSendMessage} className="mt-3 flex gap-2">
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            disabled={!canSend || sending}
            placeholder={canSend ? 'Type your message...' : 'Ticket is closed'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!canSend || sending || !messageInput.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </form>
        {status ? <p className="mt-2 text-xs text-slate-600">{status}</p> : null}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Summary</h2>
        <div className="mt-3 space-y-1.5">
          {(Array.isArray(ticket.cart_json) ? ticket.cart_json : []).map((item, idx) => {
            const itemName = String(item?.item_name || '').trim()
            const variantName = String(item?.variant_name || '').trim()
            const quantity = Number(item?.quantity || 0)
            const unitPrice = Number(item?.unit_price_npr || 0)
            if (!itemName || !Number.isFinite(quantity) || quantity <= 0) return null
            return (
              <div key={`${ticket.id}-item-${idx}`} className="flex items-center justify-between text-sm">
                <p className="text-slate-700">
                  {quantity} x {itemName}
                  {variantName ? ` (${variantName})` : ''}
                </p>
                <p className="font-medium text-slate-900">{quantity * unitPrice}</p>
              </div>
            )
          })}
        </div>
        {ticket.note ? <p className="mt-1 text-sm text-slate-600">Note: {ticket.note}</p> : null}
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-center justify-between text-slate-700">
            <span>Subtotal</span>
            <span>{ticket.subtotal_npr}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span>Delivery</span>
            <span>{ticket.delivery_charge_npr}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>Total</span>
            <span>{ticket.total_npr}</span>
          </div>
        </div>
      </section>
    </main>
  )
}
