'use client'

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import StorageUploader from '@/components/dashboard/StorageUploader'
import { getNovaDeliversMenu, getNovaMartMenu, saveNovaDeliversMenu, saveNovaMartMenu } from '@/actions/novaMenu'

type Category = {
  id: string
  name: string
  description: string
  parent_id: string | null
  sort_order: number
  is_active: boolean
}

type Item = {
  id: string
  name: string
  category_id: string | null
  price_npr: number
  description: string
  image_url: string
  is_available: boolean
  is_veg: boolean
  sort_order: number
}

type Variant = {
  id: string
  menu_item_id: string
  name: string
  price_npr: number
  is_veg: boolean
  is_active: boolean
  sort_order: number
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current.trim())
  return values
}

function parseVeg(value: string | null | undefined, fallback = true) {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (['veg', 'vegetarian', 'v', 'true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['non-veg', 'non veg', 'nonveg', 'n', 'false', '0', 'no'].includes(normalized)) return false
  return fallback
}

function SortableCategoryCard({
  category,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dropIndicatorPosition,
  children,
}: {
  category: Category
  isDragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDrop: (targetId: string) => void
  dropIndicatorPosition: 'before' | 'after' | null
  children: React.ReactNode
}) {
  return (
    <div
      className={`relative rounded-xl border bg-white p-4 shadow-sm ${isDragging ? 'border-slate-400 opacity-70' : 'border-slate-200'}`}
      onDragOver={onDragOver}
      onDrop={() => onDrop(category.id)}
    >
      {dropIndicatorPosition === 'before' ? <div className="pointer-events-none absolute -top-1 left-3 right-3 h-1 rounded bg-sky-500" /> : null}
      {dropIndicatorPosition === 'after' ? <div className="pointer-events-none absolute -bottom-1 left-3 right-3 h-1 rounded bg-sky-500" /> : null}
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">
          {category.parent_id ? <span className="mr-1 text-slate-400">↳</span> : null}
          {category.name}
        </p>
        <button
          type="button"
          draggable
          onDragStart={() => onDragStart(category.id)}
          onDragEnd={onDragEnd}
          className="cursor-grab rounded border border-slate-300 px-2 py-1 text-xs active:cursor-grabbing"
        >
          Drag
        </button>
      </div>
      {children}
    </div>
  )
}

function ItemRow({
  item,
  variants,
  categoryId,
  isVegEnabled,
  isDraggingItem,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
  dropIndicatorPosition,
  onStatus,
  onUpdateItem,
  onDeleteItem,
  onCreateVariant,
  onUpdateVariant,
  onDeleteVariant,
}: {
  item: Item
  variants: Variant[]
  categoryId: string
  isVegEnabled: boolean
  isDraggingItem: boolean
  onItemDragStart: (id: string) => void
  onItemDragEnd: () => void
  onItemDragOver: (e: DragEvent<HTMLDivElement>) => void
  onItemDrop: (targetId: string) => void
  dropIndicatorPosition: 'before' | 'after' | null
  onStatus: (status: { type: 'error' | 'success'; message: string } | null) => void
  onUpdateItem: (id: string, data: Partial<Item>) => void
  onDeleteItem: (id: string) => void
  onCreateVariant: (itemId: string, data: { name: string; price_npr: number; is_veg: boolean }) => void
  onUpdateVariant: (id: string, data: Partial<Variant>) => void
  onDeleteVariant: (id: string) => void
}) {
  const [imageUrl, setImageUrl] = useState(item.image_url || '')
  const addVariantFormRef = useRef<HTMLFormElement>(null)

  return (
    <div
      className={`relative rounded-lg border p-3 ${isDraggingItem ? 'border-slate-400 opacity-70' : 'border-slate-200'}`}
      onDragOver={onItemDragOver}
      onDrop={() => onItemDrop(item.id)}
    >
      {dropIndicatorPosition === 'before' ? <div className="pointer-events-none absolute -top-1 left-2 right-2 h-1 rounded bg-sky-500" /> : null}
      {dropIndicatorPosition === 'after' ? <div className="pointer-events-none absolute -bottom-1 left-2 right-2 h-1 rounded bg-sky-500" /> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onStatus(null)
          const fd = new FormData(e.currentTarget)
          const name = String(fd.get('name') || '').trim()
          const price = Number(fd.get('price_npr'))
          if (!name) return onStatus({ type: 'error', message: 'Item name is required.' })
          if (!Number.isInteger(price) || price < 0) return onStatus({ type: 'error', message: 'Price must be non-negative integer.' })

          onUpdateItem(item.id, {
            name,
            category_id: categoryId,
            price_npr: price,
            description: String(fd.get('description') || '').trim(),
            image_url: imageUrl.trim(),
            is_available: String(fd.get('is_available') || 'true') === 'true',
            is_veg: isVegEnabled ? String(fd.get('is_veg') || 'true') === 'true' : item.is_veg,
          })
          onStatus({ type: 'success', message: 'Item updated (UI only).' })
        }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <input name="name" defaultValue={item.name} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          <button
            type="button"
            draggable
            onDragStart={() => onItemDragStart(item.id)}
            onDragEnd={onItemDragEnd}
            className="cursor-grab rounded border border-slate-300 px-2 py-1 text-xs active:cursor-grabbing"
          >
            Drag
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="price_npr" defaultValue={item.price_npr} type="number" min={0} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <select name="is_available" defaultValue={String(item.is_available)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="true">Available</option>
            <option value="false">Sold out</option>
          </select>
        </div>
        {isVegEnabled ? (
          <select name="is_veg" defaultValue={String(item.is_veg)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="true">Veg</option>
            <option value="false">Non-Veg</option>
          </select>
        ) : null}
        <input
          name="description"
          defaultValue={item.description || ''}
          placeholder="Description"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <StorageUploader folder="items" onUploaded={(url) => setImageUrl(url)} />
        <div className="flex gap-2">
          <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Save</button>
          <button
            type="button"
            onClick={() => {
              onDeleteItem(item.id)
              onStatus({ type: 'success', message: 'Item deleted (UI only).' })
            }}
            className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
          >
            Delete
          </button>
        </div>
      </form>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <p className="mb-2 text-xs font-semibold text-slate-700">Variants</p>
        <div className="space-y-2">
          {variants.map((variant) => (
            <form
              key={variant.id}
              onSubmit={(e) => {
                e.preventDefault()
                onStatus(null)
                const fd = new FormData(e.currentTarget)
                const name = String(fd.get('name') || '').trim()
                const price = Number(fd.get('price_npr'))
                if (!name) return onStatus({ type: 'error', message: 'Variant name is required.' })
                if (!Number.isInteger(price) || price < 0) return onStatus({ type: 'error', message: 'Variant price must be non-negative integer.' })

                onUpdateVariant(variant.id, {
                  name,
                  price_npr: price,
                  is_veg: isVegEnabled ? String(fd.get('is_veg') || 'true') === 'true' : variant.is_veg,
                  is_active: String(fd.get('is_active') || 'true') === 'true',
                })
                onStatus({ type: 'success', message: 'Variant updated (UI only).' })
              }}
              className={`grid gap-2 rounded border border-slate-200 bg-white p-2 ${isVegEnabled ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}
            >
              <input name="name" defaultValue={variant.name} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              <input name="price_npr" defaultValue={variant.price_npr} type="number" min={0} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              {isVegEnabled ? (
                <select name="is_veg" defaultValue={String(variant.is_veg)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="true">Veg</option>
                  <option value="false">Non-Veg</option>
                </select>
              ) : null}
              <select name="is_active" defaultValue={String(variant.is_active)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="true">Active</option>
                <option value="false">Hidden</option>
              </select>
              <div className="flex gap-2">
                <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Save</button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteVariant(variant.id)
                    onStatus({ type: 'success', message: 'Variant deleted (UI only).' })
                  }}
                  className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
                >
                  Delete
                </button>
              </div>
            </form>
          ))}
        </div>
        <form
          ref={addVariantFormRef}
          onSubmit={(e) => {
            e.preventDefault()
            onStatus(null)
            const fd = new FormData(e.currentTarget)
            const name = String(fd.get('name') || '').trim()
            const price = Number(fd.get('price_npr'))
            const isVeg = isVegEnabled ? String(fd.get('is_veg') || 'true') === 'true' : item.is_veg
            if (!name) return onStatus({ type: 'error', message: 'Variant name is required.' })
            if (!Number.isInteger(price) || price < 0) return onStatus({ type: 'error', message: 'Variant price must be non-negative integer.' })

            onCreateVariant(item.id, { name, price_npr: price, is_veg: isVeg })
            addVariantFormRef.current?.reset()
            onStatus({ type: 'success', message: 'Variant created (UI only).' })
          }}
          className={`mt-2 grid gap-2 rounded border border-dashed border-slate-300 p-2 ${isVegEnabled ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
        >
          <input name="name" required placeholder="Variant name" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <input name="price_npr" required type="number" min={0} placeholder="Variant price" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          {isVegEnabled ? (
            <select name="is_veg" defaultValue="true" className="rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="true">Veg</option>
              <option value="false">Non-Veg</option>
            </select>
          ) : null}
          <button className="rounded bg-slate-800 px-3 py-1 text-xs text-white">Add variant</button>
        </form>
      </div>
    </div>
  )
}

export default function SuperadminMenuPage() {
  const searchParams = useSearchParams()
  const queryProgram = (searchParams.get('program') || 'delivers').toLowerCase()
  const [program, setProgram] = useState<'DELIVERS' | 'MART'>(queryProgram === 'mart' ? 'MART' : 'DELIVERS')
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [importErrors, setImportErrors] = useState<Array<{ rowNo: number; message: string }>>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemImage, setItemImage] = useState('')
  const [itemVeg, setItemVeg] = useState(true)
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null)
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [categoryDropTarget, setCategoryDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const [itemDropTarget, setItemDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const isVegEnabled = program === 'DELIVERS'

  useEffect(() => {
    setProgram(queryProgram === 'mart' ? 'MART' : 'DELIVERS')
  }, [queryProgram])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setStatus(null)
    const loader = program === 'DELIVERS' ? getNovaDeliversMenu : getNovaMartMenu
    const programLabel = program === 'DELIVERS' ? 'Nova Delivers' : 'Nova Mart'

    loader()
      .then((data) => {
        if (!active) return
        setCategories(data.categories || [])
        setItems(data.items || [])
        setVariants(data.variants || [])
        if ('warning' in data && data.warning) {
          setStatus({ type: 'error', message: data.warning })
        } else if ('error' in data && data.error) {
          setStatus({ type: 'error', message: data.error })
        }
      })
      .catch(() => {
        if (!active) return
        setStatus({ type: 'error', message: `Failed to load ${programLabel} menu.` })
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [program])

  async function onSaveMenu() {
    setStatus(null)
    setIsSaving(true)
    const saver = program === 'DELIVERS' ? saveNovaDeliversMenu : saveNovaMartMenu
    const programLabel = program === 'DELIVERS' ? 'Nova Delivers' : 'Nova Mart'
    const result = await saver({ categories, items, variants })
    setIsSaving(false)
    if ('error' in result) {
      setStatus({ type: 'error', message: result.error || `Failed to save ${programLabel} menu.` })
      return
    }
    setStatus({ type: 'success', message: `${programLabel} menu saved.` })
  }

  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, Item[]>()
    for (const category of categories) {
      grouped.set(category.id, items.filter((it) => it.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order))
    }
    return grouped
  }, [categories, items])

  const variantsByItem = useMemo(() => {
    const grouped = new Map<string, Variant[]>()
    for (const variant of variants) {
      if (!grouped.has(variant.menu_item_id)) grouped.set(variant.menu_item_id, [])
      grouped.get(variant.menu_item_id)!.push(variant)
    }
    for (const list of grouped.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return grouped
  }, [variants])

  const categoriesForDisplay = useMemo(() => {
    const topLevel = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order)
    const childrenByParent = new Map<string, Category[]>()
    for (const category of categories) {
      if (!category.parent_id) continue
      if (!childrenByParent.has(category.parent_id)) childrenByParent.set(category.parent_id, [])
      childrenByParent.get(category.parent_id)!.push(category)
    }
    for (const list of childrenByParent.values()) list.sort((a, b) => a.sort_order - b.sort_order)

    const ordered: Category[] = []
    for (const parent of topLevel) {
      ordered.push(parent)
      ordered.push(...(childrenByParent.get(parent.id) || []))
    }
    return ordered
  }, [categories])

  function updateCategory(id: string, data: Partial<Category>) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)))
  }

  function deleteCategory(id: string) {
    const categoryIds = new Set([id, ...categories.filter((c) => c.parent_id === id).map((c) => c.id)])
    const nextItems = items.filter((i) => !categoryIds.has(i.category_id || ''))
    const nextItemIds = new Set(nextItems.map((i) => i.id))
    setCategories((prev) => prev.filter((c) => !categoryIds.has(c.id)))
    setItems(nextItems)
    setVariants((prev) => prev.filter((v) => nextItemIds.has(v.menu_item_id)))
  }

  function updateItem(id: string, data: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)))
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setVariants((prev) => prev.filter((v) => v.menu_item_id !== id))
  }

  function createVariant(itemId: string, data: { name: string; price_npr: number; is_veg: boolean }) {
    setVariants((prev) => [
      ...prev,
      {
        id: uid('var'),
        menu_item_id: itemId,
        name: data.name,
        price_npr: data.price_npr,
        is_veg: data.is_veg,
        sort_order: prev.length,
        is_active: true,
      },
    ])
  }

  function updateVariant(id: string, data: Partial<Variant>) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...data } : v)))
  }

  function deleteVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  function reorderCategories(dragId: string, targetId: string, position: 'before' | 'after') {
    if (dragId === targetId) return
    const drag = categories.find((c) => c.id === dragId)
    const target = categories.find((c) => c.id === targetId)
    if (!drag || !target) return
    if ((drag.parent_id || null) !== (target.parent_id || null)) {
      setStatus({ type: 'error', message: 'Drag categories within the same level only.' })
      return
    }

    setCategories((prev) => {
      const siblingParentId = drag.parent_id || null
      const siblings = prev
        .filter((c) => (c.parent_id || null) === siblingParentId)
        .sort((a, b) => a.sort_order - b.sort_order)
      const from = siblings.findIndex((c) => c.id === dragId)
      const to = siblings.findIndex((c) => c.id === targetId)
      if (from < 0 || to < 0 || from === to) return prev
      const nextSiblings = [...siblings]
      const [moved] = nextSiblings.splice(from, 1)
      let insertIndex = position === 'before' ? to : to + 1
      if (from < insertIndex) insertIndex -= 1
      nextSiblings.splice(insertIndex, 0, moved)
      const order = new Map(nextSiblings.map((c, idx) => [c.id, idx]))
      return prev.map((c) => (order.has(c.id) ? { ...c, sort_order: order.get(c.id)! } : c))
    })
    setStatus({ type: 'success', message: 'Category order updated (UI only).' })
  }

  function reorderItems(dragId: string, targetId: string, position: 'before' | 'after') {
    if (dragId === targetId) return
    const drag = items.find((i) => i.id === dragId)
    const target = items.find((i) => i.id === targetId)
    if (!drag || !target) return
    if ((drag.category_id || null) !== (target.category_id || null)) {
      setStatus({ type: 'error', message: 'Drag items within the same category only.' })
      return
    }

    setItems((prev) => {
      const siblingCategoryId = drag.category_id || null
      const siblings = prev
        .filter((i) => (i.category_id || null) === siblingCategoryId)
        .sort((a, b) => a.sort_order - b.sort_order)
      const from = siblings.findIndex((i) => i.id === dragId)
      const to = siblings.findIndex((i) => i.id === targetId)
      if (from < 0 || to < 0 || from === to) return prev
      const nextSiblings = [...siblings]
      const [moved] = nextSiblings.splice(from, 1)
      let insertIndex = position === 'before' ? to : to + 1
      if (from < insertIndex) insertIndex -= 1
      nextSiblings.splice(insertIndex, 0, moved)
      const order = new Map(nextSiblings.map((i, idx) => [i.id, idx]))
      return prev.map((i) => (order.has(i.id) ? { ...i, sort_order: order.get(i.id)! } : i))
    })
    setStatus({ type: 'success', message: 'Item order updated (UI only).' })
  }

  async function onImportCsv(e: FormEvent) {
    e.preventDefault()
    setStatus(null)
    setImportErrors([])
    if (!csvFile) {
      setStatus({ type: 'error', message: 'Please select a CSV file.' })
      return
    }
    const text = await csvFile.text()
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      setStatus({ type: 'error', message: 'CSV must include header and at least one row.' })
      return
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
    const idxCategory = headers.indexOf('category')
    const idxSub = headers.indexOf('subcategory')
    const idxName = headers.indexOf('name')
    const idxPrice = headers.indexOf('price_npr')
    const idxDesc = headers.indexOf('description')
    const idxImage = headers.indexOf('image_url')
    const idxVeg = headers.indexOf('is_veg')
    const idxVariantName = headers.indexOf('variant_name')
    const idxVariantPrice = headers.indexOf('variant_price_npr')
    const idxVariantVeg = headers.indexOf('variant_is_veg')
    if (idxCategory < 0 || idxName < 0 || idxPrice < 0) {
      setStatus({ type: 'error', message: 'Missing required columns: category,name,price_npr.' })
      return
    }

    const localCategories = [...categories]
    const localItems = [...items]
    const localVariants = [...variants]
    const errors: Array<{ rowNo: number; message: string }> = []
    const itemKeyToId = new Map<string, string>()

    for (const existingItem of localItems) {
      const key = `${existingItem.category_id || ''}|${existingItem.name.toLowerCase()}|${existingItem.price_npr}`
      itemKeyToId.set(key, existingItem.id)
    }
    const findOrCreate = (name: string, parentId: string | null) => {
      const existing = localCategories.find((c) => c.name.toLowerCase() === name.toLowerCase() && (c.parent_id || null) === parentId)
      if (existing) return existing.id
      const created: Category = {
        id: uid('cat'),
        name,
        description: '',
        parent_id: parentId,
        is_active: true,
        sort_order: localCategories.length,
      }
      localCategories.push(created)
      return created.id
    }

    let added = 0
    for (let i = 1; i < lines.length; i += 1) {
      const rowNo = i + 1
      const cols = parseCsvLine(lines[i])
      const root = String(cols[idxCategory] || '').trim()
      const sub = idxSub >= 0 ? String(cols[idxSub] || '').trim() : ''
      const name = String(cols[idxName] || '').trim()
      const price = Number(String(cols[idxPrice] || '').trim())
      if (!root || !name || !Number.isInteger(price) || price < 0) {
        errors.push({ rowNo, message: 'Invalid category/name/price_npr.' })
        continue
      }

      const rootId = findOrCreate(root, null)
      const categoryId = sub ? findOrCreate(sub, rootId) : rootId
      const itemKey = `${categoryId}|${name.toLowerCase()}|${price}`
      let itemId = itemKeyToId.get(itemKey)

      if (!itemId) {
        itemId = uid('item')
        localItems.push({
          id: itemId,
          name,
          category_id: categoryId,
          price_npr: price,
          description: idxDesc >= 0 ? String(cols[idxDesc] || '').trim() : '',
          image_url: idxImage >= 0 ? String(cols[idxImage] || '').trim() : '',
          is_available: true,
          is_veg: isVegEnabled ? parseVeg(idxVeg >= 0 ? String(cols[idxVeg] || '') : '', true) : true,
          sort_order: localItems.length,
        })
        itemKeyToId.set(itemKey, itemId)
      } else {
        const existingIndex = localItems.findIndex((item) => item.id === itemId)
        if (existingIndex >= 0) {
          const rowDescription = idxDesc >= 0 ? String(cols[idxDesc] || '').trim() : ''
          const rowImage = idxImage >= 0 ? String(cols[idxImage] || '').trim() : ''
          if (!localItems[existingIndex].description && rowDescription) localItems[existingIndex].description = rowDescription
          if (!localItems[existingIndex].image_url && rowImage) localItems[existingIndex].image_url = rowImage
        }
      }

      const variantName = idxVariantName >= 0 ? String(cols[idxVariantName] || '').trim() : ''
      const variantPriceRaw = idxVariantPrice >= 0 ? String(cols[idxVariantPrice] || '').trim() : ''
      const variantPrice = Number(variantPriceRaw)
      if (variantName && !variantPriceRaw) {
        errors.push({ rowNo, message: 'variant_price_npr is required when variant_name is provided.' })
        continue
      }
      if (variantName && (!Number.isInteger(variantPrice) || variantPrice < 0)) {
        errors.push({ rowNo, message: 'variant_price_npr must be a non-negative integer.' })
        continue
      }
      if (variantName && Number.isInteger(variantPrice) && variantPrice >= 0) {
        const itemVeg = localItems.find((item) => item.id === itemId)?.is_veg ?? true
        const variantVeg = isVegEnabled ? parseVeg(idxVariantVeg >= 0 ? String(cols[idxVariantVeg] || '') : '', itemVeg) : true
        localVariants.push({
          id: uid('var'),
          menu_item_id: itemId,
          name: variantName,
          price_npr: variantPrice,
          is_veg: variantVeg,
          is_active: true,
          sort_order: localVariants.length,
        })
      }
      added += 1
    }

    setCategories(localCategories)
    setItems(localItems)
    setVariants(localVariants)
    setImportErrors(errors.slice(0, 20))
    setStatus({
      type: errors.length ? 'error' : 'success',
      message: `CSV imported (UI only). Rows added: ${added}. Errors: ${errors.length}.`,
    })
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{program === 'DELIVERS' ? 'Nova Delivers Menu' : 'Nova Mart Menu'}</h1>
        </div>
        <button
          type="button"
          onClick={onSaveMenu}
          disabled={isLoading || isSaving}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save Menu'}
        </button>
      </div>
      {isLoading ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Loading {program === 'DELIVERS' ? 'Nova Delivers' : 'Nova Mart'} menu...
        </p>
      ) : null}
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Import menu via CSV</h2>
          <p className="mt-1 text-sm text-slate-600">
            Required columns: category, name, price_npr. Optional: subcategory, description, image_url, variant_name, variant_price_npr{isVegEnabled ? ', is_veg (Y/N), variant_is_veg (Y/N)' : ''}.
          </p>
          <div className="mt-2">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                isVegEnabled
                  ? 'category,subcategory,name,price_npr,description,image_url,is_veg,variant_name,variant_price_npr,variant_is_veg\nPizza,Classic,Margherita,500,Classic cheese,,Y,Small,500,Y\nPizza,Classic,Margherita,500,Classic cheese,,Y,Large,900,N'
                  : 'category,subcategory,name,price_npr,description,image_url,variant_name,variant_price_npr\nSnacks,Chips,Potato Chips,180,Classic salted chips,,Small,180\nSnacks,Chips,Potato Chips,180,Classic salted chips,,Large,300'
              )}`}
              download={program === 'DELIVERS' ? 'nova-delivers-menu-sample.csv' : 'nova-mart-menu-sample.csv'}
              className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Download sample CSV
            </a>
          </div>
          <form onSubmit={onImportCsv} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="rounded border border-slate-300 px-2 py-2 text-sm" />
            <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Import CSV</button>
          </form>
          {importErrors.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Row errors</p>
              <div className="mt-1 space-y-1">
                {importErrors.map((err) => (
                  <p key={`${err.rowNo}-${err.message}`} className="text-xs text-red-700">
                    Row {err.rowNo}: {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Create category</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setStatus(null)
              const name = String(new FormData(e.currentTarget).get('name') || '').trim()
              if (!name) return setStatus({ type: 'error', message: 'Category name is required.' })
              const created: Category = {
                id: uid('cat'),
                name,
                description: String(new FormData(e.currentTarget).get('description') || '').trim(),
                parent_id: String(new FormData(e.currentTarget).get('parent_id') || '').trim() || null,
                sort_order: categories.length,
                is_active: true,
              }
              setCategories((prev) => [...prev, created])
              ;(e.currentTarget as HTMLFormElement).reset()
              setStatus({ type: 'success', message: 'Category created (UI only).' })
            }}
            className="mt-3 grid gap-2 md:grid-cols-4"
          >
            <input name="name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" required />
            <input name="description" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Description (optional)" />
            <select name="parent_id" defaultValue="" className="rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">Top-level category</option>
              {categories.filter((c) => !c.parent_id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Add</button>
          </form>
        </section>

        {status && <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{status.message}</p>}

        <div className="space-y-4">
          {categoriesForDisplay.map((category) => (
            <SortableCategoryCard
              key={category.id}
              category={category}
              isDragging={dragCategoryId === category.id}
              onDragStart={setDragCategoryId}
              onDragEnd={() => {
                setDragCategoryId(null)
                setCategoryDropTarget(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (!dragCategoryId || dragCategoryId === category.id) return
                const rect = e.currentTarget.getBoundingClientRect()
                const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                setCategoryDropTarget({ id: category.id, position })
              }}
              onDrop={(targetId) => {
                if (!dragCategoryId) return
                const position = categoryDropTarget?.id === targetId ? categoryDropTarget.position : 'after'
                reorderCategories(dragCategoryId, targetId, position)
                setDragCategoryId(null)
                setCategoryDropTarget(null)
              }}
              dropIndicatorPosition={categoryDropTarget?.id === category.id ? categoryDropTarget.position : null}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setStatus(null)
                  const fd = new FormData(e.currentTarget)
                  const name = String(fd.get('name') || '').trim()
                  if (!name) return setStatus({ type: 'error', message: 'Category name is required.' })
                  const parentId = String(fd.get('parent_id') || '').trim() || null
                  if (parentId === category.id) return setStatus({ type: 'error', message: 'A category cannot be its own parent.' })
                  updateCategory(category.id, {
                    name,
                    description: String(fd.get('description') || '').trim(),
                    parent_id: parentId,
                    is_active: String(fd.get('is_active') || 'true') === 'true',
                  })
                  setStatus({ type: 'success', message: 'Category updated (UI only).' })
                }}
                className="mb-3 grid gap-2 md:grid-cols-5"
              >
                <input name="name" defaultValue={category.name} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                <input name="description" defaultValue={category.description || ''} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Description (optional)" />
                <select name="parent_id" defaultValue={category.parent_id || ''} className="rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="">Top-level category</option>
                  {categories.filter((c) => c.id !== category.id && !c.parent_id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select name="is_active" defaultValue={String(category.is_active)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="true">Active</option>
                  <option value="false">Hidden</option>
                </select>
                <div className="flex gap-2">
                  <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Save</button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null)
                      deleteCategory(category.id)
                      setStatus({ type: 'success', message: 'Category deleted (UI only).' })
                    }}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setStatus(null)
                  const price = Number(itemPrice)
                  if (!itemName.trim()) return setStatus({ type: 'error', message: 'Item name is required.' })
                  if (!Number.isInteger(price) || price < 0) return setStatus({ type: 'error', message: 'Price must be non-negative integer.' })
                  const created: Item = {
                    id: uid('item'),
                    name: itemName.trim(),
                    category_id: category.id,
                    price_npr: price,
                    description: itemDesc.trim(),
                    image_url: itemImage.trim(),
                    is_available: true,
                    is_veg: isVegEnabled ? itemVeg : true,
                    sort_order: items.length,
                  }
                  setItems((prev) => [...prev, created])
                  setItemName('')
                  setItemPrice('')
                  setItemDesc('')
                  setItemImage('')
                  setItemVeg(true)
                  setStatus({ type: 'success', message: 'Item created (UI only).' })
                }}
                className="mb-3 grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-5"
              >
                <input value={itemName} onChange={(e) => setItemName(e.target.value)} required className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Item name" />
                <input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} type="number" min={0} required className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Price" />
                <input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Description" />
                {isVegEnabled ? (
                  <select value={itemVeg ? 'true' : 'false'} onChange={(e) => setItemVeg(e.target.value === 'true')} className="rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="true">Veg</option>
                    <option value="false">Non-Veg</option>
                  </select>
                ) : null}
                <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Add item</button>
                <input value={itemImage} onChange={(e) => setItemImage(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm md:col-span-4" placeholder="Image URL (optional)" />
                <StorageUploader folder="items" onUploaded={(url) => setItemImage(url)} />
              </form>

              <div className="space-y-2">
                {(itemsByCategory.get(category.id) || []).map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    variants={variantsByItem.get(item.id) || []}
                    categoryId={category.id}
                    isVegEnabled={isVegEnabled}
                    isDraggingItem={dragItemId === item.id}
                    onItemDragStart={setDragItemId}
                    onItemDragEnd={() => {
                      setDragItemId(null)
                      setItemDropTarget(null)
                    }}
                    onItemDragOver={(e) => {
                      e.preventDefault()
                      if (!dragItemId || dragItemId === item.id) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                      setItemDropTarget({ id: item.id, position })
                    }}
                    onItemDrop={(targetId) => {
                      if (!dragItemId) return
                      const position = itemDropTarget?.id === targetId ? itemDropTarget.position : 'after'
                      reorderItems(dragItemId, targetId, position)
                      setDragItemId(null)
                      setItemDropTarget(null)
                    }}
                    dropIndicatorPosition={itemDropTarget?.id === item.id ? itemDropTarget.position : null}
                    onStatus={setStatus}
                    onUpdateItem={updateItem}
                    onDeleteItem={deleteItem}
                    onCreateVariant={createVariant}
                    onUpdateVariant={updateVariant}
                    onDeleteVariant={deleteVariant}
                  />
                ))}
              </div>
            </SortableCategoryCard>
          ))}
        </div>
      </div>
    </main>
  )
}
