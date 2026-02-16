'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type ActiveTicket = {
  ticketId: string
  token: string
  ticketCode: string
}

export default function ContinueSupportBanner({
  businessId,
  room,
  className = '',
}: {
  businessId: string
  room: string | null
  className?: string
}) {
  const [activeTicket, setActiveTicket] = useState<ActiveTicket | null>(null)
  const key = useMemo(() => `support_ticket:${businessId}:${room || 'general'}`, [businessId, room])

  useEffect(() => {
    let mounted = true

    async function syncTicket() {
      const saved = localStorage.getItem(key)
      if (!saved) {
        if (mounted) setActiveTicket(null)
        return
      }

      try {
        const parsed = JSON.parse(saved) as { ticketId?: string; token?: string }
        const ticketId = String(parsed?.ticketId || '').trim()
        const token = String(parsed?.token || '').trim()
        if (!ticketId || !token) {
          localStorage.removeItem(key)
          if (mounted) setActiveTicket(null)
          return
        }

        const res = await fetch(`/api/nova-support/tickets/${ticketId}?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok || !data?.ticket || data.ticket.status !== 'OPEN') {
          localStorage.removeItem(key)
          if (mounted) setActiveTicket(null)
          return
        }

        if (mounted) {
          setActiveTicket({
            ticketId,
            token,
            ticketCode: String(data.ticket.ticket_code || '').trim(),
          })
        }
      } catch {
        localStorage.removeItem(key)
        if (mounted) setActiveTicket(null)
      }
    }

    syncTicket().catch(() => {})
    const timer = setInterval(() => {
      syncTicket().catch(() => {})
    }, 10000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [key])

  if (!activeTicket) return null

  return (
    <div className={`mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${className}`}>
      <Link href={`/support/${activeTicket.ticketId}?token=${encodeURIComponent(activeTicket.token)}`} className="font-semibold hover:underline">
        Continue Chat
      </Link>
      {activeTicket.ticketCode ? <span className="ml-2 text-xs text-amber-800">({activeTicket.ticketCode})</span> : null}
    </div>
  )
}
