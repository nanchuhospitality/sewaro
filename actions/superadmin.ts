'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/auth/requireRole'
import { friendlyError } from '@/lib/utils/errors'
import { toSlug, validateBusinessSlug } from '@/lib/utils/slug'

function serverAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for this action.')
  return createSupabaseClient(url, key, { auth: { persistSession: false } })
}

export async function createBusiness(formData: FormData) {
  const { supabase } = await requireRole('SUPERADMIN')
  const admin = serverAdminClient()
  const name = String(formData.get('name') || '').trim()
  const slug = toSlug(String(formData.get('slug') || ''))
  const phone = String(formData.get('phone') || '').trim() || null
  const adminEmail = String(formData.get('admin_email') || '').trim().toLowerCase()
  const adminPassword = String(formData.get('admin_password') || '').trim()

  if (!name) return { error: 'Business name is required.' }
  if (!adminEmail) return { error: 'Admin email is required.' }
  if (!adminPassword) return { error: 'Admin password is required.' }

  const slugErr = validateBusinessSlug(slug)
  if (slugErr) return { error: slugErr }

  const { data: exists } = await supabase.from('businesses').select('id').eq('slug', slug).maybeSingle()
  if (exists) return { error: 'Slug is already used.' }

  const { data: createdBusiness, error: businessError } = await supabase.from('businesses').insert({
    name,
    slug,
    phone,
    address: String(formData.get('address') || '').trim() || null,
    hours_text: String(formData.get('hours_text') || '').trim() || null,
    is_active: true,
  }).select('id').single()

  if (businessError || !createdBusiness) return { error: friendlyError(businessError?.message || 'Failed to create business.') }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  })
  if (createUserError || !createdUser.user) {
    await supabase.from('businesses').delete().eq('id', createdBusiness.id)
    return { error: friendlyError(createUserError?.message || 'Could not create admin user.') }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: createdUser.user.id, role: 'BUSINESS_ADMIN', business_id: createdBusiness.id })
  if (profileError) {
    await admin.auth.admin.deleteUser(createdUser.user.id)
    await supabase.from('businesses').delete().eq('id', createdBusiness.id)
    return { error: friendlyError(profileError.message) }
  }

  revalidatePath('/superadmin')
  return { success: true }
}

