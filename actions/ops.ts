'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/requireRole'
import { friendlyError } from '@/lib/utils/errors'
import { ROOM_REGEX } from '@/lib/utils/constants'

const ALLOWED_STATUSES = new Set(['NEW', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
const ITEM_EDITABLE_ORDER_STATUSES = new Set(['NEW', 'ACCEPTED'])

async function assertOrderItemsEditable(
  supabase: Awaited<ReturnType<typeof requireRole>>['supabase'],
  orderId: string
) {
  const { data: order, error } = await supabase
    .from('nova_orders')
    .select('id,status')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) return { error: friendlyError(error?.message || 'Order not found.') }
  if (!ITEM_EDITABLE_ORDER_STATUSES.has(order.status)) {
    return { error: 'Order items cannot be edited once order is PREPARING or beyond.' }
  }

  return { order }
}

async function recalcNovaOrderTotals(supabase: Awaited<ReturnType<typeof requireRole>>['supabase'], orderId: string) {
  const { data: order } = await supabase
    .from('nova_orders')
    .select('id,delivery_charge_npr')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return

  const { data: items } = await supabase
    .from('nova_order_items')
    .select('line_total_npr')
    .eq('order_id', orderId)

  const subtotal = (items || []).reduce((sum, item) => sum + Number(item.line_total_npr || 0), 0)
  const delivery = Math.max(0, Number(order.delivery_charge_npr || 0))
  const total = subtotal + delivery

  await supabase
    .from('nova_orders')
    .update({ subtotal_npr: subtotal, total_npr: total, updated_at: new Date().toISOString() })
    .eq('id', orderId)
}

async function recalcSupportTicketTotals(supabase: Awaited<ReturnType<typeof requireRole>>['supabase'], ticketId: string) {
  const { data: ticket } = await supabase
    .from('nova_support_tickets')
    .select('id,delivery_charge_npr,cart_json')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) return

  const items = Array.isArray(ticket.cart_json) ? ticket.cart_json : []
  const subtotal = items.reduce((sum: number, item: any) => {
    const qty = Number(item?.quantity || 0)
    const unit = Number(item?.unit_price_npr || 0)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) return sum
    return sum + qty * unit
  }, 0)
  const delivery = Math.max(0, Number(ticket.delivery_charge_npr || 0))
  const total = subtotal + delivery

  await supabase
    .from('nova_support_tickets')
    .update({ subtotal_npr: subtotal, total_npr: total, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
}

function normalizeNepaliPhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+977')) return cleaned.slice(4)
  if (cleaned.startsWith('977')) return cleaned.slice(3)
  return cleaned
}

