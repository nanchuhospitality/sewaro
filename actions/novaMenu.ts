'use server'

import { requireRole } from '@/lib/auth/requireRole'
import { friendlyError } from '@/lib/utils/errors'

type NovaCategory = {
  id: string
  name: string
  description: string
  parent_id: string | null
  sort_order: number
  is_active: boolean
}

type NovaItem = {
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

type NovaVariant = {
  id: string
  menu_item_id: string
  name: string
  price_npr: number
  is_veg: boolean
  is_active: boolean
  sort_order: number
}

type NovaMenuPayload = {
  categories: NovaCategory[]
  items: NovaItem[]
  variants: NovaVariant[]
}

const EMPTY_MENU: NovaMenuPayload = {
  categories: [],
  items: [],
  variants: [],
}

function normalizePayload(payload: Partial<NovaMenuPayload> | null | undefined): NovaMenuPayload {
  if (!payload) return EMPTY_MENU
  return {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    items: Array.isArray(payload.items) ? payload.items : [],
    variants: Array.isArray(payload.variants) ? payload.variants : [],
  }
}

export async function getNovaDeliversMenu() {
  const { supabase } = await requireRole('SUPERADMIN')
  const { data, error } = await supabase
    .from('nova_delivers_menu')
    .select('categories,items,variants')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    const schemaError = error.message.toLowerCase()
    if (schemaError.includes('nova_delivers_menu')) {
      return { ...EMPTY_MENU, warning: 'Nova Delivers menu table is not ready. Run migration 0018_create_nova_delivers_menu.sql.' }
    }
    return { ...EMPTY_MENU, error: friendlyError(error.message) }
  }

  return normalizePayload(data)
}

export async function saveNovaDeliversMenu(payload: NovaMenuPayload) {
  const { supabase } = await requireRole('SUPERADMIN')
  const normalized = normalizePayload(payload)

  const { error } = await supabase.from('nova_delivers_menu').upsert(
    {
      id: 1,
      categories: normalized.categories,
      items: normalized.items,
      variants: normalized.variants,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    const schemaError = error.message.toLowerCase()
    if (schemaError.includes('nova_delivers_menu')) {
      return { error: 'Nova Delivers menu table is not ready. Run migration 0018_create_nova_delivers_menu.sql.' }
    }
    return { error: friendlyError(error.message) }
  }

  return { success: true }
}

export async function getNovaMartMenu() {
  const { supabase } = await requireRole('SUPERADMIN')
  const { data, error } = await supabase
    .from('nova_mart_menu')
    .select('categories,items,variants')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    const schemaError = error.message.toLowerCase()
    if (schemaError.includes('nova_mart_menu')) {
      return { ...EMPTY_MENU, warning: 'Nova Mart menu table is not ready. Run migration 0028_create_nova_mart_menu.sql.' }
    }
    return { ...EMPTY_MENU, error: friendlyError(error.message) }
  }

  return normalizePayload(data)
}

export async function saveNovaMartMenu(payload: NovaMenuPayload) {
  const { supabase } = await requireRole('SUPERADMIN')
  const normalized = normalizePayload(payload)

  const { error } = await supabase.from('nova_mart_menu').upsert(
    {
      id: 1,
      categories: normalized.categories,
      items: normalized.items,
      variants: normalized.variants,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    const schemaError = error.message.toLowerCase()
    if (schemaError.includes('nova_mart_menu')) {
      return { error: 'Nova Mart menu table is not ready. Run migration 0028_create_nova_mart_menu.sql.' }
    }
    return { error: friendlyError(error.message) }
  }

  return { success: true }
}
