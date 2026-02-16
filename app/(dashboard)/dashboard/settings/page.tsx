import { requireRole } from '@/lib/auth/requireRole'
import SettingsForm from '@/components/dashboard/SettingsForm'

export default async function DashboardSettingsPage() {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')

  if (!profile.business_id) {
    return <p className="text-sm text-slate-600">No business linked to this account yet.</p>
  }

  const withMapLink = await supabase
    .from('businesses')
    .select('name,slug,phone,room_service_phone,room_service_open_time,room_service_close_time,address,hours_text,logo_url,cover_image_url,google_business_map_link,google_map_link,show_review')
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
    schemaError.includes('google_business_map_link')
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
      }
      schemaNotice =
        'Latest settings fields are not available yet. Run migrations 0002_add_google_map_link.sql, 0003_add_show_review.sql, 0005_add_cover_image_url.sql, 0008_add_room_service_phone.sql, 0014_add_room_service_hours.sql, and 0015_add_google_business_map_link.sql.'
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
    </div>
  )
}