export async function createManualNovaOrder(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const businessId = String(formData.get('business_id') || '').trim() || null
  const customHotelName = String(formData.get('custom_hotel_name') || '').trim()
  const rawRoom = String(formData.get('room') || '').trim().toLowerCase()
  const room = rawRoom && ROOM_REGEX.test(rawRoom) ? rawRoom : null
  const phoneRaw = String(formData.get('customer_phone') || '').trim()
  const customerPhone = normalizeNepaliPhone(phoneRaw)
  const providedMapLink = String(formData.get('hotel_google_map_link') || '').trim()
  const rawManualDelivery = String(formData.get('delivery_charge_npr') || '').trim()
  const note = String(formData.get('note') || '').trim() || null

  const rawItemsJson = String(formData.get('items_json') || '').trim()
  const parsedItems = rawItemsJson
    ? (() => {
        try {
          const parsed = JSON.parse(rawItemsJson)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })()
    : []

  const normalizedItems = parsedItems
    .map((item: any) => ({
      source: item?.source === 'MART' ? 'MART' : 'DELIVERS',
      item_name: String(item?.item_name || '').trim(),
      variant_name: String(item?.variant_name || '').trim() || null,
      quantity: Number(item?.quantity),
      unit_price_npr: Number(item?.unit_price_npr),
    }))
    .filter(
      (item: any) =>
        item.item_name &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isInteger(item.unit_price_npr) &&
        item.unit_price_npr >= 0
    )

  if (!room || !ROOM_REGEX.test(room)) return { error: 'Valid room number is required.' }
  if (!customerPhone || !/^9\d{9}$/.test(customerPhone)) return { error: 'Valid Nepali mobile number is required.' }
  if (normalizedItems.length === 0) return { error: 'At least one valid item is required.' }

  let businessNameSnapshot = ''
  let deliveryChargeNpr = 0
  let resolvedMapLink = providedMapLink

  if (businessId) {
    let businessRes = await supabase
      .from('businesses')
      .select('id,name,is_active,nova_delivers_delivery_charge_npr,nova_mart_delivery_charge_npr,google_business_map_link,google_map_link')
      .eq('id', businessId)
      .maybeSingle()
    const businessSchemaError = businessRes.error?.message?.toLowerCase() || ''
    if (businessRes.error && businessSchemaError.includes('nova_mart_delivery_charge_npr')) {
      businessRes = await supabase
        .from('businesses')
        .select('id,name,is_active,nova_delivers_delivery_charge_npr,google_business_map_link,google_map_link')
        .eq('id', businessId)
        .maybeSingle()
    }
    const business = businessRes.data as any
    if (businessRes.error || !business || !business.is_active) return { error: 'Selected hotel is not available.' }
    businessNameSnapshot = business.name
    const hasDeliversItems = normalizedItems.some((item) => item.source === 'DELIVERS')
    const hasMartItems = normalizedItems.some((item) => item.source === 'MART')
    const deliveryCandidates: number[] = []
    if (hasDeliversItems) deliveryCandidates.push(Number(business.nova_delivers_delivery_charge_npr || 0))
    if (hasMartItems) deliveryCandidates.push(Number((business as any).nova_mart_delivery_charge_npr || 0))
    deliveryChargeNpr = Math.max(0, deliveryCandidates.length > 0 ? Math.max(...deliveryCandidates) : 0)
    if (!resolvedMapLink) {
      resolvedMapLink = String(business.google_business_map_link || business.google_map_link || '').trim()
    }
  } else {
    if (!customHotelName) return { error: 'Hotel name is required when hotel is not selected from database.' }
    businessNameSnapshot = customHotelName
    deliveryChargeNpr = 0
  }

  if (!resolvedMapLink) return { error: 'Google Maps link is required.' }

  if (rawManualDelivery) {
    const manualDelivery = Number(rawManualDelivery)
    if (!Number.isInteger(manualDelivery) || manualDelivery < 0) {
      return { error: 'Delivery charge must be a non-negative whole number.' }
    }
    deliveryChargeNpr = manualDelivery
  }

  const subtotalNpr = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_price_npr, 0)
  const totalNpr = subtotalNpr + deliveryChargeNpr

  const { data: order, error: orderError } = await supabase
    .from('nova_orders')
    .insert({
      business_id: businessId,
      business_name_snapshot: businessNameSnapshot,
      hotel_google_map_link: resolvedMapLink,
      room,
      source: 'DIRECT',
      status: 'NEW',
      customer_phone: customerPhone,
      note,
      subtotal_npr: subtotalNpr,
      delivery_charge_npr: deliveryChargeNpr,
      total_npr: totalNpr,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (orderError || !order) {
    const schemaError = orderError?.message?.toLowerCase() || ''
    if (
      schemaError.includes('hotel_google_map_link') ||
      schemaError.includes('nova_orders_source_check') ||
      schemaError.includes('business_id') && schemaError.includes('null')
    ) {
      return { error: 'Manual order schema is not up to date. Run migration 0029_add_manual_order_fields.sql.' }
    }
    return { error: friendlyError(orderError?.message || 'Could not create manual order.') }
  }

  const { error: itemsError } = await supabase.from('nova_order_items').insert(
    normalizedItems.map((item) => ({
      order_id: order.id,
      item_name: item.item_name,
      variant_name: item.variant_name,
      quantity: item.quantity,
      unit_price_npr: item.unit_price_npr,
      line_total_npr: item.quantity * item.unit_price_npr,
    }))
  )
  if (itemsError) {
    await supabase.from('nova_orders').delete().eq('id', order.id)
    return { error: friendlyError(itemsError.message) }
  }

  revalidatePath('/ops/orders')
  return { success: true }
}

export async function updateNovaOrderStatus(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const orderId = String(formData.get('order_id') || '').trim()
  const status = String(formData.get('status') || '').trim().toUpperCase()

  if (!orderId) return { error: 'Missing order id.' }
  if (!ALLOWED_STATUSES.has(status)) return { error: 'Invalid order status.' }

  const { error } = await supabase
    .from('nova_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/ops/orders')
  return { success: true }
}

export async function updateNovaOrderDetails(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const orderId = String(formData.get('order_id') || '').trim()
  const rawRoom = String(formData.get('room') || '').trim().toLowerCase()
  const room = rawRoom ? (ROOM_REGEX.test(rawRoom) ? rawRoom : null) : null
  const note = String(formData.get('note') || '').trim() || null
  const customerPhone = String(formData.get('customer_phone') || '').trim() || null

  if (!orderId) return { error: 'Missing order id.' }
  if (rawRoom && !room) return { error: 'Invalid room format.' }

  const { error } = await supabase
    .from('nova_orders')
    .update({
      room,
      note,
      customer_phone: customerPhone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/ops/orders')
  return { success: true }
}

export async function updateNovaOrderItem(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const orderItemId = String(formData.get('order_item_id') || '').trim()
  const orderId = String(formData.get('order_id') || '').trim()
  const itemName = String(formData.get('item_name') || '').trim()
  const variantName = String(formData.get('variant_name') || '').trim() || null
  const quantity = Number(formData.get('quantity'))
  const unitPrice = Number(formData.get('unit_price_npr'))

  if (!orderItemId || !orderId) return { error: 'Missing order item id.' }
  if (!itemName) return { error: 'Item name is required.' }
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Quantity must be a positive whole number.' }
  if (!Number.isInteger(unitPrice) || unitPrice < 0) return { error: 'Unit price must be a non-negative whole number.' }

  const editable = await assertOrderItemsEditable(supabase, orderId)
  if ('error' in editable) return { error: editable.error }

  const { error } = await supabase
    .from('nova_order_items')
    .update({
      item_name: itemName,
      variant_name: variantName,
      quantity,
      unit_price_npr: unitPrice,
      line_total_npr: quantity * unitPrice,
    })
    .eq('id', orderItemId)
    .eq('order_id', orderId)

  if (error) return { error: friendlyError(error.message) }

  await recalcNovaOrderTotals(supabase, orderId)
  revalidatePath('/ops/orders')
  return { success: true }
}

export async function addNovaOrderItem(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const orderId = String(formData.get('order_id') || '').trim()
  const itemName = String(formData.get('item_name') || '').trim()
  const variantName = String(formData.get('variant_name') || '').trim() || null
  const quantity = Number(formData.get('quantity'))
  const unitPrice = Number(formData.get('unit_price_npr'))

  if (!orderId) return { error: 'Missing order id.' }
  if (!itemName) return { error: 'Item name is required.' }
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Quantity must be a positive whole number.' }
  if (!Number.isInteger(unitPrice) || unitPrice < 0) return { error: 'Unit price must be a non-negative whole number.' }

  const editable = await assertOrderItemsEditable(supabase, orderId)
  if ('error' in editable) return { error: editable.error }

  const { error } = await supabase.from('nova_order_items').insert({
    order_id: orderId,
    item_name: itemName,
    variant_name: variantName,
    quantity,
    unit_price_npr: unitPrice,
    line_total_npr: quantity * unitPrice,
  })
  if (error) return { error: friendlyError(error.message) }

  await recalcNovaOrderTotals(supabase, orderId)
  revalidatePath('/ops/orders')
  return { success: true }
}

export async function deleteNovaOrderItem(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const orderItemId = String(formData.get('order_item_id') || '').trim()
  const orderId = String(formData.get('order_id') || '').trim()
  if (!orderItemId || !orderId) return { error: 'Missing order item id.' }

  const editable = await assertOrderItemsEditable(supabase, orderId)
  if ('error' in editable) return { error: editable.error }

  const { error } = await supabase
    .from('nova_order_items')
    .delete()
    .eq('id', orderItemId)
    .eq('order_id', orderId)

  if (error) return { error: friendlyError(error.message) }

  await recalcNovaOrderTotals(supabase, orderId)
  revalidatePath('/ops/orders')
  return { success: true }
}

export async function sendSupportTicketMessage(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const ticketId = String(formData.get('ticket_id') || '').trim()
  const message = String(formData.get('message') || '').trim()
  if (!ticketId || !message) return { error: 'Missing message.' }

  const { error: messageError } = await supabase.from('nova_support_messages').insert({
    ticket_id: ticketId,
    sender_type: 'OPS',
    message,
  })
  if (messageError) return { error: friendlyError(messageError.message) }

  const { error: ticketError } = await supabase
    .from('nova_support_tickets')
    .update({
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
  if (ticketError) return { error: friendlyError(ticketError.message) }

  revalidatePath('/ops/orders')
  return { success: true }
}

export async function addSupportTicketItem(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const ticketId = String(formData.get('ticket_id') || '').trim()
  const itemName = String(formData.get('item_name') || '').trim()
  const variantName = String(formData.get('variant_name') || '').trim() || null
  const quantity = Number(formData.get('quantity'))
  const unitPrice = Number(formData.get('unit_price_npr'))

  if (!ticketId) return { error: 'Missing ticket id.' }
  if (!itemName) return { error: 'Item name is required.' }
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Quantity must be a positive whole number.' }
  if (!Number.isInteger(unitPrice) || unitPrice < 0) return { error: 'Unit price must be a non-negative whole number.' }

  const { data: ticket, error: ticketError } = await supabase
    .from('nova_support_tickets')
    .select('id,status,cart_json')
    .eq('id', ticketId)
    .maybeSingle()
  if (ticketError || !ticket) return { error: friendlyError(ticketError?.message || 'Support ticket not found.') }
  if (ticket.status !== 'OPEN') return { error: 'Only open support tickets can be edited.' }

  const cartItems = Array.isArray(ticket.cart_json) ? ticket.cart_json : []
  const nextCartItems = [
    ...cartItems,
    {
      item_name: itemName,
      variant_name: variantName,
      quantity,
      unit_price_npr: unitPrice,
    },
  ]

  const { error } = await supabase
    .from('nova_support_tickets')
    .update({
      cart_json: nextCartItems,
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
  if (error) return { error: friendlyError(error.message) }

  await recalcSupportTicketTotals(supabase, ticketId)
  await supabase.from('nova_support_messages').insert({
    ticket_id: ticketId,
    sender_type: 'SYSTEM',
    message: `Ops added item: ${itemName}${variantName ? ` (${variantName})` : ''}.`,
  })

  revalidatePath('/ops/support')
  return { success: true }
}

export async function cancelSupportTicket(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const ticketId = String(formData.get('ticket_id') || '').trim()
  if (!ticketId) return { error: 'Missing ticket id.' }

  const { data: ticket, error: fetchError } = await supabase
    .from('nova_support_tickets')
    .select('id,status')
    .eq('id', ticketId)
    .maybeSingle()
  if (fetchError || !ticket) return { error: friendlyError(fetchError?.message || 'Support ticket not found.') }
  if (ticket.status !== 'OPEN') return { error: 'Only open support tickets can be cancelled.' }

  const { error } = await supabase
    .from('nova_support_tickets')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', ticketId)
  if (error) return { error: friendlyError(error.message) }

  await supabase.from('nova_support_messages').insert({
    ticket_id: ticketId,
    sender_type: 'SYSTEM',
    message: 'Support ticket cancelled by Central Ops.',
  })

  revalidatePath('/ops/orders')
  return { success: true }
}

export async function placeSupportTicketOrder(formData: FormData) {
  const { supabase } = await requireRole('CENTRAL_OPS')

  const ticketId = String(formData.get('ticket_id') || '').trim()
  if (!ticketId) return { error: 'Missing ticket id.' }

  const { data: ticket, error: ticketError } = await supabase
    .from('nova_support_tickets')
    .select('id,business_id,business_name_snapshot,room,customer_phone,note,subtotal_npr,delivery_charge_npr,total_npr,status,cart_json')
    .eq('id', ticketId)
    .maybeSingle()
  if (ticketError || !ticket) return { error: friendlyError(ticketError?.message || 'Support ticket not found.') }
  if (ticket.status !== 'OPEN') return { error: 'Only open support tickets can be placed.' }

  const cartItems = Array.isArray(ticket.cart_json) ? ticket.cart_json : []
  const normalizedItems = cartItems
    .map((item: any) => ({
      item_name: String(item.item_name || '').trim(),
      variant_name: String(item.variant_name || '').trim() || null,
      quantity: Number(item.quantity),
      unit_price_npr: Number(item.unit_price_npr),
    }))
    .filter((item: any) => item.item_name && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isInteger(item.unit_price_npr) && item.unit_price_npr >= 0)

  if (normalizedItems.length === 0) return { error: 'Support ticket has no valid items.' }

  const { data: order, error: orderError } = await supabase
    .from('nova_orders')
    .insert({
      business_id: ticket.business_id,
      business_name_snapshot: ticket.business_name_snapshot,
      room: ticket.room,
      source: 'HELP_CHAT',
      status: 'NEW',
      customer_phone: ticket.customer_phone,
      note: ticket.note,
      subtotal_npr: ticket.subtotal_npr,
      delivery_charge_npr: ticket.delivery_charge_npr,
      total_npr: ticket.total_npr,
      updated_at: new Date().toISOString(),
    })
    .select('id,order_code')
    .single()
  if (orderError || !order) return { error: friendlyError(orderError?.message || 'Could not create order.') }

  const { error: itemsError } = await supabase.from('nova_order_items').insert(
    normalizedItems.map((item: any) => ({
      order_id: order.id,
      item_name: item.item_name,
      variant_name: item.variant_name,
      quantity: item.quantity,
      unit_price_npr: item.unit_price_npr,
      line_total_npr: item.quantity * item.unit_price_npr,
    })),
  )
  if (itemsError) return { error: friendlyError(itemsError.message) }

  const { error: updateTicketError } = await supabase
    .from('nova_support_tickets')
    .update({ status: 'PLACED', placed_order_id: order.id, updated_at: new Date().toISOString() })
    .eq('id', ticket.id)
  if (updateTicketError) return { error: friendlyError(updateTicketError.message) }

  await supabase.from('nova_support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'SYSTEM',
    message: `Order placed by Central Ops (${order.order_code}).`,
  })

  revalidatePath('/ops/orders')
  return { success: true }
}
