import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROOM_REGEX } from '@/lib/utils/constants'

type CreateNovaOrderBody = {
  business_id?: string
  room?: string | null
  source?: 'WHATSAPP' | 'OTP'
  note?: string | null
  customer_phone?: string | null
  items?: Array<{
    source?: 'DELIVERS' | 'MART'
    item_name?: string
    variant_name?: string | null
    quantity?: number
    unit_price_npr?: number
  }>
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null
  const cleaned = value.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+977')) return cleaned.slice(4)
  if (cleaned.startsWith('977')) return cleaned.slice(3)
  return cleaned
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = (await req.json()) as CreateNovaOrderBody

  const businessId = String(body.business_id || '').trim()
  const source = body.source === 'OTP' ? 'OTP' : body.source === 'WHATSAPP' ? 'WHATSAPP' : null
  const note = String(body.note || '').trim() || null
  const rawRoom = String(body.room || '').trim().toLowerCase()
  const room = rawRoom && ROOM_REGEX.test(rawRoom) ? rawRoom : null
  const customerPhone = normalizePhone(body.customer_phone)
  const items = Array.isArray(body.items) ? body.items : []

  if (!businessId || !source || items.length === 0) {
    return NextResponse.json({ error: 'Invalid order payload.' }, { status: 400 })
  }

  if (source === 'OTP' && (!customerPhone || !/^9\d{9}$/.test(customerPhone))) {
    return NextResponse.json({ error: 'Valid Nepali mobile number is required for OTP orders.' }, { status: 400 })
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,name,is_active,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_delivery_charge_npr,enable_nova_mart_menu,enable_nova_mart_ordering,nova_mart_delivery_charge_npr')
    .eq('id', businessId)
    .maybeSingle()

  if (businessError || !business || !business.is_active) {
    return NextResponse.json({ error: 'Ordering is not available for this business.' }, { status: 403 })
  }

  const normalizedItems = items
    .map((item) => ({
      source: item.source === 'MART' ? 'MART' : 'DELIVERS',
      item_name: String(item.item_name || '').trim(),
      variant_name: String(item.variant_name || '').trim() || null,
      quantity: Number(item.quantity),
      unit_price_npr: Number(item.unit_price_npr),
    }))
    .filter((item) => item.item_name && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isInteger(item.unit_price_npr) && item.unit_price_npr >= 0)

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: 'No valid items found.' }, { status: 400 })
  }

  const includesDelivers = normalizedItems.some((item) => item.source === 'DELIVERS')
  const includesMart = normalizedItems.some((item) => item.source === 'MART')
  if (includesDelivers && (!business.enable_nova_delivers_menu || !business.enable_nova_delivers_ordering)) {
    return NextResponse.json({ error: 'Nova Delivers ordering is not enabled for this business.' }, { status: 403 })
  }
  if (includesMart && (!business.enable_nova_mart_menu || !business.enable_nova_mart_ordering)) {
    return NextResponse.json({ error: 'Nova Mart ordering is not enabled for this business.' }, { status: 403 })
  }

  const subtotalNpr = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_price_npr, 0)
  const deliveryCandidates: number[] = []
  if (includesDelivers) deliveryCandidates.push(Number(business.nova_delivers_delivery_charge_npr || 0))
  if (includesMart) deliveryCandidates.push(Number(business.nova_mart_delivery_charge_npr || 0))
  const deliveryChargeNpr = Math.max(0, deliveryCandidates.length > 0 ? Math.max(...deliveryCandidates) : 0)
  const totalNpr = subtotalNpr + deliveryChargeNpr

  const { data: order, error: orderError } = await supabase
    .from('nova_orders')
    .insert({
      business_id: business.id,
      business_name_snapshot: business.name,
      room,
      source,
      status: 'NEW',
      customer_phone: customerPhone,
      note,
      subtotal_npr: subtotalNpr,
      delivery_charge_npr: deliveryChargeNpr,
      total_npr: totalNpr,
    })
    .select('id,order_code')
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Could not create order.' }, { status: 500 })
  }

  const orderItemsPayload = normalizedItems.map((item) => ({
    order_id: order.id,
    source: item.source,
    item_name: item.item_name,
    variant_name: item.variant_name,
    quantity: item.quantity,
    unit_price_npr: item.unit_price_npr,
    line_total_npr: item.quantity * item.unit_price_npr,
  }))

  const { error: itemsError } = await supabase.from('nova_order_items').insert(orderItemsPayload)
  if (itemsError) {
    await supabase.from('nova_orders').delete().eq('id', order.id)
    const schemaError = itemsError.message?.toLowerCase() || ''
    if (schemaError.includes('source')) {
      return NextResponse.json({ error: 'Order-item source schema is not up to date. Run migration 0030_add_nova_order_item_source.sql.' }, { status: 500 })
    }
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order_id: order.id, order_code: order.order_code })
}
