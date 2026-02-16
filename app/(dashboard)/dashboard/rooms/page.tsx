import { requireRole } from '@/lib/auth/requireRole'
import RoomsManager from '@/components/dashboard/RoomsManager'

export default async function DashboardRoomsPage() {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')

  if (!profile.business_id) {
    return <p className="text-sm text-slate-600">No business linked to this account yet.</p>
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('slug')
    .eq('id', profile.business_id)
    .maybeSingle()

  if (!business) {
    return <p className="text-sm text-red-600">Business not found.</p>
  }

  const { data: rooms, error } = await supabase
    .from('business_rooms')
    .select('id,room_code,created_at')
    .eq('business_id', profile.business_id)
    .order('room_code', { ascending: true })

  if (error) {
    return <p className="text-sm text-red-600">Could not load rooms. Run migration 0006_add_business_rooms.sql.</p>
  }

  return <RoomsManager slug={business.slug} rooms={rooms || []} />
}
