'use client'

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCategory,
  createItem,
  createVariant,
  deleteCategory,
  deleteItem,
  deleteVariant,
  importMenuCsv,
  reorderCategories,
  reorderItems,
  updateCategory,
  updateItem,
  updateVariant,
} from '@/actions/menu'
import StorageUploader from './StorageUploader'

type Category = { id: string; name: string; description: string | null; parent_id: string | null; sort_order: number; is_active: boolean }
type Item = {
  id: string
  name: string
  category_id: string | null
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

function SortableCategory({
  category,
  children,
}: {
  category: Category
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">
          {category.parent_id ? <span className="mr-1 text-slate-400">↳</span> : null}
          {category.name}
        </p>
        <button type="button" {...attributes} {...listeners} className="rounded border border-slate-300 px-2 py-1 text-xs">
          Drag
        </button>
      </div>
      {children}
    </div>
  )
}

function SortableItemRow({
  item,
  variants,
  categoryId,
  businessId,
  onStatus,
  onDone,
}: {
  item: Item
  variants: Variant[]
  categoryId: string
  businessId?: string
  onStatus: (status: { type: 'error' | 'success'; message: string } | null) => void
  onDone: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [imageUrl, setImageUrl] = useState(item.image_url || '')
  const addVariantFormRef = useRef<HTMLFormElement>(null)
  function withBusiness(fd: FormData) {
    if (businessId) fd.set('business_id', businessId)
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-slate-200 p-3">
      <form
        action={async (fd) => {
          onStatus(null)
          withBusiness(fd)
          fd.set('id', item.id)
          fd.set('category_id', categoryId)
          fd.set('image_url', imageUrl)
          const res = await updateItem(fd)
          if (res.error) {
            onStatus({ type: 'error', message: res.error })
            return
          }
          onStatus({ type: 'success', message: 'Item updated.' })
          onDone()
        }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <input name="name" defaultValue={item.name} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          <button type="button" {...attributes} {...listeners} className="rounded border border-slate-300 px-2 py-1 text-xs">Drag</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="price_npr" defaultValue={item.price_npr} type="number" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <select name="is_available" defaultValue={String(item.is_available)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="true">Available</option>
            <option value="false">Sold out</option>
          </select>
        </div>
        <select name="is_veg" defaultValue={String(item.is_veg)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
          <option value="true">Veg</option>
          <option value="false">Non-Veg</option>
        </select>
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
            formAction={async (fd) => {
              onStatus(null)
              withBusiness(fd)
              fd.set('id', item.id)
              const res = await deleteItem(fd)
              if (res.error) {
                onStatus({ type: 'error', message: res.error })
                return
              }
              onStatus({ type: 'success', message: 'Item deleted.' })
              onDone()
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
              action={async (fd) => {
                onStatus(null)
                withBusiness(fd)
                fd.set('id', variant.id)
                const res = await updateVariant(fd)
                if (res.error) {
                  onStatus({ type: 'error', message: res.error })
                  return
                }
                onStatus({ type: 'success', message: 'Variant updated.' })
                onDone()
              }}
              className="grid gap-2 rounded border border-slate-200 bg-white p-2 md:grid-cols-5"
            >
              <input name="name" defaultValue={variant.name} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              <input name="price_npr" defaultValue={variant.price_npr} type="number" min={0} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              <select name="is_veg" defaultValue={variant.is_veg === null ? '' : String(variant.is_veg)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="">Inherit item type</option>
                <option value="true">Veg</option>
                <option value="false">Non-Veg</option>
              </select>
              <select name="is_active" defaultValue={String(variant.is_active)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="true">Active</option>
                <option value="false">Hidden</option>
              </select>
              <div className="flex gap-2">
                <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Save</button>
                <button
                  formAction={async (fd) => {
                    onStatus(null)
                    withBusiness(fd)
                    fd.set('id', variant.id)
                    const res = await deleteVariant(fd)
                    if (res.error) {
                      onStatus({ type: 'error', message: res.error })
                      return
                    }
                    onStatus({ type: 'success', message: 'Variant deleted.' })
                    onDone()
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
          action={async (fd) => {
            onStatus(null)
            withBusiness(fd)
            fd.set('menu_item_id', item.id)
            const res = await createVariant(fd)
            if (res.error) {
              onStatus({ type: 'error', message: res.error })
              return
            }
            onStatus({ type: 'success', message: 'Variant created.' })
            addVariantFormRef.current?.reset()
            onDone()
          }}
          className="mt-2 grid gap-2 rounded border border-dashed border-slate-300 p-2 md:grid-cols-4"
        >
          <input name="name" required placeholder="Variant name" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <input name="price_npr" required type="number" min={0} placeholder="Variant price" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <select name="is_veg" defaultValue="" className="rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="">Inherit item type</option>
            <option value="true">Veg</option>
            <option value="false">Non-Veg</option>
          </select>
          <button className="rounded bg-slate-800 px-3 py-1 text-xs text-white">Add variant</button>
        </form>
      </div>
    </div>
  )
}

export default function MenuManager({
  categories: initialCategories,
  items: initialItems,
  variants: initialVariants,
  businessId,
}: {
  categories: Category[]
  items: Item[]
  variants: Variant[]
  businessId?: string
}) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [variants, setVariants] = useState(initialVariants)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [importErrors, setImportErrors] = useState<Array<{ rowNo: number; message: string }>>([])
  const [importWarnings, setImportWarnings] = useState<Array<{ message: string }>>([])
  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    setVariants(initialVariants)
  }, [initialVariants])

  function withBusiness(fd: FormData) {
    if (businessId) fd.set('business_id', businessId)
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
    for (const item of items) grouped.set(item.id, [])
    for (const variant of variants) {
      if (!grouped.has(variant.menu_item_id)) grouped.set(variant.menu_item_id, [])
      grouped.get(variant.menu_item_id)!.push(variant)
    }
    for (const list of grouped.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return grouped
  }, [items, variants])

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Import menu via CSV</h2>
        <p className="mt-1 text-sm text-slate-600">Required columns: category, name, price_npr. Optional: subcategory, description, image_url, is_veg (Y/N), variant_name, variant_price_npr, variant_is_veg (Y/N). Blank variant_is_veg inherits item type.</p>
        <div className="mt-2">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('category,subcategory,name,price_npr,description,image_url,is_veg,variant_name,variant_price_npr,variant_is_veg\nPizza,Classic,Margherita Pizza,500,Classic tomato and mozzarella,,Y,Small,500,Y\nPizza,Classic,Margherita Pizza,500,Classic tomato and mozzarella,,Y,Medium,700,\nPizza,Classic,Margherita Pizza,500,Classic tomato and mozzarella,,Y,Large,900,N\nMain Course,Curry,Chicken Curry,420,,https://example.com/chicken-curry.jpg,N,,,')}`}
            download="menu-sample.csv"
            className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
          >
            Download sample CSV
          </a>
        </div>
        <form
          action={async (fd) => {
            setStatus(null)
            setImportErrors([])
            setImportWarnings([])
            withBusiness(fd)
            const res = await importMenuCsv(fd)
            if (res.error) {
              setStatus({ type: 'error', message: res.error })
              if (res.summary?.errors) setImportErrors(res.summary.errors.slice(0, 20))
              if (res.summary?.warnings) setImportWarnings(res.summary.warnings.slice(0, 20))
              return
            }
            const summary = res.summary
            if (!summary) {
              setStatus({ type: 'error', message: 'Import finished with unknown result.' })
              return
            }
            setStatus({
              type: 'success',
              message: `${summary.dryRun ? 'Dry run completed.' : 'Imported.'} Categories created: ${summary.categoriesCreated}, items inserted: ${summary.itemsInserted}, items updated: ${summary.itemsUpdated}, variants inserted: ${summary.variantsInserted || 0}, variants updated: ${summary.variantsUpdated || 0}, errors: ${summary.errors.length}, warnings: ${summary.warnings.length}.`,
            })
            setImportErrors(summary.errors.slice(0, 20))
            setImportWarnings(summary.warnings.slice(0, 20))
            if (!summary.dryRun) router.refresh()
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="rounded border border-slate-300 px-2 py-2 text-sm"
          />
          <button name="mode" value="dry_run" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Dry Run
          </button>
          <button name="mode" value="import" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            Import CSV
          </button>
        </form>
        {importWarnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">Warnings</p>
            <div className="mt-1 space-y-1">
              {importWarnings.map((warning, index) => (
                <p key={`${warning.message}-${index}`} className="text-xs text-amber-700">
                  {warning.message}
                </p>
              ))}
            </div>
          </div>
        )}
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
          action={async (fd) => {
            setStatus(null)
            withBusiness(fd)
            const res = await createCategory(fd)
            if (res.error) {
              setStatus({ type: 'error', message: res.error })
              return
            }
            setStatus({ type: 'success', message: 'Category created.' })
            router.refresh()
          }}
          className="mt-3 grid gap-2 md:grid-cols-4"
        >
          <input name="name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" required />
          <input name="description" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Description (optional)" />
          <select name="parent_id" defaultValue="" className="rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="">Top-level category</option>
            {categories
              .filter((c) => !c.parent_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Add</button>
        </form>
      </section>

      {status && (
        <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={async (event) => {
          const { active, over } = event
          if (!over || active.id === over.id) return
          const oldIndex = categories.findIndex((c) => c.id === active.id)
          const newIndex = categories.findIndex((c) => c.id === over.id)
          const next = arrayMove(categories, oldIndex, newIndex)
          setCategories(next)
          await reorderCategories(next.map((c) => c.id), businessId)
        }}
      >
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {categories.map((category) => (
              <SortableCategory key={category.id} category={category}>
                <form
                  action={async (fd) => {
                    setStatus(null)
                    withBusiness(fd)
                    fd.set('id', category.id)
                    const res = await updateCategory(fd)
                    if (res.error) {
                      setStatus({ type: 'error', message: res.error })
                      return
                    }
                    setStatus({ type: 'success', message: 'Category updated.' })
                    router.refresh()
                  }}
                  className="mb-3 grid gap-2 md:grid-cols-5"
                >
                  <input name="name" defaultValue={category.name} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                  <input
                    name="description"
                    defaultValue={category.description || ''}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Description (optional)"
                  />
                  <select name="parent_id" defaultValue={category.parent_id || ''} className="rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="">Top-level category</option>
                    {categories
                      .filter((c) => c.id !== category.id && !c.parent_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <select name="is_active" defaultValue={String(category.is_active)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="true">Active</option>
                    <option value="false">Hidden</option>
                  </select>
                  <div className="flex gap-2">
                    <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Save</button>
                    <button
                      formAction={async (fd) => {
                        setStatus(null)
                        withBusiness(fd)
                        fd.set('id', category.id)
                        const res = await deleteCategory(fd)
                        if (res.error) {
                          setStatus({ type: 'error', message: res.error })
                          return
                        }
                        setStatus({ type: 'success', message: 'Category deleted.' })
                        router.refresh()
                      }}
                      className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </form>

                <form
                  action={async (fd) => {
                    setStatus(null)
                    withBusiness(fd)
                    fd.set('category_id', category.id)
                    const res = await createItem(fd)
                    if (res.error) {
                      setStatus({ type: 'error', message: res.error })
                      return
                    }
                    setStatus({ type: 'success', message: 'Item created.' })
                    router.refresh()
                  }}
                  className="mb-3 grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-5"
                >
                  <input name="name" required className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Item name" />
                  <input name="price_npr" type="number" min={0} required className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Price" />
                  <input name="description" className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Description" />
                  <select name="is_veg" defaultValue="true" className="rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="true">Veg</option>
                    <option value="false">Non-Veg</option>
                  </select>
                  <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Add item</button>
                </form>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={async (event) => {
                    const list = itemsByCategory.get(category.id) || []
                    const oldIndex = list.findIndex((i) => i.id === event.active.id)
                    const newIndex = list.findIndex((i) => i.id === event.over?.id)
                    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
                    const next = arrayMove(list, oldIndex, newIndex)
                    const nextAll = items.map((i) => {
                      const idx = next.findIndex((n) => n.id === i.id)
                      if (idx === -1) return i
                      return { ...i, sort_order: idx }
                    })
                    setItems(nextAll)
                    await reorderItems(category.id, next.map((i) => i.id), businessId)
                  }}
                >
                  <SortableContext items={(itemsByCategory.get(category.id) || []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {(itemsByCategory.get(category.id) || []).map((item) => (
                        <SortableItemRow
                          key={item.id}
                          item={item}
                          variants={variantsByItem.get(item.id) || []}
                          categoryId={category.id}
                          businessId={businessId}
                          onStatus={setStatus}
                          onDone={() => router.refresh()}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </SortableCategory>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
