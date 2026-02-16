'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/requireRole'
import { friendlyError } from '@/lib/utils/errors'

function toInt(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

type CsvRow = {
  category: string
  subcategory: string | null
  name: string
  price_npr: number
  description: string | null
  image_url: string | null
  is_veg: boolean
  variant_name: string | null
  variant_price_npr: number | null
  variant_is_veg: boolean | null
  rowNo: number
}

type CsvError = {
  rowNo: number
  message: string
}

type CsvWarning = {
  message: string
}

function parseIsVeg(value: string | null | undefined, fallback = true) {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (['veg', 'vegetarian', 'v', 'true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['non-veg', 'non veg', 'nonveg', 'n', 'false', '0', 'no'].includes(normalized)) return false
  return fallback
}

async function resolveMenuContext(formData?: FormData) {
  const requestedBusinessId = String(formData?.get('business_id') || '').trim()
  if (requestedBusinessId) {
    const { supabase } = await requireRole('SUPERADMIN')
    return { supabase, businessId: requestedBusinessId }
  }

  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')
  if (!profile.business_id) return { error: 'No business linked.' as const }
  return { supabase, businessId: profile.business_id }
}

async function detectIsVegColumn(supabase: Awaited<ReturnType<typeof requireRole>>['supabase']) {
  const probe = await supabase.from('menu_items').select('id,is_veg').limit(1)
  const err = probe.error?.message?.toLowerCase() || ''
  if (!probe.error) return { supported: true as const }
  if (err.includes('is_veg')) return { supported: false as const }
  return { supported: false as const, error: probe.error.message }
}

async function detectVariantIsVegColumn(supabase: Awaited<ReturnType<typeof requireRole>>['supabase']) {
  const probe = await supabase.from('menu_item_variants').select('id,is_veg').limit(1)
  const err = probe.error?.message?.toLowerCase() || ''
  if (!probe.error) return { supported: true as const }
  if (err.includes('is_veg') || err.includes('menu_item_variants')) return { supported: false as const }
  return { supported: false as const, error: probe.error.message }
}

function parseMenuCsvText(csvText: string) {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return { rows: [] as CsvRow[], errors: [{ rowNo: 1, message: 'CSV must include header and at least one data row.' }] as CsvError[] }
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const required = ['category', 'name', 'price_npr']
  for (const key of required) {
    if (!headers.includes(key)) {
      return { rows: [] as CsvRow[], errors: [{ rowNo: 1, message: `Missing required column: ${key}` }] as CsvError[] }
    }
  }

  const idx = {
    category: headers.indexOf('category'),
    subcategory: headers.indexOf('subcategory'),
    name: headers.indexOf('name'),
    price_npr: headers.indexOf('price_npr'),
    description: headers.indexOf('description'),
    image_url: headers.indexOf('image_url'),
    food_type: headers.indexOf('food_type'),
    is_veg: headers.indexOf('is_veg'),
    variant_name: headers.indexOf('variant_name'),
    variant_price_npr: headers.indexOf('variant_price_npr'),
    variant_is_veg: headers.indexOf('variant_is_veg'),
  }

  const rows: CsvRow[] = []
  const errors: CsvError[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const rowNo = i + 1
    const cols = parseCsvLine(lines[i])

    const category = String(cols[idx.category] || '').trim()
    const subcategory = idx.subcategory >= 0 ? String(cols[idx.subcategory] || '').trim() || null : null
    const name = String(cols[idx.name] || '').trim()
    const priceRaw = String(cols[idx.price_npr] || '').trim()

    if (!category) {
      errors.push({ rowNo, message: 'Category is required.' })
      continue
    }
    if (!name) {
      errors.push({ rowNo, message: 'Item name is required.' })
      continue
    }

    const price = Number(priceRaw)
    if (!Number.isInteger(price) || price < 0) {
      errors.push({ rowNo, message: 'price_npr must be a non-negative integer.' })
      continue
    }

    const variantName = idx.variant_name >= 0 ? String(cols[idx.variant_name] || '').trim() : ''
    const variantPriceRaw = idx.variant_price_npr >= 0 ? String(cols[idx.variant_price_npr] || '').trim() : ''
    const variantIsVegRaw = idx.variant_is_veg >= 0 ? String(cols[idx.variant_is_veg] || '').trim() : ''
    if (variantName && !variantPriceRaw) {
      errors.push({ rowNo, message: 'variant_price_npr is required when variant_name is provided.' })
      continue
    }
    const variantPrice = variantPriceRaw ? Number(variantPriceRaw) : null
    if (variantPriceRaw && (!Number.isInteger(variantPrice) || Number(variantPrice) < 0)) {
      errors.push({ rowNo, message: 'variant_price_npr must be a non-negative integer.' })
      continue
    }

    rows.push({
      category,
      subcategory,
      name,
      price_npr: price,
      description: idx.description >= 0 ? String(cols[idx.description] || '').trim() || null : null,
      image_url: idx.image_url >= 0 ? String(cols[idx.image_url] || '').trim() || null : null,
      is_veg: parseIsVeg(
        idx.is_veg >= 0
          ? String(cols[idx.is_veg] || '')
          : idx.food_type >= 0
            ? String(cols[idx.food_type] || '')
            : null,
        true
      ),
      variant_name: variantName || null,
      variant_price_npr: variantPriceRaw ? variantPrice : null,
      variant_is_veg: variantIsVegRaw ? parseIsVeg(variantIsVegRaw, true) : null,
      rowNo,
    })
  }

  return { rows, errors }
}

export async function createCategory(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Category name is required.' }
  const parentId = String(formData.get('parent_id') || '').trim() || null
  const description = String(formData.get('description') || '').trim() || null
  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('id', parentId)
      .eq('business_id', businessId)
      .maybeSingle()
    if (parentError || !parent) return { error: friendlyError(parentError?.message || 'Invalid parent category.') }
  }

  const { error } = await supabase.from('menu_categories').insert({
    business_id: businessId,
    name,
    description,
    parent_id: parentId,
    sort_order: toInt(formData.get('sort_order'), 0),
    is_active: true,
  })

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function updateCategory(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const isActive = String(formData.get('is_active') || 'true') === 'true'
  const parentId = String(formData.get('parent_id') || '').trim() || null
  if (parentId === id) return { error: 'A category cannot be its own parent.' }
  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('menu_categories')
      .select('id,parent_id')
      .eq('id', parentId)
      .eq('business_id', businessId)
      .maybeSingle()
    if (parentError || !parent) return { error: friendlyError(parentError?.message || 'Invalid parent category.') }
    if (parent.parent_id === id) return { error: 'Nested loops are not allowed.' }
  }

  const { error } = await supabase
    .from('menu_categories')
    .update({ name, description, is_active: isActive, parent_id: parentId })
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function deleteCategory(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  const { error } = await supabase
    .from('menu_categories')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function createItem(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Item name is required.' }

  const price = Number(formData.get('price_npr'))
  if (!Number.isInteger(price) || price < 0) return { error: 'Price must be a non-negative integer.' }

  const categoryId = String(formData.get('category_id') || '')
  const isVegProbe = await detectIsVegColumn(supabase)
  if (isVegProbe.error) return { error: friendlyError(isVegProbe.error) }

  const payload: {
    business_id: string
    category_id: string | null
    name: string
    price_npr: number
    description: string | null
    image_url: string | null
    is_available: boolean
    sort_order: number
    is_veg?: boolean
  } = {
    business_id: businessId,
    category_id: categoryId || null,
    name,
    price_npr: price,
    description: String(formData.get('description') || '').trim() || null,
    image_url: String(formData.get('image_url') || '').trim() || null,
    is_available: true,
    sort_order: toInt(formData.get('sort_order'), 0),
  }
  if (isVegProbe.supported) payload.is_veg = String(formData.get('is_veg') || 'true') === 'true'

  const { error } = await supabase.from('menu_items').insert(payload)

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function updateItem(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  const price = Number(formData.get('price_npr'))
  if (!Number.isInteger(price) || price < 0) return { error: 'Price must be a non-negative integer.' }

  const isVegProbe = await detectIsVegColumn(supabase)
  if (isVegProbe.error) return { error: friendlyError(isVegProbe.error) }

  const payload: {
    name: string
    category_id: string | null
    price_npr: number
    description: string | null
    image_url: string | null
    is_available: boolean
    is_veg?: boolean
  } = {
    name: String(formData.get('name') || '').trim(),
    category_id: String(formData.get('category_id') || '').trim() || null,
    price_npr: price,
    description: String(formData.get('description') || '').trim() || null,
    image_url: String(formData.get('image_url') || '').trim() || null,
    is_available: String(formData.get('is_available') || 'true') === 'true',
  }
  if (isVegProbe.supported) payload.is_veg = String(formData.get('is_veg') || 'true') === 'true'

  const { error } = await supabase
    .from('menu_items')
    .update(payload)
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function deleteItem(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function createVariant(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const menuItemId = String(formData.get('menu_item_id') || '')
  const name = String(formData.get('name') || '').trim()
  const price = Number(formData.get('price_npr'))
  if (!menuItemId) return { error: 'Missing menu item.' }
  if (!name) return { error: 'Variant name is required.' }
  if (!Number.isInteger(price) || price < 0) return { error: 'Variant price must be a non-negative integer.' }

  const { data: item, error: itemError } = await supabase
    .from('menu_items')
    .select('id,business_id')
    .eq('id', menuItemId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (itemError || !item) return { error: friendlyError(itemError?.message || 'Menu item not found.') }

  const variantVegProbe = await detectVariantIsVegColumn(supabase)
  if (variantVegProbe.error) return { error: friendlyError(variantVegProbe.error) }

  const payload: {
    menu_item_id: string
    name: string
    price_npr: number
    sort_order: number
    is_active: boolean
    is_veg?: boolean | null
  } = {
    menu_item_id: menuItemId,
    name,
    price_npr: price,
    sort_order: toInt(formData.get('sort_order'), 0),
    is_active: String(formData.get('is_active') || 'true') === 'true',
  }
  if (variantVegProbe.supported) {
    const raw = String(formData.get('is_veg') || '').trim()
    payload.is_veg = raw === '' ? null : raw === 'true'
  }

  const { error } = await supabase.from('menu_item_variants').insert(payload)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function updateVariant(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const price = Number(formData.get('price_npr'))
  if (!id) return { error: 'Missing variant id.' }
  if (!name) return { error: 'Variant name is required.' }
  if (!Number.isInteger(price) || price < 0) return { error: 'Variant price must be a non-negative integer.' }

  const { data: variant, error: variantError } = await supabase
    .from('menu_item_variants')
    .select('id,menu_item_id')
    .eq('id', id)
    .maybeSingle()
  if (variantError || !variant) return { error: friendlyError(variantError?.message || 'Variant not found.') }

  const { data: item, error: itemError } = await supabase
    .from('menu_items')
    .select('id,business_id')
    .eq('id', variant.menu_item_id)
    .eq('business_id', businessId)
    .maybeSingle()
  if (itemError || !item) return { error: friendlyError(itemError?.message || 'Not allowed to update this variant.') }

  const variantVegProbe = await detectVariantIsVegColumn(supabase)
  if (variantVegProbe.error) return { error: friendlyError(variantVegProbe.error) }

  const payload: {
    name: string
    price_npr: number
    is_active: boolean
    is_veg?: boolean | null
  } = {
    name,
    price_npr: price,
    is_active: String(formData.get('is_active') || 'true') === 'true',
  }
  if (variantVegProbe.supported) {
    const raw = String(formData.get('is_veg') || '').trim()
    payload.is_veg = raw === '' ? null : raw === 'true'
  }

  const { error } = await supabase
    .from('menu_item_variants')
    .update(payload)
    .eq('id', id)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function deleteVariant(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Missing variant id.' }

  const { data: variant, error: variantError } = await supabase
    .from('menu_item_variants')
    .select('id,menu_item_id')
    .eq('id', id)
    .maybeSingle()
  if (variantError || !variant) return { error: friendlyError(variantError?.message || 'Variant not found.') }

  const { data: item, error: itemError } = await supabase
    .from('menu_items')
    .select('id,business_id')
    .eq('id', variant.menu_item_id)
    .eq('business_id', businessId)
    .maybeSingle()
  if (itemError || !item) return { error: friendlyError(itemError?.message || 'Not allowed to delete this variant.') }

  const { error } = await supabase.from('menu_item_variants').delete().eq('id', id)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function reorderCategories(ids: string[], businessId?: string) {
  const formData = new FormData()
  if (businessId) formData.set('business_id', businessId)
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId: resolvedBusinessId, supabase } = context

  for (let index = 0; index < ids.length; index += 1) {
    await supabase
      .from('menu_categories')
      .update({ sort_order: index })
      .eq('id', ids[index])
      .eq('business_id', resolvedBusinessId)
  }

  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function reorderItems(categoryId: string | null, ids: string[], businessId?: string) {
  const formData = new FormData()
  if (businessId) formData.set('business_id', businessId)
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId: resolvedBusinessId, supabase } = context

  for (let index = 0; index < ids.length; index += 1) {
    await supabase
      .from('menu_items')
      .update({ sort_order: index, category_id: categoryId })
      .eq('id', ids[index])
      .eq('business_id', resolvedBusinessId)
  }

  revalidatePath('/dashboard/menu')
  return { success: true }
}

export async function importMenuCsv(formData: FormData) {
  const context = await resolveMenuContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context
  const mode = String(formData.get('mode') || 'import')
  const dryRun = mode === 'dry_run'

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Please select a CSV file.' }
  if (!file.name.toLowerCase().endsWith('.csv')) return { error: 'Only .csv files are supported.' }

  const csvText = await file.text()
  const { rows, errors } = parseMenuCsvText(csvText)

  const warnings: CsvWarning[] = []

  const duplicateMap = new Map<string, number[]>()
  for (const row of rows) {
    const key = `${row.category.toLowerCase()}::${(row.subcategory || '').toLowerCase()}::${row.name.toLowerCase()}::${(row.variant_name || '').toLowerCase()}`
    const list = duplicateMap.get(key) || []
    list.push(row.rowNo)
    duplicateMap.set(key, list)
  }
  for (const [key, rowNos] of duplicateMap.entries()) {
    if (rowNos.length > 1) {
      const [category, subcategory, name, variant] = key.split('::')
      warnings.push({
        message: `Duplicate item "${name}"${variant ? ` variant "${variant}"` : ''} in category "${category}"${subcategory ? ` / "${subcategory}"` : ''} appears in rows: ${rowNos.join(', ')}`,
      })
    }
  }

  if (rows.length === 0) {
    return {
      error: errors[0]?.message || 'No valid rows found in CSV.',
      summary: {
        dryRun,
        totalRows: 0,
        validRows: 0,
        invalidRows: errors.length,
        categoriesCreated: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        variantsInserted: 0,
        variantsUpdated: 0,
        errors,
        warnings,
      },
    }
  }

  const { data: existingCategories, error: catLoadError } = await supabase
    .from('menu_categories')
    .select('id,name,parent_id,sort_order')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })

  if (catLoadError) return { error: friendlyError(catLoadError.message) }

  const { data: existingItems, error: itemLoadError } = await supabase
    .from('menu_items')
    .select('id,name,category_id')
    .eq('business_id', businessId)

  if (itemLoadError) return { error: friendlyError(itemLoadError.message) }

  const isVegProbe = await detectIsVegColumn(supabase)
  if (isVegProbe.error) return { error: friendlyError(isVegProbe.error) }
  if (!isVegProbe.supported) {
    warnings.push({ message: 'is_veg column is not available yet. Veg/non-veg values were ignored. Run migration 0009_add_menu_item_is_veg.sql.' })
  }

  const withVariantIsVeg = await supabase
    .from('menu_item_variants')
    .select('id,menu_item_id,name,is_veg')
  const variantSchemaError = withVariantIsVeg.error?.message?.toLowerCase() || ''
  let variantsEnabled = !withVariantIsVeg.error
  let existingVariants: Array<{ id: string; menu_item_id: string; name: string; is_veg?: boolean | null }> = withVariantIsVeg.data || []
  if (withVariantIsVeg.error && (variantSchemaError.includes('is_veg') || variantSchemaError.includes('menu_item_variants'))) {
    const fallbackVariantQuery = await supabase
      .from('menu_item_variants')
      .select('id,menu_item_id,name')
    if (!fallbackVariantQuery.error) {
      variantsEnabled = true
      existingVariants = fallbackVariantQuery.data || []
    } else if (!fallbackVariantQuery.error?.message?.toLowerCase().includes('menu_item_variants')) {
      return { error: friendlyError(fallbackVariantQuery.error.message) }
    } else {
      variantsEnabled = false
      existingVariants = []
    }
  } else if (withVariantIsVeg.error && !variantSchemaError.includes('menu_item_variants')) {
    return { error: friendlyError(withVariantIsVeg.error.message) }
  }

  const variantVegProbe = await detectVariantIsVegColumn(supabase)
  if (variantVegProbe.error) return { error: friendlyError(variantVegProbe.error) }
  if (variantsEnabled && !variantVegProbe.supported) {
    warnings.push({ message: 'variant_is_veg column is not available yet. Variant veg/non-veg overrides were ignored. Run migration 0012_add_variant_is_veg.sql.' })
  }

  const categoriesByKey = new Map<string, { id: string; name: string; parent_id: string | null }>()
  const rootCategoryByName = new Map<string, { id: string; name: string }>()
  let maxCategoryOrder = -1
  for (const c of existingCategories || []) {
    const key = `${c.parent_id || 'root'}::${c.name.toLowerCase()}`
    categoriesByKey.set(key, { id: c.id, name: c.name, parent_id: c.parent_id || null })
    if (!c.parent_id) rootCategoryByName.set(c.name.toLowerCase(), { id: c.id, name: c.name })
    maxCategoryOrder = Math.max(maxCategoryOrder, c.sort_order)
  }

  const itemByKey = new Map<string, { id: string }>()
  for (const it of existingItems || []) {
    const key = `${it.category_id || 'null'}::${it.name.toLowerCase()}`
    if (!itemByKey.has(key)) itemByKey.set(key, { id: it.id })
  }

  const variantByKey = new Map<string, { id: string }>()
  for (const variant of existingVariants) {
    const key = `${variant.menu_item_id}::${variant.name.toLowerCase()}`
    if (!variantByKey.has(key)) variantByKey.set(key, { id: variant.id })
  }

  let categoriesCreated = 0
  let itemsInserted = 0
  let itemsUpdated = 0
  let variantsInserted = 0
  let variantsUpdated = 0
  const sortCounterByCategory = new Map<string, number>()
  const variantSortCounterByItem = new Map<string, number>()

  if (dryRun) {
    const simulatedCategoriesByKey = new Map(categoriesByKey)
    const simulatedRootCategoriesByName = new Map(rootCategoryByName)
    const simulatedItems = new Map(itemByKey)
    const simulatedVariants = new Map(variantByKey)
    let nextCategoryOrder = maxCategoryOrder
    let syntheticCategoryId = 0

    for (const row of rows) {
      const rootCategoryKey = row.category.toLowerCase()
      let rootCategory = simulatedRootCategoriesByName.get(rootCategoryKey)

      if (!rootCategory) {
        syntheticCategoryId += 1
        nextCategoryOrder += 1
        rootCategory = { id: `new-${syntheticCategoryId}`, name: row.category }
        simulatedRootCategoriesByName.set(rootCategoryKey, rootCategory)
        simulatedCategoriesByKey.set(`root::${row.category.toLowerCase()}`, { ...rootCategory, parent_id: null })
        categoriesCreated += 1
      }

      let category = rootCategory
      if (row.subcategory) {
        const childKey = `${rootCategory.id}::${row.subcategory.toLowerCase()}`
        const existingChild = simulatedCategoriesByKey.get(childKey)
        if (existingChild) {
          category = { id: existingChild.id, name: existingChild.name }
        } else {
          syntheticCategoryId += 1
          category = { id: `new-${syntheticCategoryId}`, name: row.subcategory }
          simulatedCategoriesByKey.set(childKey, { id: category.id, name: category.name, parent_id: rootCategory.id })
          categoriesCreated += 1
        }
      }

      const nextSort = sortCounterByCategory.get(category.id) || 0
      sortCounterByCategory.set(category.id, nextSort + 1)

      const itemKey = `${category.id}::${row.name.toLowerCase()}`
      if (simulatedItems.has(itemKey)) {
        itemsUpdated += 1
      } else {
        simulatedItems.set(itemKey, { id: `new-item-${itemsInserted + 1}` })
        itemsInserted += 1
      }

      const itemId = simulatedItems.get(itemKey)?.id
      if (itemId && row.variant_name) {
        const variantKey = `${itemId}::${row.variant_name.toLowerCase()}`
        if (simulatedVariants.has(variantKey)) {
          variantsUpdated += 1
        } else {
          simulatedVariants.set(variantKey, { id: `new-variant-${variantsInserted + 1}` })
          variantsInserted += 1
        }
      }
    }

    return {
      success: true,
      summary: {
        dryRun: true,
        totalRows: rows.length + errors.length,
        validRows: rows.length,
        invalidRows: errors.length,
        categoriesCreated,
        itemsInserted,
        itemsUpdated,
        variantsInserted,
        variantsUpdated,
        errors,
        warnings,
      },
    }
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const rootCategoryKey = row.category.toLowerCase()
    let rootCategory = rootCategoryByName.get(rootCategoryKey)

    if (!rootCategory) {
      const { data: createdCategory, error: createCategoryError } = await supabase
        .from('menu_categories')
        .insert({
          business_id: businessId,
          name: row.category,
          parent_id: null,
          sort_order: maxCategoryOrder + 1,
          is_active: true,
        })
        .select('id,name')
        .single()

      if (createCategoryError || !createdCategory) {
        errors.push({ rowNo: row.rowNo, message: friendlyError(createCategoryError?.message || 'Could not create category.') })
        continue
      }

      maxCategoryOrder += 1
      rootCategory = { id: createdCategory.id, name: createdCategory.name }
      rootCategoryByName.set(rootCategoryKey, rootCategory)
      categoriesByKey.set(`root::${row.category.toLowerCase()}`, { id: rootCategory.id, name: rootCategory.name, parent_id: null })
      categoriesCreated += 1
    }

    let category = rootCategory
    if (row.subcategory) {
      const childKey = `${rootCategory.id}::${row.subcategory.toLowerCase()}`
      const existingChild = categoriesByKey.get(childKey)
      if (existingChild) {
        category = { id: existingChild.id, name: existingChild.name }
      } else {
        const { data: createdChild, error: createChildError } = await supabase
          .from('menu_categories')
          .insert({
            business_id: businessId,
            parent_id: rootCategory.id,
            name: row.subcategory,
            sort_order: maxCategoryOrder + 1,
            is_active: true,
          })
          .select('id,name,parent_id')
          .single()
        if (createChildError || !createdChild) {
          errors.push({ rowNo: row.rowNo, message: friendlyError(createChildError?.message || 'Could not create subcategory.') })
          continue
        }
        maxCategoryOrder += 1
        categoriesByKey.set(childKey, { id: createdChild.id, name: createdChild.name, parent_id: createdChild.parent_id || null })
        category = { id: createdChild.id, name: createdChild.name }
        categoriesCreated += 1
      }
    }

    const itemKey = `${category.id}::${row.name.toLowerCase()}`
    const existing = itemByKey.get(itemKey)
    const nextSort = sortCounterByCategory.get(category.id) || 0
    sortCounterByCategory.set(category.id, nextSort + 1)
    const payload: {
      name: string
      price_npr: number
      description: string | null
      image_url: string | null
      is_available: boolean
      sort_order: number
      is_veg?: boolean
    } = {
      name: row.name,
      price_npr: row.price_npr,
      description: row.description,
      image_url: row.image_url,
      is_available: true,
      sort_order: nextSort,
    }
    if (isVegProbe.supported) payload.is_veg = row.is_veg

    if (existing) {
      const { error: updateError } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', existing.id)
        .eq('business_id', businessId)

      if (updateError) {
        errors.push({ rowNo: row.rowNo, message: friendlyError(updateError.message) })
        continue
      }
      itemsUpdated += 1
    } else {
      const { data: createdItem, error: insertError } = await supabase
        .from('menu_items')
        .insert({
          business_id: businessId,
          category_id: category.id,
          ...payload,
        })
        .select('id')
        .single()

      if (insertError || !createdItem) {
        errors.push({ rowNo: row.rowNo, message: friendlyError(insertError?.message || 'Could not insert item.') })
        continue
      }

      itemByKey.set(itemKey, { id: createdItem.id })
      itemsInserted += 1
    }

    if (!row.variant_name) continue
    if (!variantsEnabled) {
      warnings.push({ message: `Row ${row.rowNo}: variant columns were ignored because variants table is not available yet.` })
      continue
    }

    const currentItemId = itemByKey.get(itemKey)?.id
    if (!currentItemId) {
      errors.push({ rowNo: row.rowNo, message: 'Could not resolve menu item for variant row.' })
      continue
    }
    const variantKey = `${currentItemId}::${row.variant_name.toLowerCase()}`
    const existingVariant = variantByKey.get(variantKey)
    const nextVariantSort = variantSortCounterByItem.get(currentItemId) || 0
    variantSortCounterByItem.set(currentItemId, nextVariantSort + 1)
    const variantPayload: {
      name: string | null
      price_npr: number
      sort_order: number
      is_active: boolean
      is_veg?: boolean | null
    } = {
      name: row.variant_name,
      price_npr: row.variant_price_npr ?? row.price_npr,
      sort_order: nextVariantSort,
      is_active: true,
    }
    if (variantVegProbe.supported) {
      variantPayload.is_veg = row.variant_is_veg
    }

    if (existingVariant) {
      const { error: updateVariantError } = await supabase
        .from('menu_item_variants')
        .update(variantPayload)
        .eq('id', existingVariant.id)
      if (updateVariantError) {
        errors.push({ rowNo: row.rowNo, message: friendlyError(updateVariantError.message) })
        continue
      }
      variantsUpdated += 1
      continue
    }

    const { data: createdVariant, error: insertVariantError } = await supabase
      .from('menu_item_variants')
      .insert({
        menu_item_id: currentItemId,
        ...variantPayload,
      })
      .select('id')
      .single()
    if (insertVariantError || !createdVariant) {
      errors.push({ rowNo: row.rowNo, message: friendlyError(insertVariantError?.message || 'Could not insert variant.') })
      continue
    }
    variantByKey.set(variantKey, { id: createdVariant.id })
    variantsInserted += 1
  }

  revalidatePath('/dashboard/menu')
  return {
    success: true,
    summary: {
      dryRun: false,
      totalRows: rows.length + errors.length,
      validRows: rows.length,
      invalidRows: errors.length,
      categoriesCreated,
      itemsInserted,
      itemsUpdated,
      variantsInserted,
      variantsUpdated,
      errors,
      warnings,
    },
  }
}
