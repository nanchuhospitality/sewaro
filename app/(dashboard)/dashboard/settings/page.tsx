import { requireRole } from '@/lib/auth/requireRole'
import SettingsForm from '@/components/dashboard/SettingsForm'

export default async function DashboardSettingsPage() {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')

  if (!profile.business_id) {
    return <p className="text-sm text-slate-600">No business linked to this account yet.</p>
  }

  const withMapLink = await supabase
    .from('businesses')
    .select('name,slug,phone,room_service_phone,room_service_open_time,room_service_close_time,address,hours_text,logo_url,cover_image_url,google_business_map_link,google_map_link,show_review,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_commission_percent,nova_delivers_delivery_charge_npr,nova_delivers_support_phone,enable_nova_mart_menu,enable_nova_mart_ordering,nova_mart_commission_percent,nova_mart_delivery_charge_npr,nova_mart_support_phone')
    .eq('id', profile.business_id)
    .maybeSingle()

  let business = withMapLink.data
  let schemaNotice: string | null = null

  const schemaError = withMapLink.error?.message?.toLowerCase() || ''
  if (
    schemaError.includes('google_map_link') ||
    schemaError.includes('show_review') ||
    schemaError.includes('cover_image_url') ||
    schemaError.includes('room_service_phone') ||
    schemaError.includes('room_service_open_time') ||
    schemaError.includes('room_service_close_time') ||
    schemaError.includes('google_business_map_link') ||
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
  ) {
    const fallback = await supabase
      .from('businesses')
      .select('name,slug,phone,address,hours_text,logo_url')
      .eq('id', profile.business_id)
      .maybeSingle()

    if (fallback.data) {
      business = {
        ...fallback.data,
        room_service_phone: null,
        room_service_open_time: null,
        room_service_close_time: null,
        cover_image_url: null,
        google_business_map_link: null,
        google_map_link: null,
        show_review: true,
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
      schemaNotice =
        'Latest settings fields are not available yet. Run migrations 0002_add_google_map_link.sql, 0003_add_show_review.sql, 0005_add_cover_image_url.sql, 0008_add_room_service_phone.sql, 0014_add_room_service_hours.sql, 0015_add_google_business_map_link.sql, 0016_add_business_enable_nova_delivers_menu.sql, 0017_add_nova_delivers_partner_fields.sql, 0019_add_business_enable_nova_delivers_ordering.sql, 0020_add_business_nova_delivers_support_phone.sql, and 0027_add_nova_mart_partner_fields.sql.'
    }
  }

  if (!business) return <p className="text-sm text-slate-600">Business not found.</p>

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold">Business settings</h1>
      <p className="mt-1 text-sm text-slate-600">Update your public menu profile.</p>
      {schemaNotice && <p className="mt-2 text-sm text-amber-700">{schemaNotice}</p>}
      <div className="mt-4">
        <SettingsForm business={business} />
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Nova Partner Program (View Only)</p>
        <p className="mt-1 text-xs text-slate-600">These values are managed by superadmin and cannot be edited here.</p>
        <div className="mt-3 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">Nova Delivers</p>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Partner Menu</p>
                <p className="mt-1 font-medium text-slate-900">{business.enable_nova_delivers_menu ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Ordering</p>
                <p className="mt-1 font-medium text-slate-900">{business.enable_nova_delivers_ordering ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Commission Percent</p>
                <p className="mt-1 font-medium text-slate-900">{Number(business.nova_delivers_commission_percent || 0)}%</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Charge</p>
                <p className="mt-1 font-medium text-slate-900">{Number(business.nova_delivers_delivery_charge_npr || 0)}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Support Phone</p>
                <p className="mt-1 font-medium text-slate-900">{business.nova_delivers_support_phone || 'Not set'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">Nova Mart</p>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Partner Menu</p>
                <p className="mt-1 font-medium text-slate-900">{business.enable_nova_mart_menu ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Ordering</p>
                <p className="mt-1 font-medium text-slate-900">{business.enable_nova_mart_ordering ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Commission Percent</p>
                <p className="mt-1 font-medium text-slate-900">{Number(business.nova_mart_commission_percent || 0)}%</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Charge</p>
                <p className="mt-1 font-medium text-slate-900">{Number(business.nova_mart_delivery_charge_npr || 0)}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Support Phone</p>
                <p className="mt-1 font-medium text-slate-900">{business.nova_mart_support_phone || 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