export async function updateBusinessStatus(formData: FormData) {
  const { supabase } = await requireRole('SUPERADMIN')
  const id = String(formData.get('id') || '')
  const isActive = String(formData.get('is_active') || 'true') === 'true'

  const { error } = await supabase.from('businesses').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/businesses/${id}`)
  return { success: true }
}

export async function updateBusiness(formData: FormData) {
  const { supabase } = await requireRole('SUPERADMIN')
  const id = String(formData.get('id') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const slug = toSlug(String(formData.get('slug') || ''))
  const phone = String(formData.get('phone') || '').trim() || null
  const isActive = String(formData.get('is_active') || 'true') === 'true'
  const enableNovaDeliversMenu = String(formData.get('enable_nova_delivers_menu') || 'false') === 'true'
  const enableNovaDeliversOrdering = String(formData.get('enable_nova_delivers_ordering') || 'false') === 'true'
  const commissionPercent = Number(formData.get('nova_delivers_commission_percent') || 0)
  const deliveryChargeNpr = Number(formData.get('nova_delivers_delivery_charge_npr') || 0)
  const supportPhone = String(formData.get('nova_delivers_support_phone') || '').trim() || null
  const enableNovaMartMenu = String(formData.get('enable_nova_mart_menu') || 'false') === 'true'
  const enableNovaMartOrdering = String(formData.get('enable_nova_mart_ordering') || 'false') === 'true'
  const novaMartCommissionPercent = Number(formData.get('nova_mart_commission_percent') || 0)
  const novaMartDeliveryChargeNpr = Number(formData.get('nova_mart_delivery_charge_npr') || 0)
  const novaMartSupportPhone = String(formData.get('nova_mart_support_phone') || '').trim() || null

  if (!id) return { error: 'Missing business id.' }
  if (!name) return { error: 'Business name is required.' }
  if (!Number.isInteger(commissionPercent) || commissionPercent < 0) {
    return { error: 'Commission must be a non-negative whole number.' }
  }
  if (!Number.isInteger(deliveryChargeNpr) || deliveryChargeNpr < 0) {
    return { error: 'Delivery charge must be a non-negative whole number.' }
  }
  if (!Number.isInteger(novaMartCommissionPercent) || novaMartCommissionPercent < 0) {
    return { error: 'Nova Mart commission must be a non-negative whole number.' }
  }
  if (!Number.isInteger(novaMartDeliveryChargeNpr) || novaMartDeliveryChargeNpr < 0) {
    return { error: 'Nova Mart delivery charge must be a non-negative whole number.' }
  }

  const slugErr = validateBusinessSlug(slug)
  if (slugErr) return { error: slugErr }

  const { data: exists } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle()
  if (exists) return { error: 'Slug is already used.' }

  const withNovaFlag = await supabase
    .from('businesses')
    .update({
      name,
      slug,
      phone,
      is_active: isActive,
      enable_nova_delivers_menu: enableNovaDeliversMenu,
      enable_nova_delivers_ordering: enableNovaDeliversOrdering,
      nova_delivers_commission_percent: commissionPercent,
      nova_delivers_delivery_charge_npr: deliveryChargeNpr,
      nova_delivers_support_phone: supportPhone,
      enable_nova_mart_menu: enableNovaMartMenu,
      enable_nova_mart_ordering: enableNovaMartOrdering,
      nova_mart_commission_percent: novaMartCommissionPercent,
      nova_mart_delivery_charge_npr: novaMartDeliveryChargeNpr,
      nova_mart_support_phone: novaMartSupportPhone,
    })
    .eq('id', id)
  const schemaError = withNovaFlag.error?.message?.toLowerCase() || ''
  if (
    withNovaFlag.error &&
    (
      schemaError.includes('enable_nova_delivers_menu') ||
      schemaError.includes('enable_nova_delivers_ordering') ||
      schemaError.includes('nova_delivers_commission_percent') ||
      schemaError.includes('nova_delivers_delivery_charge_npr') ||
      schemaError.includes('nova_delivers_support_phone') ||
      schemaError.includes('enable_nova_mart_menu') ||
      schemaError.includes('enable_nova_mart_ordering') ||
      schemaError.includes('nova_mart_commission_percent') ||
      schemaError.includes('nova_mart_delivery_charge_npr') ||
      schemaError.includes('nova_mart_support_phone')
    )
  ) {
    return { error: 'Nova partner fields are not available yet. Run migrations 0016_add_business_enable_nova_delivers_menu.sql, 0017_add_nova_delivers_partner_fields.sql, 0019_add_business_enable_nova_delivers_ordering.sql, 0020_add_business_nova_delivers_support_phone.sql, and 0027_add_nova_mart_partner_fields.sql, then refresh.' }
  } else if (withNovaFlag.error) {
    return { error: friendlyError(withNovaFlag.error.message) }
  }

  revalidatePath('/superadmin')
  revalidatePath(`/superadmin/businesses/${id}`)
  return { success: true }
}

export async function createBusinessAdminUser(formData: FormData) {
  const { supabase } = await requireRole('SUPERADMIN')
  const admin = serverAdminClient()

  const businessId = String(formData.get('business_id') || '')
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const tempPassword = String(formData.get('temp_password') || '').trim()

  if (!businessId || !email || !tempPassword) return { error: 'All fields are required.' }

  const { data: business } = await supabase.from('businesses').select('slug').eq('id', businessId).maybeSingle()
  if (!business) return { error: 'Business not found.' }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: friendlyError(createError?.message || 'Could not create user.') }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: created.user.id, role: 'BUSINESS_ADMIN', business_id: businessId })

  if (profileError) return { error: friendlyError(profileError.message) }

  revalidatePath(`/superadmin/businesses/${businessId}`)
  return {
    success: true,
    credentials: {
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
      email,
      tempPassword,
      businessSlug: business.slug,
    },
  }
}

export async function createCentralOpsUser(formData: FormData) {
  await requireRole('SUPERADMIN')
  const admin = serverAdminClient()

  const email = String(formData.get('email') || '').trim().toLowerCase()
  const tempPassword = String(formData.get('temp_password') || '').trim()

  if (!email || !tempPassword) return { error: 'Email and temporary password are required.' }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: friendlyError(createError?.message || 'Could not create user.') }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: created.user.id, role: 'CENTRAL_OPS', business_id: null })

  if (profileError) return { error: friendlyError(profileError.message) }

  revalidatePath('/superadmin/ops')
  return {
    success: true,
    credentials: {
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
      email,
      tempPassword,
    },
  }
}

export async function deleteCentralOpsUser(formData: FormData) {
  const { user } = await requireRole('SUPERADMIN')
  const admin = serverAdminClient()

  const userId = String(formData.get('user_id') || '').trim()
  if (!userId) return { error: 'Missing user id.' }
  if (userId === user.id) return { error: 'You cannot delete your own account.' }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/superadmin/ops')
  return { success: true }
}

export async function updateBusinessAdminCredentials(formData: FormData) {
  await requireRole('SUPERADMIN')
  const admin = serverAdminClient()

  const businessId = String(formData.get('business_id') || '').trim()
  const userId = String(formData.get('user_id') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '').trim()

  if (!businessId) return { error: 'Missing business id.' }
  if (!userId) return { error: 'Business admin user not found.' }
  if (!email && !password) return { error: 'Provide new email or password.' }

  const payload: { email?: string; password?: string; email_confirm?: boolean } = {}
  if (email) payload.email = email
  if (password) payload.password = password
  if (email) payload.email_confirm = true

  const { error } = await admin.auth.admin.updateUserById(userId, payload)
  if (error) return { error: friendlyError(error.message) }

  revalidatePath(`/superadmin/businesses/${businessId}`)
  return { success: true }
}
