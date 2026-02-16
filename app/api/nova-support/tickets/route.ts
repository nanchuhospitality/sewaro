import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROOM_REGEX } from '@/lib/utils/constants'

type CreateTicketBody = {
  business_id?: string
  room?: string | null
  note?: string | null
  customer_phone?: string | null
  items?: Array<{
    item_name?: string
    variant_name?: string | null
    quantity?: number
    unit_price_npr?: number
  }>
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = (await req.json()) as CreateTicketBody

  const businessId = String(body.business_id || '').trim()
  const note = String(body.note || '').trim() || null
  const rawRoom = String(body.room || '').trim().toLowerCase()
  const room = rawRoom && ROOM_REGEX.test(rawRoom) ? rawRoom : null
  const customerPhone = String(body.customer_phone || '').trim() || null
  const items = Array.isArray(body.items) ? body.items : []

  if (!businessId || items.length === 0) {
    return NextResponse.json({ error: 'Invalid support payload.' }, { status: 400 })
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,name,is_active,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_delivery_charge_npr')
    .eq('id', businessId)
    .maybeSingle()

  if (businessError || !business || !business.is_active || !business.enable_nova_delivers_menu || !business.enable_nova_delivers_ordering) {
    return NextResponse.json({ error: 'Support is not available for this business.' }, { status: 403 })
  }

  const normalizedItems = items
    .map((item) => ({
      item_name: String(item.item_name || '').trim(),
      variant_name: String(item.variant_name || '').trim() || null,
      quantity: Number(item.quantity),
      unit_price_npr: Number(item.unit_price_npr),
    }))
    .filter((item) => item.item_name && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isInteger(item.unit_price_npr) && item.unit_price_npr >= 0)

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: 'No valid items found.' }, { status: 400 })
  }

  const subtotalNpr = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_price_npr, 0)
  const deliveryChargeNpr = Math.max(0, Number(business.nova_delivers_delivery_charge_npr || 0))
  const totalNpr = subtotalNpr + deliveryChargeNpr

  const { data: ticket, error: ticketError } = await supabase
    .from('nova_support_tickets')
    .insert({
      business_id: business.id,
      business_name_snapshot: business.name,
      room,
      status: 'OPEN',
      customer_phone: customerPhone,
      note,
      cart_json: normalizedItems,
      subtotal_npr: subtotalNpr,
      delivery_charge_npr: deliveryChargeNpr,
      total_npr: totalNpr,
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id,ticket_code,resume_token')
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: ticketError?.message || 'Could not create support ticket.' }, { status: 500 })
  }

  await supabase.from('nova_support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'SYSTEM',
    message: 'Support ticket created.',
  })

  return NextResponse.json({
    ok: true,
    ticket_id: ticket.id,
    ticket_code: ticket.ticket_code,
    resume_token: ticket.resume_token,
  })
}
