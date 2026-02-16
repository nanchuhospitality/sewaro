'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendSupportTicketMessage } from '@/actions/ops'

export default function SupportReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return

    setSending(true)
    setError(null)
    const fd = new FormData()
    fd.set('ticket_id', ticketId)
    fd.set('message', trimmed)
    const res = await sendSupportTicketMessage(fd)
    setSending(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setMessage('')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-1">
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Reply to customer..."
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          disabled={sending || !message.trim()}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  )
}
