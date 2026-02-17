'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { formatRoomLabel } from '@/lib/utils/rooms'
import { toTelHref } from '@/lib/utils/phone'
import { getRoomServiceStatus } from '@/lib/utils/roomServiceStatus'
import ContinueSupportBanner from '@/components/public/ContinueSupportBanner'

type Business = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  room_service_phone: string | null
  room_service_open_time: string | null
  room_service_close_time: string | null
  hours_text: string | null
  google_map_link: string | null
  show_review: boolean
}

type Category = {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  sort_order: number
}

type Item = {
  id: string
  category_id: string | null
  name: string
  price_npr: number
  description: string | null
  image_url: string | null
  is_available: boolean
  is_veg: boolean
  sort_order: number
}
type Variant = {
  id: string
  menu_item_id: string
  name: string
  price_npr: number
  is_active: boolean
  is_veg: boolean | null
  sort_order: number
}

type CartLine = {
  key: string
  source: 'DELIVERS' | 'MART'
  item_id: string
  variant_id: string | null
  item_name: string
  variant_name: string | null
  unit_price_npr: number
  quantity: number
}

function toAnchorSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function MenuView({
  business,
  categories,
  items,
  variants,
  room,
  menuTitle = 'In-Room Dinning Menu',
  serviceMessage = null,
  showServicePhone = true,
  showServiceHours = true,
  enableCart = false,
  deliveryChargeNpr = 0,
  whatsappPhone = null,
  showKitchenClosedPartnerBanner = false,
  showMartPartnerBanner = false,
  martMenuHref = null,
  partnerLabel = 'Nova Delivers',
  cartSource = 'DELIVERS',
  sharedPartnerCart = false,
  deliveryChargeBySource,
  showVegFilter = true,
  backHrefOverride = null,
}: {
  business: Business
  categories: Category[]
  items: Item[]
  variants: Variant[]
  room: string | null
  menuTitle?: string
  serviceMessage?: string | null
  showServicePhone?: boolean
  showServiceHours?: boolean
  enableCart?: boolean
  deliveryChargeNpr?: number
  whatsappPhone?: string | null
  showKitchenClosedPartnerBanner?: boolean
  showMartPartnerBanner?: boolean
  martMenuHref?: string | null
  partnerLabel?: string
  cartSource?: 'DELIVERS' | 'MART'
  sharedPartnerCart?: boolean
  deliveryChargeBySource?: Partial<Record<'DELIVERS' | 'MART', number>>
  showVegFilter?: boolean
  backHrefOverride?: string | null
}) {
  const [search, setSearch] = useState('')
  const [vegOnly, setVegOnly] = useState(false)
  const [cartLines, setCartLines] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [cartNote, setCartNote] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null)
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [otpPhone, setOtpPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [creatingHelpTicket, setCreatingHelpTicket] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false)
  const [isSharedCartHydrated, setIsSharedCartHydrated] = useState(!sharedPartnerCart)
  const categoryTabsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/log-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: business.slug, room }),
    }).catch(() => {})
  }, [business.slug, room])

  const variantsByItem = useMemo(() => {
    const map = new Map<string, Variant[]>()
    for (const item of items) map.set(item.id, [])
    for (const variant of variants) {
      if (!variant.is_active) continue
      if (!map.has(variant.menu_item_id)) map.set(variant.menu_item_id, [])
      map.get(variant.menu_item_id)!.push(variant)
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [items, variants])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const itemVariants = variantsByItem.get(item.id) || []
      if (showVegFilter && vegOnly) {
        if (itemVariants.length > 0) {
          const hasVegVariant = itemVariants.some((variant) => (variant.is_veg ?? item.is_veg) === true)
          if (!hasVegVariant) return false
        } else if (!item.is_veg) {
          return false
        }
      }
      if (!q) return true
      const inItem = item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
      const inVariants = itemVariants.some((variant) => variant.name.toLowerCase().includes(q))
      return inItem || inVariants
    })
  }, [items, search, vegOnly, variantsByItem, showVegFilter])

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const c of categories) map.set(c.id, [])
    for (const item of filteredItems) {
      if (!item.category_id) continue
      if (!map.has(item.category_id)) map.set(item.category_id, [])
      map.get(item.category_id)!.push(item)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [categories, filteredItems])

  const categoryAnchors = useMemo(() => {
    const counts = new Map<string, number>()
    const anchors = new Map<string, string>()

    for (const category of categories) {
      const base = toAnchorSlug(category.name) || 'category'
      const count = counts.get(base) || 0
      counts.set(base, count + 1)
      anchors.set(category.id, count === 0 ? base : `${base}-${count + 1}`)
    }

    return anchors
  }, [categories])

  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const category of categories) {
      if (!category.parent_id) continue
      if (!map.has(category.parent_id)) map.set(category.parent_id, [])
      map.get(category.parent_id)!.push(category)
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [categories])

  const categoryItemCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const category of categories) {
      map.set(category.id, (itemsByCategory.get(category.id) || []).length)
    }
    return map
  }, [categories, itemsByCategory])

  const orderedNavigableCategories = useMemo(() => {
    const ordered: Category[] = []
    const top = categories.filter((category) => !category.parent_id)
    for (const parent of top) {
      const parentCount = categoryItemCount.get(parent.id) || 0
      const children = childCategoriesByParent.get(parent.id) || []
      const childrenWithItems = children.filter((child) => (categoryItemCount.get(child.id) || 0) > 0)
      if (parentCount > 0) ordered.push(parent)
      ordered.push(...childrenWithItems)
    }
    return ordered
  }, [categories, childCategoriesByParent, categoryItemCount])

  const topLevelNavigableCategories = useMemo(() => {
    const top = categories.filter((category) => !category.parent_id)
    return top.filter((parent) => {
      const parentCount = categoryItemCount.get(parent.id) || 0
      const childHasItems = (childCategoriesByParent.get(parent.id) || []).some((child) => (categoryItemCount.get(child.id) || 0) > 0)
      return parentCount > 0 || childHasItems
    })
  }, [categories, categoryItemCount, childCategoriesByParent])

  const topLevelCategoryCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const parent of topLevelNavigableCategories) {
      const own = categoryItemCount.get(parent.id) || 0
      const childTotal = (childCategoriesByParent.get(parent.id) || []).reduce((sum, child) => sum + (categoryItemCount.get(child.id) || 0), 0)
      map.set(parent.id, own + childTotal)
    }
    return map
  }, [topLevelNavigableCategories, childCategoriesByParent, categoryItemCount])

  function scrollToCategory(categoryId: string) {
    const anchor = categoryAnchors.get(categoryId)
    if (!anchor) return
    const target = document.getElementById(anchor)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveCategoryId(categoryId)
    setAllCategoriesOpen(false)
  }

  useEffect(() => {
    if (!activeCategoryId && orderedNavigableCategories.length > 0) {
      setActiveCategoryId(orderedNavigableCategories[0].id)
    }
  }, [orderedNavigableCategories, activeCategoryId])

  useEffect(() => {
    if (orderedNavigableCategories.length === 0) return
    const observers: IntersectionObserver[] = []

    for (const category of orderedNavigableCategories) {
      const anchor = categoryAnchors.get(category.id)
      if (!anchor) continue
      const el = document.getElementById(anchor)
      if (!el) continue

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
          if (visible[0]) {
            setActiveCategoryId(category.id)
          }
        },
        {
          root: null,
          rootMargin: '-30% 0px -55% 0px',
          threshold: [0.1, 0.4, 0.7],
        }
      )
      observer.observe(el)
      observers.push(observer)
    }

    return () => {
      for (const observer of observers) observer.disconnect()
    }
  }, [orderedNavigableCategories, categoryAnchors])

  useEffect(() => {
    if (!activeCategoryId || !categoryTabsRef.current) return
    const tab = categoryTabsRef.current.querySelector<HTMLButtonElement>(`button[data-cat-tab="${activeCategoryId}"]`)
    if (!tab) return
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategoryId])

  const backHref = backHrefOverride || (room ? `/${business.slug}/${room}` : `/${business.slug}`)
  const roomLabel = room ? formatRoomLabel(room) : null
  const servicePhone = business.room_service_phone || business.phone
  const roomServiceHours =
    business.room_service_open_time && business.room_service_close_time
      ? `${business.room_service_open_time.slice(0, 5)} - ${business.room_service_close_time.slice(0, 5)}`
      : null
  const roomServiceStatus = getRoomServiceStatus(business.room_service_open_time, business.room_service_close_time)
  const lateNightPartnerHref = room ? `/${business.slug}/${room}/partner-menu` : `/${business.slug}/partner-menu`
  const sharedCartStorageKey = sharedPartnerCart ? `partner_cart:${business.id}:${room || 'general'}` : null

  useEffect(() => {
    if (!sharedPartnerCart || !sharedCartStorageKey) return
    try {
      const raw = localStorage.getItem(sharedCartStorageKey)
      if (!raw) {
        setIsSharedCartHydrated(true)
        return
      }
      const parsed = JSON.parse(raw) as { lines?: unknown[]; note?: unknown }
      const normalized: CartLine[] = Array.isArray(parsed.lines)
        ? parsed.lines
            .map((line) => {
              if (!line || typeof line !== 'object') return null
              const value = line as Record<string, unknown>
              const source = value.source === 'MART' ? 'MART' : 'DELIVERS'
              const key = typeof value.key === 'string' && value.key.length > 0 ? value.key : null
              const item_id = typeof value.item_id === 'string' ? value.item_id : ''
              const variant_id = typeof value.variant_id === 'string' ? value.variant_id : null
              const item_name = typeof value.item_name === 'string' ? value.item_name : ''
              const variant_name = typeof value.variant_name === 'string' ? value.variant_name : null
              const unit_price_npr = Number(value.unit_price_npr)
              const quantity = Number(value.quantity)
              if (!item_id || !item_name || !Number.isFinite(unit_price_npr) || !Number.isFinite(quantity) || quantity <= 0) return null
              return {
                key: key || `${source}:${item_id}::${variant_id || 'base'}`,
                source,
                item_id,
                variant_id,
                item_name,
                variant_name,
                unit_price_npr,
                quantity,
              } satisfies CartLine
            })
            .filter((line): line is CartLine => Boolean(line))
        : []
      setCartLines(normalized)
      setCartNote(typeof parsed.note === 'string' ? parsed.note : '')
    } catch {
      setCartLines([])
    } finally {
      setIsSharedCartHydrated(true)
    }
  }, [sharedPartnerCart, sharedCartStorageKey])

  useEffect(() => {
    if (!sharedPartnerCart || !sharedCartStorageKey || !isSharedCartHydrated) return
    localStorage.setItem(sharedCartStorageKey, JSON.stringify({ lines: cartLines, note: cartNote, savedAt: Date.now() }))
  }, [sharedPartnerCart, sharedCartStorageKey, isSharedCartHydrated, cartLines, cartNote])

  function addToCart(item: Item, variant: Variant | null) {
    const key = `${cartSource}:${item.id}::${variant?.id || 'base'}`
    setCartLines((prev) => {
      const idx = prev.findIndex((line) => line.key === key)
      if (idx >= 0) {
        return prev.map((line, lineIdx) =>
          lineIdx === idx ? { ...line, quantity: line.quantity + 1 } : line
        )
      }
      return [
        ...prev,
        {
          key,
          source: cartSource,
          item_id: item.id,
          variant_id: variant?.id || null,
          item_name: item.name,
          variant_name: variant?.name || null,
          unit_price_npr: variant?.price_npr ?? item.price_npr,
          quantity: 1,
        },
      ]
    })
  }

  function incrementCartLine(key: string) {
    setCartLines((prev) => prev.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line)))
  }

  function decrementCartLine(key: string) {
    setCartLines((prev) =>
      prev
        .map((line) => (line.key === key ? { ...line, quantity: Math.max(0, line.quantity - 1) } : line))
        .filter((line) => line.quantity > 0)
    )
  }

  function removeCartLine(key: string) {
    setCartLines((prev) => prev.filter((line) => line.key !== key))
  }

  const cartSummary = useMemo(() => {
    const count = cartLines.reduce((sum, line) => sum + line.quantity, 0)
    const subtotal = cartLines.reduce((sum, line) => sum + line.quantity * line.unit_price_npr, 0)
    const sourceCharges = deliveryChargeBySource || { DELIVERS: deliveryChargeNpr, MART: deliveryChargeNpr }
    const activeSources = new Set(cartLines.map((line) => line.source))
    const deliveryCandidates = Array.from(activeSources).map((source) => Number(sourceCharges[source] || 0))
    const delivery = count > 0 ? Math.max(0, deliveryCandidates.length > 0 ? Math.max(...deliveryCandidates) : deliveryChargeNpr) : 0
    const total = subtotal + delivery
    return { count, subtotal, delivery, total }
  }, [cartLines, deliveryChargeNpr, deliveryChargeBySource])

  const cartQtyByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of cartLines) {
      map.set(line.key, line.quantity)
    }
    return map
  }, [cartLines])

  const whatsappHref = useMemo(() => {
    if (!whatsappPhone) return null
    const digits = whatsappPhone.replace(/[^\d]/g, '')
    if (!digits) return null
    const roomPart = room ? ` and Room ${formatRoomLabel(room)}` : ''
    const text = `Hello ${partnerLabel} from ${business.name}${roomPart}`
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }, [whatsappPhone, business.name, room, partnerLabel])

  const orderWhatsappHref = useMemo(() => {
    if (!whatsappPhone || cartSummary.count === 0) return null
    const digits = whatsappPhone.replace(/[^\d]/g, '')
    if (!digits) return null

    const roomPart = room ? ` and Room ${formatRoomLabel(room)}` : ''
    const lines = cartLines.map((line) => {
      const label = line.variant_name ? `${line.item_name} (${line.variant_name})` : line.item_name
      return `${line.quantity} x ${label} = ${line.quantity * line.unit_price_npr}`
    })
    const noteText = cartNote.trim() ? `\nNote: ${cartNote.trim()}` : ''
    const text =
      `Hello ${partnerLabel} from ${business.name}${roomPart}\n\n` +
      `Order:\n${lines.join('\n')}\n\n` +
      `Subtotal: ${cartSummary.subtotal}\n` +
      `Delivery Charge: ${cartSummary.delivery}\n` +
      `Total: ${cartSummary.total}` +
      noteText

    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }, [whatsappPhone, cartSummary, cartLines, cartNote, business.name, room, partnerLabel])

  function normalizeNepaliPhone(value: string) {
    const cleaned = value.replace(/[^\d+]/g, '')
    if (cleaned.startsWith('+977')) return cleaned.slice(4)
    if (cleaned.startsWith('977')) return cleaned.slice(3)
    return cleaned
  }

  function isValidNepaliMobile(value: string) {
    const local = normalizeNepaliPhone(value)
    return /^9\d{9}$/.test(local)
  }

  async function placeOrder(source: 'WHATSAPP' | 'OTP') {
    if (cartLines.length === 0) {
      setCheckoutStatus('Cart is empty.')
      return null
    }

    setPlacingOrder(true)
    setCheckoutStatus(null)
    try {
      const res = await fetch('/api/nova-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          room,
          source,
          note: cartNote,
          customer_phone: source === 'OTP' ? otpPhone : null,
          items: cartLines.map((line) => ({
            source: line.source,
            item_name: line.item_name,
            variant_name: line.variant_name,
            quantity: line.quantity,
            unit_price_npr: line.unit_price_npr,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCheckoutStatus(data?.error || 'Could not place order.')
        return null
      }

      const orderCode = String(data.order_code || '').trim()
      setCheckoutStatus(orderCode ? `Order placed: ${orderCode}` : 'Order placed.')
      setCartLines([])
      setCartNote('')
      setCartOpen(false)
      return { orderCode }
    } catch {
      setCheckoutStatus('Could not place order.')
      return null
    } finally {
      setPlacingOrder(false)
    }
  }

  async function createHelpTicket() {
    if (cartLines.length === 0) {
      setCheckoutStatus('Cart is empty.')
      return
    }

    setCreatingHelpTicket(true)
    setCheckoutStatus(null)
    try {
      const res = await fetch('/api/nova-support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          room,
          note: cartNote,
          items: cartLines.map((line) => ({
            item_name: line.item_name,
            variant_name: line.variant_name,
            quantity: line.quantity,
            unit_price_npr: line.unit_price_npr,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCheckoutStatus(data?.error || 'Could not create help ticket.')
        return
      }

      const ticketId = String(data.ticket_id || '')
      const token = String(data.resume_token || '')
      const ticketCode = String(data.ticket_code || '')
      if (!ticketId || !token) {
        setCheckoutStatus('Could not create help ticket.')
        return
      }

      const resumeKey = `support_ticket:${business.id}:${room || 'general'}`
      localStorage.setItem(resumeKey, JSON.stringify({ ticketId, token, savedAt: Date.now() }))
      setCheckoutStatus(ticketCode ? `Help ticket created: ${ticketCode}` : 'Help ticket created.')
      window.location.href = `/support/${ticketId}?token=${encodeURIComponent(token)}`
    } catch {
      setCheckoutStatus('Could not create help ticket.')
    } finally {
      setCreatingHelpTicket(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <ContinueSupportBanner businessId={business.id} room={room} />
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <a href={backHref} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700">
            ←
          </a>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{menuTitle}</p>
            {roomLabel && <p className="text-xs text-slate-500">Room {roomLabel}</p>}
          </div>
        </div>
        {serviceMessage ? (
          <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{serviceMessage}</p>
        ) : null}
        {showServicePhone && servicePhone && !serviceMessage && (
          <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Please call{' '}
            <a href={toTelHref(servicePhone)} className="font-semibold underline-offset-2 hover:underline">
              {servicePhone}
            </a>{' '}
            to place your order with your selected items.
          </p>
        )}
        {showServiceHours && roomServiceHours && (
          <p className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            Hours: <span className="font-semibold">{roomServiceHours}</span>{' '}
            <span className={roomServiceStatus.isOpen ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
              ({roomServiceStatus.isOpen ? 'Open' : 'Closed'})
            </span>
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            placeholder="Search menu"
          />
          {showVegFilter ? (
            <button
              type="button"
              onClick={() => setVegOnly((current) => !current)}
              className={clsx(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-2 text-sm',
                vegOnly
                  ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800'
                  : 'border-slate-300 bg-white font-medium text-slate-700'
              )}
              aria-pressed={vegOnly}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                </span>
                <span>Veg</span>
              </span>
              {vegOnly && (
                <span
                  role="button"
                  aria-label="Clear veg filter"
                  onClick={(e) => {
                    e.stopPropagation()
                    setVegOnly(false)
                  }}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-xs leading-none text-emerald-800 hover:bg-emerald-100"
                >
                  ✕
                </span>
              )}
            </button>
          ) : null}
        </div>
        {showVegFilter && vegOnly && <p className="mt-2 text-xs font-medium text-emerald-700">Showing veg items only</p>}
      </section>

      {showKitchenClosedPartnerBanner && !roomServiceStatus.isOpen ? (
        <a href={lateNightPartnerHref} className="mt-4 block overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1800&q=80"
              alt="Food delivery rider and order handoff"
              className="h-44 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-slate-900/20" />
            <div className="absolute inset-y-0 left-0 flex max-w-[90%] items-center p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-200">Hotel Kitchen Closed</p>
                <p className="mt-1 text-lg font-semibold text-white">Order From Late-Night Partner</p>
                <p className="mt-1 text-xs text-slate-100">Tap to continue with fast food delivery from our partner menu.</p>
              </div>
            </div>
          </div>
        </a>
      ) : null}

      {showMartPartnerBanner ? (
        <a href={martMenuHref || '#'} className="mt-4 block overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
          <div className="relative">
            <img
              src="/images/midnight-mart-banner.svg"
              alt="Midnight convenience mart essentials"
              className="h-40 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/85 via-slate-900/65 to-slate-900/25" />
            <div className="absolute inset-y-0 left-0 flex w-full items-center p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-200">Midnight Mart</p>
                <p className="mt-1 text-lg font-semibold text-white">Open For Late-Night Essentials</p>
                <p className="mt-1 text-xs text-slate-100">Pharmacy &amp; Wellness | Alcohol | Midnight Cravings | More</p>
              </div>
            </div>
          </div>
        </a>
      ) : null}

      <div className="sticky top-0 z-20 mt-4 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAllCategoriesOpen(true)}
            className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            All ({orderedNavigableCategories.length})
          </button>
          <div ref={categoryTabsRef} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {topLevelNavigableCategories.map((category) => {
              const selected = activeCategoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  data-cat-tab={category.id}
                  onClick={() => scrollToCategory(category.id)}
                  className={clsx(
                    'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {category.name}
                  <span className={clsx('ml-1 text-xs', selected ? 'text-slate-200' : 'text-slate-500')}>
                    {topLevelCategoryCount.get(category.id) || 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {allCategoriesOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-900/35 p-4" onClick={() => setAllCategoriesOpen(false)}>
          <div
            className="mx-auto mt-14 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:mt-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Browse Categories</p>
                <p className="text-xs text-slate-500">Jump to any menu section</p>
              </div>
              <button
                type="button"
                onClick={() => setAllCategoriesOpen(false)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {orderedNavigableCategories.map((category) => {
                const isChild = Boolean(category.parent_id)
                const selected = activeCategoryId === category.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => scrollToCategory(category.id)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left',
                      isChild ? 'ml-4 w-[calc(100%-1rem)]' : '',
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <span className={clsx('font-medium', isChild ? 'text-sm' : 'text-sm')}>{category.name}</span>
                    <span className={clsx('text-xs', selected ? 'text-slate-200' : 'text-slate-500')}>{categoryItemCount.get(category.id) || 0}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-8">
        {categories
          .filter((category) => !category.parent_id)
          .map((category) => {
            const catItems = itemsByCategory.get(category.id) || []
            const childCategories = childCategoriesByParent.get(category.id) || []
            const hasChildItems = childCategories.some((child) => (itemsByCategory.get(child.id) || []).length > 0)
            if (catItems.length === 0 && !hasChildItems) return null

            const renderItem = (item: Item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const itemVariants = variantsByItem.get(item.id) || []
                        const effectiveTypes = new Set(
                          itemVariants.map((variant) => (variant.is_veg ?? item.is_veg) ? 'veg' : 'nonveg')
                        )
                        if (effectiveTypes.size === 0) effectiveTypes.add(item.is_veg ? 'veg' : 'nonveg')
                        const showVeg = effectiveTypes.has('veg')
                        const showNonVeg = effectiveTypes.has('nonveg')

                        const vegIcon = (
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center border border-emerald-600"
                            aria-label="Vegetarian"
                            title="Vegetarian"
                          >
                            <span className="h-2 w-2 rounded-full bg-emerald-600" />
                          </span>
                        )
                        const nonVegIcon = (
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center border border-red-600"
                            aria-label="Non-vegetarian"
                            title="Non-vegetarian"
                          >
                            <span
                              className="h-0 w-0 border-l-[5px] border-r-[5px] border-b-[9px] border-l-transparent border-r-transparent border-b-red-600"
                              style={{ transform: 'translateY(-1px)' }}
                            />
                          </span>
                        )

                        if (showVeg && showNonVeg) return null

                        return <span className="inline-flex items-center gap-1">{showVeg ? vegIcon : nonVegIcon}</span>
                      })()}
                      <h3 className="font-medium">{item.name}</h3>
                      {!item.is_available && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Sold out</span>
                      )}
                    </div>
                    {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                    {(variantsByItem.get(item.id) || []).length > 0 ? (
                      <div className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="space-y-1.5">
                          {(variantsByItem.get(item.id) || [])
                            .filter((variant) => !vegOnly || (variant.is_veg ?? item.is_veg) === true)
                            .map((variant) => {
                              const effectiveVeg = variant.is_veg ?? item.is_veg
                              return (
                                <div key={variant.id} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-sm">
                                  <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                                    <span
                                      className={clsx(
                                        'inline-flex h-3.5 w-3.5 items-center justify-center border',
                                        effectiveVeg ? 'border-emerald-600' : 'border-red-600'
                                      )}
                                      aria-label={effectiveVeg ? 'Vegetarian' : 'Non-vegetarian'}
                                      title={effectiveVeg ? 'Vegetarian' : 'Non-vegetarian'}
                                    >
                                      {effectiveVeg ? (
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                      ) : (
                                        <span
                                          className="h-0 w-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-red-600"
                                          style={{ transform: 'translateY(-1px)' }}
                                        />
                                      )}
                                    </span>
                                    {variant.name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-semibold text-slate-900">{variant.price_npr}</span>
                                    {enableCart && item.is_available ? (
                                      (() => {
                                        const key = `${cartSource}:${item.id}::${variant.id}`
                                        const qty = cartQtyByKey.get(key) || 0
                                        if (qty === 0) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => addToCart(item, variant)}
                                              aria-label={`Add ${item.name} ${variant.name}`}
                                              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                                            >
                                              <span aria-hidden="true" className="inline-flex items-center gap-1 leading-none">
                                                <span className="text-sm">+</span>
                                                <span>Add</span>
                                              </span>
                                            </button>
                                          )
                                        }
                                        return (
                                          <div className="inline-flex items-center gap-3 rounded border border-slate-300 px-3 py-1 text-sm">
                                            <button
                                              type="button"
                                              onClick={() => decrementCartLine(key)}
                                              className="font-semibold text-slate-700"
                                              aria-label={`Decrease ${item.name} ${variant.name}`}
                                            >
                                              -
                                            </button>
                                            <span className="min-w-5 text-center font-semibold text-slate-800">{qty}</span>
                                            <button
                                              type="button"
                                              onClick={() => incrementCartLine(key)}
                                              className="font-semibold text-slate-700"
                                              aria-label={`Increase ${item.name} ${variant.name}`}
                                            >
                                              +
                                            </button>
                                          </div>
                                        )
                                      })()
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-base font-semibold">{item.price_npr}</p>
                        {enableCart && item.is_available ? (
                          (() => {
                            const key = `${cartSource}:${item.id}::base`
                            const qty = cartQtyByKey.get(key) || 0
                            if (qty === 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item, null)}
                                  aria-label={`Add ${item.name}`}
                                  className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                                >
                                  <span aria-hidden="true" className="inline-flex items-center gap-1 leading-none">
                                    <span className="text-sm">+</span>
                                    <span>Add</span>
                                  </span>
                                </button>
                              )
                            }
                            return (
                              <div className="inline-flex items-center gap-3 rounded border border-slate-300 px-3 py-1 text-sm">
                                <button
                                  type="button"
                                  onClick={() => decrementCartLine(key)}
                                  className="font-semibold text-slate-700"
                                  aria-label={`Decrease ${item.name}`}
                                >
                                  -
                                </button>
                                <span className="min-w-5 text-center font-semibold text-slate-800">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => incrementCartLine(key)}
                                  className="font-semibold text-slate-700"
                                  aria-label={`Increase ${item.name}`}
                                >
                                  +
                                </button>
                              </div>
                            )
                          })()
                        ) : null}
                      </div>
                    )}
                  </div>
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className={clsx('h-20 w-20 rounded-lg border border-slate-200 object-cover', !item.is_available && 'opacity-50')}
                    />
                  )}
                </div>
              </article>
            )

            return (
              <section key={category.id} id={categoryAnchors.get(category.id)} className="scroll-mt-20">
                <h2 className="mb-2 text-lg font-semibold text-slate-900">{category.name}</h2>
                {category.description && <p className="mb-2 text-sm text-slate-600">{category.description}</p>}
                <div className="mb-3 h-px w-full bg-slate-200" />

                {catItems.length > 0 && <div className="space-y-3">{catItems.map(renderItem)}</div>}

                {childCategories.map((child) => {
                  const childItems = itemsByCategory.get(child.id) || []
                  if (childItems.length === 0) return null
                  return (
                    <div key={child.id} id={categoryAnchors.get(child.id)} className={clsx(catItems.length > 0 ? 'mt-5' : '')}>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-3 border-l-2 border-slate-300 pl-3">
                          <h3 className="text-base font-semibold text-slate-800">{child.name}</h3>
                          {child.description && <p className="mt-1 text-sm text-slate-600">{child.description}</p>}
                        </div>
                        <div className="space-y-3">{childItems.map(renderItem)}</div>
                      </div>
                    </div>
                  )
                })}
              </section>
            )
          })}
      </div>

      {enableCart && cartSummary.count > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setCartOpen((open) => !open)}
            className="fixed bottom-4 left-1/2 z-30 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-left text-sm text-white shadow-lg"
          >
            <span className="font-semibold">{cartSummary.count} item(s)</span>
            <span className="ml-2 text-slate-200">in cart</span>
            <span className="float-right font-semibold">{cartSummary.total}</span>
          </button>

          {cartOpen ? (
            <div className="fixed inset-0 z-40 bg-slate-900/30 p-3 md:p-4" onClick={() => setCartOpen(false)}>
              <div
                className="mx-auto mt-10 flex max-h-[calc(100vh-5.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:mt-16"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex shrink-0 items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Cart</h3>
                  <button type="button" onClick={() => setCartOpen(false)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {cartLines.map((line) => (
                    <div key={line.key} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-slate-900">{line.item_name}</p>
                          {line.variant_name ? <p className="break-words text-sm text-slate-600">{line.variant_name}</p> : null}
                          <p className="text-sm font-semibold text-slate-800">
                            {line.quantity} x {line.unit_price_npr} = {line.quantity * line.unit_price_npr}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <button type="button" onClick={() => decrementCartLine(line.key)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">-</button>
                          <span className="min-w-5 text-center text-sm font-medium">{line.quantity}</span>
                          <button type="button" onClick={() => incrementCartLine(line.key)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">+</button>
                          <button
                            type="button"
                            onClick={() => removeCartLine(line.key)}
                            aria-label={`Remove ${line.item_name}${line.variant_name ? ` ${line.variant_name}` : ''} from cart`}
                            title="Remove"
                            className="rounded border border-red-300 px-2 py-1 text-sm font-semibold leading-none text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 shrink-0 space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <label htmlFor="cart-note" className="mb-1 block text-sm text-slate-700">
                      Note
                    </label>
                    <textarea
                      id="cart-note"
                      value={cartNote}
                      onChange={(e) => setCartNote(e.target.value)}
                      placeholder="Add note for your order"
                      rows={2}
                      className="w-full resize-none rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-900"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-700">Subtotal</p>
                    <p className="text-sm font-medium text-slate-900">{cartSummary.subtotal}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-700">Delivery Charge</p>
                    <p className="text-sm font-medium text-slate-900">{cartSummary.delivery}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
                    <p className="text-sm font-medium text-slate-700">Total</p>
                    <p className="text-base font-semibold text-slate-900">{cartSummary.total}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutStatus(null)
                      setShowOtpForm(false)
                      setOtpSent(false)
                      setOtpCode('')
                      setOtpPhone('')
                      setCheckoutOpen(true)
                    }}
                    className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Place Order
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 fill-current">
            <path d="M19.1 17.3c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.8.2-.2.3-.9 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.2-1.3-.8-.7-1.3-1.6-1.4-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.5.1-.2 0-.4 0-.5s-.8-1.9-1.1-2.6c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.7 1.1 2.9.2.2 2 3.1 4.8 4.3.7.3 1.2.5 1.6.7.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4 0-.2-.3-.3-.6-.5zM16 3.2C9.1 3.2 3.5 8.7 3.5 15.5c0 2.2.6 4.3 1.7 6.1L3.2 28l6.6-1.9c1.8 1 3.8 1.6 6 1.6 6.9 0 12.5-5.5 12.5-12.3 0-6.8-5.5-12.2-12.3-12.2zm0 22.2c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-3.9 1.1 1.1-3.8-.3-.4c-1.1-1.7-1.7-3.6-1.7-5.6 0-5.8 4.8-10.6 10.7-10.6 5.9 0 10.6 4.7 10.6 10.5 0 5.8-4.8 10.5-10.7 10.5z" />
          </svg>
        </a>
      ) : null}

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4" onClick={() => setCheckoutOpen(false)}>
          <div
            className="mx-auto mt-24 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">Complete Order</h3>
            <p className="mt-1 text-sm text-slate-600">Choose how to proceed</p>
            <div className="mt-3 space-y-2">
              {orderWhatsappHref ? (
                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={async () => {
                    const result = await placeOrder('WHATSAPP')
                    if (!result) return
                    window.open(orderWhatsappHref, '_blank', 'noopener,noreferrer')
                    setCheckoutOpen(false)
                  }}
                  className="block w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placingOrder ? 'Placing...' : 'Open via WhatsApp'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="block w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                >
                  Open via WhatsApp
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCheckoutStatus(null)
                  setShowOtpForm(true)
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                OTP Verification
              </button>

              {showOtpForm ? (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700">Nepali number only</p>
                  <div className="flex items-center rounded border border-slate-300 bg-white">
                    <span className="border-r border-slate-200 px-2 py-2 text-sm text-slate-600">+977</span>
                    <input
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="98XXXXXXXX"
                      className="w-full px-2 py-2 text-sm outline-none"
                    />
                  </div>
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isValidNepaliMobile(otpPhone)) {
                          setCheckoutStatus('Enter a valid Nepali mobile number.')
                          return
                        }
                        setOtpSent(true)
                        setCheckoutStatus('OTP sent (UI only).')
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Send OTP
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        className="w-full rounded border border-slate-300 px-2 py-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        disabled={placingOrder}
                        onClick={() => {
                          if (!/^\d{6}$/.test(otpCode)) {
                            setCheckoutStatus('Enter a valid 6-digit OTP.')
                            return
                          }
                          setCheckoutStatus('OTP verified.')
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Verify OTP
                      </button>
                      <button
                        type="button"
                        disabled={placingOrder}
                        onClick={async () => {
                          if (!/^\d{6}$/.test(otpCode)) {
                            setCheckoutStatus('Verify OTP first.')
                            return
                          }
                          await placeOrder('OTP')
                        }}
                        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {placingOrder ? 'Placing...' : 'Place via OTP'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {checkoutStatus ? <p className="text-xs text-slate-600">{checkoutStatus}</p> : null}
              <button
                type="button"
                disabled={creatingHelpTicket || placingOrder}
                onClick={createHelpTicket}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingHelpTicket ? 'Creating help ticket...' : '💬 Need Help Ordering?'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
