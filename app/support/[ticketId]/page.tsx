import { notFound } from 'next/navigation'
import SupportTicketView from '@/components/public/SupportTicketView'

export default function SupportTicketPage({
  params,
  searchParams,
}: {
  params: { ticketId: string }
  searchParams?: { token?: string }
}) {
  const ticketId = String(params.ticketId || '').trim()
  const token = String(searchParams?.token || '').trim()

  if (!ticketId || !token) notFound()

  return <SupportTicketView ticketId={ticketId} token={token} />
}
