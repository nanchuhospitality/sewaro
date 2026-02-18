'use client'

import { FormEvent, useMemo, useState } from 'react'
import type { NovaMenuOption } from '@/lib/utils/novaMenu'

type HotelOption = {
  id: string
  name: string
  google_business_map_link: string | null
  google_map_link: string | null
}

type ActionResult = { success?: boolean; error?: string }
type ManualOrderLine = {
  key: string
  source: 'DELIVERS' | 'MART'
  item_name: string
  variant_name: string | null
  unit_price_npr: number
  quantity: number
}

export default function ManualOrderCreateForm({
  hotels,
  options,
  onSubmitAction,
}: {
  hotels: HotelOption[]
  options: NovaMenuOption[]
  onSubmitAction: (formData: FormData) => Promise<ActionResult>
}) {
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [hotelQuery, setHotelQuery] = useState('')
  const [mapLink, setMapLink] = useState('')
  const [query, setQuery] = useState('')
  const [cartLines, setCartLines] = useState<ManualOrderLine[]>([])
  const [deliveryCharge, setDeliveryCharge] = useState(0)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)

  const selectedHotel = useMemo(
    () => hotels.find((hotel) => hotel.id === selectedHotelId) || null,
    [hotels, selectedHotelId]
  )
  const hotelMatches = useMemo(() => {
    const q = hotelQuery.trim().toLowerCase()
    if (!q) return hotels.slice(0, 8)
    return hotels.filter((hotel) => hotel.name.toLowerCase().includes(q)).slice(0, 8)
  }, [hotels, hotelQuery])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 10)
    return options.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 10)
  }, [options, query])
  const cartSubtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity * line.unit_price_npr, 0),
    [cartLines]
  )

  function addOptionToCart(option: NovaMenuOption) {
    const source: 'DELIVERS' | 'MART' = option.key.startsWith('MART::') ? 'MART' : 'DELIVERS'
    const normalizedKey = option.key
    setCartLines((prev) => {
      const idx = prev.findIndex((line) => line.key === normalizedKey)
      if (idx >= 0) {
        return prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [
        ...prev,
        {
          key: normalizedKey,
          source,
          item_name: option.itemName,
          variant_name: option.variantName || null,
          unit_price_npr: option.unitPriceNpr,
          quantity: 1,
        },
      ]
    })
    setQuery('')
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (cartLines.length === 0) {
      setStatus({ type: 'error', message: 'Add at least one item from POS selection.' })
      return
    }
    setPending(true)
    setStatus(null)
    try {
      const formData = new FormData(form)
      formData.set('business_id', selectedHotelId)
      formData.set('hotel_google_map_link', mapLink)
      formData.set('items_json', JSON.stringify(cartLines))
      const res = await onSubmitAction(formData)
      if (res.error) {
        setStatus({ type: 'error', message: res.error })
        return
      }
      setStatus({ type: 'success', message: 'Manual order created.' })
      form.reset()
      setSelectedHotelId('')
      setHotelQuery('')
      setMapLink('')
      setCartLines([])
      setQuery('')
      setDeliveryCharge(0)
      setOpen(false)
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Could not create manual order.'
      setStatus({ type: 'error', message: msg })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Create Manual Order</p>
          <p className="mt-1 text-xs text-slate-600">For direct calls/WhatsApp requests to Nova Delivers.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {open ? 'Close' : 'Create Manual Order'}
        </button>
      </div>

      {status ? <p className={`mt-2 text-xs ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{status.message}</p> : null}

      {open ? (
        <form onSubmit={onSubmit} className="mt-3">
          <div className="grid gap-2 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Hotel from database (search)</label>
          <input
            value={hotelQuery}
            onChange={(e) => {
              setHotelQuery(e.target.value)
              if (!e.target.value.trim()) {
                setSelectedHotelId('')
                setMapLink('')
              }
            }}
            placeholder="Search hotel name..."
            className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
          {hotelMatches.length > 0 ? (
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-1.5">
              {hotelMatches.map((hotel) => (
                <button
                  key={hotel.id}
                  type="button"
                  onClick={() => {
                    setSelectedHotelId(hotel.id)
                    setHotelQuery(hotel.name)
                    const autoMap = String(hotel.google_business_map_link || hotel.google_map_link || '').trim()
                    setMapLink(autoMap)
                  }}
                  className="block w-full rounded bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  {hotel.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">No matching hotel. Continue with custom hotel name below.</p>
          )}
          {selectedHotel ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Selected: {selectedHotel.name}{' '}
              <button
                type="button"
                onClick={() => {
                  setSelectedHotelId('')
                  setHotelQuery('')
                  setMapLink('')
                }}
                className="underline"
              >
                clear
              </button>
            </p>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Custom hotel name (if not listed)</label>
          <input
            name="custom_hotel_name"
            placeholder="Enter hotel name when not found in database"
            className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Google Maps link (required)</label>
          <input
            name="hotel_google_map_link"
            value={mapLink}
            onChange={(e) => setMapLink(e.target.value)}
            placeholder={selectedHotel ? 'Auto-filled from hotel profile (editable)' : 'https://maps.google.com/...'}
            className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Room number</label>
          <input name="room" required placeholder="e.g. 305A" className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Customer phone</label>
          <input
            name="customer_phone"
            required
            placeholder="98XXXXXXXX"
            className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2 rounded border border-slate-200 bg-white p-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Item Selection</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item/variant..."
            className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
          {matches.length > 0 ? (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-1.5">
              {matches.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => addOptionToCart(option)}
                  className="block w-full rounded bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="md:col-span-2 rounded border border-slate-200 bg-white p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Items</p>
          {cartLines.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No items selected yet.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {cartLines.map((line) => (
                <div key={line.key} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">
                        {line.item_name}
                        {line.variant_name ? ` (${line.variant_name})` : ''}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {line.quantity} x {line.unit_price_npr} = {line.quantity * line.unit_price_npr}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCartLines((prev) =>
                            prev
                              .map((row) => (row.key === line.key ? { ...row, quantity: Math.max(0, row.quantity - 1) } : row))
                              .filter((row) => row.quantity > 0)
                          )
                        }
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700"
                      >
                        -
                      </button>
                      <span className="min-w-5 text-center text-xs font-semibold text-slate-700">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCartLines((prev) =>
                            prev.map((row) => (row.key === line.key ? { ...row, quantity: row.quantity + 1 } : row))
                          )
                        }
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setCartLines((prev) => prev.filter((row) => row.key !== line.key))}
                        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700"
                      >
                        x
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-xs font-semibold text-slate-800">
                <span>Subtotal</span>
                <span>{cartSubtotal}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span>Delivery</span>
                <span>{deliveryCharge}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold text-slate-900">
                <span>Total</span>
                <span>{cartSubtotal + deliveryCharge}</span>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Delivery charge</label>
          <input
            name="delivery_charge_npr"
            type="number"
            min={0}
            value={deliveryCharge}
            onChange={(e) => setDeliveryCharge(Math.max(0, Number(e.target.value || 0)))}
            className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</label>
          <textarea name="note" rows={2} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" />
        </div>
          </div>
          <button disabled={pending} className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? 'Creating...' : 'Submit Manual Order'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
