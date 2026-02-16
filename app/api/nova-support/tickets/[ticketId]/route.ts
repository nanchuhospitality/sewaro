import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request, { params }: { params: { ticketId: string } }) {
  const url = new URL(req.url)
  const token = String(url.searchParams.get('token') || '').trim()
  const ticketId = String(params.ticketId || '').trim()

  if (!ticketId || !token) {
    return NextResponse.json({ error: 'Missing ticket token.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: ticket, error: ticketError } = await supabase
    .from('nova_support_tickets')
    .select('id,ticket_code,business_name_snapshot,room,status,note,cart_json,subtotal_npr,delivery_charge_npr,total_npr,placed_order_id,last_activity_at,expires_at,created_at,resume_token')
    .eq('id', ticketId)
    .eq('resume_token', token)
    .maybeSingle()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Support ticket not found.' }, { status: 404 })
  }

  const { data: messages } = await supabase
    .from('nova_support_messages')
    .select('id,sender_type,message,created_at')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    ok: true,
    ticket: {
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      business_name_snapshot: ticket.business_name_snapshot,
      room: ticket.room,
      status: ticket.status,
      note: ticket.note,
      cart_json: ticket.cart_json,
      subtotal_npr: ticket.subtotal_npr,
      delivery_charge_npr: ticket.delivery_charge_npr,
      total_npr: ticket.total_npr,
      placed_order_id: ticket.placed_order_id,
      last_activity_at: ticket.last_activity_at,
      expires_at: ticket.expires_at,
      created_at: ticket.created_at,
    },
    messages: messages || [],
  })
}
