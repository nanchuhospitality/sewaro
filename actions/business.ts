'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/requireRole'
import { friendlyError } from '@/lib/utils/errors'
import { toSlug, validateBusinessSlug } from '@/lib/utils/slug'

async function resolveBusinessContext(formData?: FormData) {
  const requestedBusinessId = String(formData?.get('business_id') || '').trim()
  if (requestedBusinessId) {
    const { supabase } = await requireRole('SUPERADMIN')
    return { supabase, businessId: requestedBusinessId }
  }

  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')
  if (!profile.business_id) return { error: 'No business linked to this account.' as const }
  return { supabase, businessId: profile.business_id }
}

export async function createOwnBusiness(formData: FormData) {
  const { user, profile, supabase } = await requireRole('BUSINESS_ADMIN')
  if (profile.business_id) return { error: 'Your account is already linked to a business.' }

  const name = String(formData.get('name') || '').trim()
  const slug = toSlug(String(formData.get('slug') || ''))
  if (!name) return { error: 'Business name is required.' }
  const slugErr = validateBusinessSlug(slug)
  if (slugErr) return { error: slugErr }

  const { data: duplicate } = await supabase.from('businesses').select('id').eq('slug', slug).maybeSingle()
  if (duplicate) return { error: 'That slug is already in use.' }

  const { data: created, error: createError } = await supabase
    .from('businesses')
    .insert({
      name,
      slug,
      phone: String(formData.get('phone') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
      hours_text: String(formData.get('hours_text') || '').trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (createError || !created) return { error: friendlyError(createError?.message || 'Failed to create business.') }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ business_id: created.id })
    .eq('user_id', user.id)

  if (profileError) return { error: friendlyError(profileError.message) }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateBusinessSettings(formData: FormData) {
  const context = await resolveBusinessContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const rawSlug = String(formData.get('slug') || '')
  const slug = toSlug(rawSlug)
  const slugErr = validateBusinessSlug(slug)
  if (slugErr) return { error: slugErr }

  const { data: duplicate } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .neq('id', businessId)
    .maybeSingle()

  if (duplicate) {
    return { error: 'That slug is already in use.' }
  }

  const payload = {
    name: String(formData.get('name') || '').trim(),
    slug,
    phone: String(formData.get('phone') || '').trim() || null,
    room_service_phone: String(formData.get('room_service_phone') || '').trim() || null,
    room_service_open_time: String(formData.get('room_service_open_time') || '').trim() || null,
    room_service_close_time: String(formData.get('room_service_close_time') || '').trim() || null,
    address: String(formData.get('address') || '').trim() || null,
    google_business_map_link: String(formData.get('google_business_map_link') || '').trim() || null,
    google_map_link: String(formData.get('google_map_link') || '').trim() || null,
    show_review: Boolean(formData.get('show_review')),
    cover_image_url: String(formData.get('cover_image_url') || '').trim() || null,
    hours_text: String(formData.get('hours_text') || '').trim() || null,
    logo_url: String(formData.get('logo_url') || '').trim() || null,
  }

  if (!payload.name) return { error: 'Business name is required.' }

  const { error } = await supabase.from('businesses').update(payload).eq('id', businessId)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/superadmin')
  revalidatePath(`/${slug}`)
  return { success: true }
}
