import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request, { params }: { params: { ticketId: string } }) {
  const body = (await req.json()) as { token?: string; message?: string }
  const token = String(body.token || '').trim()
  const message = String(body.message || '').trim()
  const ticketId = String(params.ticketId || '').trim()

  if (!ticketId || !token || !message) {
    return NextResponse.json({ error: 'Missing message payload.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: ticket, error: ticketError } = await supabase
    .from('nova_support_tickets')
    .select('id,status')
    .eq('id', ticketId)
    .eq('resume_token', token)
    .maybeSingle()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Support ticket not found.' }, { status: 404 })
  }
  if (ticket.status !== 'OPEN') {
    return NextResponse.json({ error: 'This support ticket is closed.' }, { status: 400 })
  }

  const { error: messageError } = await supabase.from('nova_support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'CUSTOMER',
    message,
  })
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })

  await supabase
    .from('nova_support_tickets')
    .update({
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)

  return NextResponse.json({ ok: true })
}
