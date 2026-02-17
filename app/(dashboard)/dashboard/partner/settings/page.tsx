import { requireRole } from '@/lib/auth/requireRole'

export default async function PartnerSettingsPage() {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')

  if (!profile.business_id) {
    return <p className="text-sm text-slate-600">No business linked to this account yet.</p>
  }

  const withPartner = await supabase
    .from('businesses')
    .select('name,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_commission_percent,nova_delivers_delivery_charge_npr,nova_delivers_support_phone,enable_nova_mart_menu,enable_nova_mart_ordering,nova_mart_commission_percent,nova_mart_delivery_charge_npr,nova_mart_support_phone')
    .eq('id', profile.business_id)
    .maybeSingle()

  let business = withPartner.data
  let schemaNotice: string | null = null

  const schemaError = withPartner.error?.message?.toLowerCase() || ''
  if (
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
      .select('name')
      .eq('id', profile.business_id)
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
      schemaNotice =
        'Nova partner fields are not available yet. Run migrations 0016_add_business_enable_nova_delivers_menu.sql, 0017_add_nova_delivers_partner_fields.sql, 0019_add_business_enable_nova_delivers_ordering.sql, 0020_add_business_nova_delivers_support_phone.sql, and 0027_add_nova_mart_partner_fields.sql.'
    }
  }

  if (!business) return <p className="text-sm text-slate-600">Business not found.</p>

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold">Partner Program Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Partner program settings for {business.name} (view only).</p>
      {schemaNotice ? <p className="mt-2 text-sm text-amber-700">{schemaNotice}</p> : null}

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">Nova Delivers</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Partner Menu</p>
              <p className="mt-1 font-medium text-slate-900">{business.enable_nova_delivers_menu ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ordering</p>
              <p className="mt-1 font-medium text-slate-900">{business.enable_nova_delivers_ordering ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Commission Percent</p>
              <p className="mt-1 font-medium text-slate-900">{Number(business.nova_delivers_commission_percent || 0)}%</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Charge</p>
              <p className="mt-1 font-medium text-slate-900">{Number(business.nova_delivers_delivery_charge_npr || 0)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Support Phone</p>
              <p className="mt-1 font-medium text-slate-900">{business.nova_delivers_support_phone || 'Not set'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">Nova Mart</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Partner Menu</p>
              <p className="mt-1 font-medium text-slate-900">{business.enable_nova_mart_menu ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ordering</p>
              <p className="mt-1 font-medium text-slate-900">{business.enable_nova_mart_ordering ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Commission Percent</p>
              <p className="mt-1 font-medium text-slate-900">{Number(business.nova_mart_commission_percent || 0)}%</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Charge</p>
              <p className="mt-1 font-medium text-slate-900">{Number(business.nova_mart_delivery_charge_npr || 0)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Support Phone</p>
              <p className="mt-1 font-medium text-slate-900">{business.nova_mart_support_phone || 'Not set'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
