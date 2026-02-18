'use client'

import { useMemo, useState } from 'react'
import type { NovaMenuOption } from '@/lib/utils/novaMenu'

export default function NovaMenuItemPicker({
  options,
  submitLabel = 'Add',
  disabled = false,
}: {
  options: NovaMenuOption[]
  submitLabel?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [itemName, setItemName] = useState('')
  const [variantName, setVariantName] = useState('')
  const [itemSource, setItemSource] = useState<'DELIVERS' | 'MART'>('DELIVERS')
  const [quantity, setQuantity] = useState(1)
  const [unitPriceNpr, setUnitPriceNpr] = useState(0)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 8)
    return options
      .filter((option) => option.label.toLowerCase().includes(q))
      .slice(0, 8)
  }, [options, query])

  function applyOption(option: NovaMenuOption) {
    setItemSource(option.key.startsWith('MART::') ? 'MART' : 'DELIVERS')
    setItemName(option.itemName)
    setVariantName(option.variantName)
    setUnitPriceNpr(option.unitPriceNpr)
    setQuery(option.label)
  }

  return (
    <div className="grid grid-cols-1 gap-1">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Nova menu item..."
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      {matches.length > 0 ? (
        <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-1">
          {matches.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => applyOption(option)}
              className="block w-full rounded bg-white px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <input
        name="item_name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        required
        placeholder="Item name"
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <input
        name="variant_name"
        value={variantName}
        onChange={(e) => setVariantName(e.target.value)}
        placeholder="Variant (optional)"
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <input type="hidden" name="item_source" value={itemSource} />
      <div className="grid grid-cols-2 gap-1">
        <input
          name="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
          required
          className="rounded border border-slate-300 px-2 py-1 text-xs"
        />
        <input
          name="unit_price_npr"
          type="number"
          min={0}
          value={unitPriceNpr}
          onChange={(e) => setUnitPriceNpr(Math.max(0, Number(e.target.value || 0)))}
          required
          className="rounded border border-slate-300 px-2 py-1 text-xs"
        />
      </div>
      <button
        disabled={disabled}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  )
}
