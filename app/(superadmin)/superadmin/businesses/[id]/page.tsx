import BusinessEditForm from '@/components/superadmin/BusinessEditForm'
import BusinessAdminCredentialsForm from '@/components/superadmin/BusinessAdminCredentialsForm'
import { requireRole } from '@/lib/auth/requireRole'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import MenuManager from '@/components/dashboard/MenuManager'
import RoomsManager from '@/components/dashboard/RoomsManager'
import SettingsForm from '@/components/dashboard/SettingsForm'

function serverAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
  return createSupabaseClient(url, key, { auth: { persistSession: false } })
}

function tabLinkClass(active: boolean) {
  return active
    ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white'
    : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
}

export default async function SuperadminBusinessDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { tab?: string }
}) {
  const { supabase } = await requireRole('SUPERADMIN')
  let novaDeliversSupported = true
  let novaMartSupported = true
  const tab = (searchParams?.tab || 'overview').toLowerCase()

  const withNovaFlag = await supabase
    .from('businesses')
    .select('id,name,slug,phone,is_active,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_commission_percent,nova_delivers_delivery_charge_npr,nova_delivers_support_phone,enable_nova_mart_menu,enable_nova_mart_ordering,nova_mart_commission_percent,nova_mart_delivery_charge_npr,nova_mart_support_phone,created_at')
    .eq('id', params.id)
    .maybeSingle()
  let business = withNovaFlag.data
  const schemaError = withNovaFlag.error?.message?.toLowerCase() || ''
  if (
    !business &&
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
    if (
      schemaError.includes('enable_nova_delivers_menu') ||
      schemaError.includes('enable_nova_delivers_ordering') ||
      schemaError.includes('nova_delivers_commission_percent') ||
      schemaError.includes('nova_delivers_delivery_charge_npr') ||
      schemaError.includes('nova_delivers_support_phone')
    ) {
      novaDeliversSupported = false
    }
    if (
      schemaError.includes('enable_nova_mart_menu') ||
      schemaError.includes('enable_nova_mart_ordering') ||
      schemaError.includes('nova_mart_commission_percent') ||
      schemaError.includes('nova_mart_delivery_charge_npr') ||
      schemaError.includes('nova_mart_support_phone')
    ) {
      novaMartSupported = false
    }
    const fallback = await supabase
      .from('businesses')
      .select('id,name,slug,phone,is_active,created_at')
      .eq('id', params.id)
      .maybeSingle()
    if (fallback.data) {
      business = {
        ...fallback.data,
        enable_nova_delivers_menu: false,
        enable_nova_delivers_ordering: false,
        nova_delivers_commission_percent: 0,
        nova_delivers_delivery_charge_npr: 0,
        nova_delivers_support_phone: null,
        enable_nova_mart_menu: false,
        enable_nova_mart_ordering: false,
        nova_mart_commission_percent: 0,
        nova_mart_delivery_charge_npr: 0,
        nova_mart_support_phone: null,
      }
    }
  }

  if (!business) {
    return <main className="mx-auto max-w-3xl px-4 py-8">Business not found.</main>
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('business_id', business.id)
    .eq('role', 'BUSINESS_ADMIN')
    .limit(1)
    .maybeSingle()

  let adminEmail: string | null = null
  if (adminProfile?.user_id) {
    try {
      const admin = serverAdminClient()
      const userLookup = await admin.auth.admin.getUserById(adminProfile.user_id)
      adminEmail = userLookup.data.user?.email || null
    } catch {
      adminEmail = null
    }
  }

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">{business.name}</h1>
        <p className="text-sm text-slate-600">/{business.slug}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/superadmin/businesses/${business.id}?tab=overview`} className={tabLinkClass(tab === 'overview')}>
            Overview
          </Link>
          <Link href={`/superadmin/businesses/${business.id}?tab=menu`} className={tabLinkClass(tab === 'menu')}>
            Menu
          </Link>
          <Link href={`/superadmin/businesses/${business.id}?tab=tables`} className={tabLinkClass(tab === 'tables')}>
            Room and QR
          </Link>
          <Link href={`/superadmin/businesses/${business.id}?tab=settings`} className={tabLinkClass(tab === 'settings')}>
            Settings
          </Link>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Business Admin</h2>
            <p className="text-sm text-slate-600">Manage business status and Nova partner program access.</p>
            <BusinessEditForm business={business} novaDeliversSupported={novaDeliversSupported} novaMartSupported={novaMartSupported} />
          </div>

          <BusinessAdminCredentialsForm
            businessId={business.id}
            loginUrl={loginUrl}
            adminUserId={adminProfile?.user_id || null}
            adminEmail={adminEmail}
          />
        </>
      )}

      {tab === 'menu' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Business Menu</h2>
          {/*
            Load dashboard-style menu data for this business so superadmin can manage it directly.
          */}
          {await (async () => {
            const withParentCategories = await supabase
              .from('menu_categories')
              .select('id,name,description,parent_id,sort_order,is_active')
              .eq('business_id', business.id)
              .order('sort_order', { ascending: true })
            const categorySchemaError = withParentCategories.error?.message?.toLowerCase() || ''
            let categories = withParentCategories.data
            if (!categories && (categorySchemaError.includes('parent_id') || categorySchemaError.includes('description'))) {
              const fallback = await supabase
                .from('menu_categories')
                .select('id,name,sort_order,is_active')
                .eq('business_id', business.id)
                .order('sort_order', { ascending: true })
              categories = (fallback.data || []).map((category) => ({ ...category, description: null, parent_id: null }))
            }

            const withVegItems = await supabase
              .from('menu_items')
              .select('id,name,category_id,price_npr,description,image_url,is_available,is_veg,sort_order')
              .eq('business_id', business.id)
              .order('sort_order', { ascending: true })
            const itemSchemaError = withVegItems.error?.message?.toLowerCase() || ''
            let menuItems = withVegItems.data
            if (!menuItems && itemSchemaError.includes('is_veg')) {
              const fallback = await supabase
                .from('menu_items')
                .select('id,name,category_id,price_npr,description,image_url,is_available,sort_order')
                .eq('business_id', business.id)
                .order('sort_order', { ascending: true })
              menuItems = (fallback.data || []).map((item) => ({ ...item, is_veg: true }))
            }

            let variants: Array<{ id: string; menu_item_id: string; name: string; price_npr: number; is_active: boolean; is_veg: boolean | null; sort_order: number }> = []
            if ((menuItems || []).length > 0) {
              const withVariants = await supabase
                .from('menu_item_variants')
                .select('id,menu_item_id,name,price_npr,is_active,is_veg,sort_order')
                .in('menu_item_id', (menuItems || []).map((item) => item.id))
                .order('sort_order', { ascending: true })
              const variantSchemaError = withVariants.error?.message?.toLowerCase() || ''
              if (!withVariants.error) {
                variants = withVariants.data || []
              } else if (variantSchemaError.includes('is_veg') || variantSchemaError.includes('menu_item_variants')) {
                const fallback = await supabase
                  .from('menu_item_variants')
                  .select('id,menu_item_id,name,price_npr,is_active,sort_order')
                  .in('menu_item_id', (menuItems || []).map((item) => item.id))
                  .order('sort_order', { ascending: true })
                variants = (fallback.data || []).map((variant) => ({ ...variant, is_veg: null }))
              }
            }

            return <MenuManager categories={categories || []} items={menuItems || []} variants={variants} businessId={business.id} />
          })()}
        </div>
      )}

      {tab === 'tables' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Business Room and QR</h2>
          {await (async () => {
            const { data: rooms, error } = await supabase
              .from('business_rooms')
              .select('id,room_code,created_at')
              .eq('business_id', business.id)
              .order('room_code', { ascending: true })
            if (error) return <p className="text-sm text-red-600">Could not load rooms. Run migration 0006_add_business_rooms.sql.</p>
            return <RoomsManager slug={business.slug} rooms={rooms || []} businessId={business.id} />
          })()}
        </div>
      )}

      {tab === 'settings' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold">Business Settings</h2>
          <p className="text-sm text-slate-600">Update this business public profile and links.</p>
          {await (async () => {
            const withMapLink = await supabase
              .from('businesses')
              .select('name,slug,phone,room_service_phone,room_service_open_time,room_service_close_time,address,hours_text,logo_url,cover_image_url,google_business_map_link,google_map_link,show_review')
              .eq('id', business.id)
              .maybeSingle()

            let settingsBusiness = withMapLink.data
            const schemaErrorText = withMapLink.error?.message?.toLowerCase() || ''
            if (
              schemaErrorText.includes('google_map_link') ||
              schemaErrorText.includes('show_review') ||
              schemaErrorText.includes('cover_image_url') ||
              schemaErrorText.includes('room_service_phone') ||
              schemaErrorText.includes('room_service_open_time') ||
              schemaErrorText.includes('room_service_close_time') ||
              schemaErrorText.includes('google_business_map_link')
            ) {
              const fallback = await supabase
                .from('businesses')
                .select('name,slug,phone,address,hours_text,logo_url')
                .eq('id', business.id)
                .maybeSingle()

              if (fallback.data) {
                settingsBusiness = {
                  ...fallback.data,
                  room_service_phone: null,
                  room_service_open_time: null,
                  room_service_close_time: null,
                  cover_image_url: null,
                  google_business_map_link: null,
                  google_map_link: null,
                  show_review: true,
                }
              }
            }

            if (!settingsBusiness) return <p className="mt-3 text-sm text-red-600">Business settings could not be loaded.</p>
            return <div className="mt-4"><SettingsForm business={settingsBusiness} businessId={business.id} /></div>
          })()}
        </div>
      )}
    </main>
  )
}
