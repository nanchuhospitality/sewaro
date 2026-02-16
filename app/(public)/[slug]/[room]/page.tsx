import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import GoogleIcon from '@/components/public/GoogleIcon'
import ContinueSupportBanner from '@/components/public/ContinueSupportBanner'
import { RESERVED_SLUGS, ROOM_REGEX } from '@/lib/utils/constants'
import { formatRoomLabel } from '@/lib/utils/rooms'
import { getRoomServiceStatus } from '@/lib/utils/roomServiceStatus'

async function getBusiness(slug: string) {
  const supabase = createClient()
  const withBusiness = await supabase
    .from('businesses')
    .select('id,name,slug,logo_url,cover_image_url,room_service_open_time,room_service_close_time,google_map_link,show_review,enable_nova_delivers_menu,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  let business = withBusiness.data
  const schemaError = withBusiness.error?.message?.toLowerCase() || ''
  if (
    !business &&
    (
      schemaError.includes('google_map_link') ||
      schemaError.includes('show_review') ||
      schemaError.includes('cover_image_url') ||
      schemaError.includes('room_service_open_time') ||
      schemaError.includes('room_service_close_time') ||
      schemaError.includes('enable_nova_delivers_menu')
    )
  ) {
    const fallback = await supabase
      .from('businesses')
      .select('id,name,slug,logo_url,is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    if (fallback.data) {
      business = {
        ...fallback.data,
        cover_image_url: null,
        room_service_open_time: null,
        room_service_close_time: null,
        google_map_link: null,
        show_review: true,
        enable_nova_delivers_menu: false,
      }
    }
  }

  return business
}

export async function generateMetadata({ params }: { params: { slug: string; room: string } }): Promise<Metadata> {
  const slug = params.slug.toLowerCase()
  const room = params.room.toLowerCase()
  if (RESERVED_SLUGS.has(slug) || !ROOM_REGEX.test(room)) return { title: 'Not Found — Sewaro' }

  const business = await getBusiness(slug)
  if (!business) return { title: 'Not Found — Sewaro' }

  const title = `${business.name} Room ${formatRoomLabel(room)} — Sewaro`
  return {
    title,
    description: `${business.name} room homepage`,
    openGraph: {
      title,
      description: `${business.name} room homepage`,
    },
  }
}

export default async function RoomHomepagePage({ params }: { params: { slug: string; room: string } }) {
  const slug = params.slug.toLowerCase()
  const room = params.room.toLowerCase()
  if (RESERVED_SLUGS.has(slug) || !ROOM_REGEX.test(room)) notFound()

  const business = await getBusiness(slug)
  if (!business) notFound()
  const roomServiceHours =
    business.room_service_open_time && business.room_service_close_time
      ? `${business.room_service_open_time.slice(0, 5)} - ${business.room_service_close_time.slice(0, 5)}`
      : null
  const roomServiceStatus = getRoomServiceStatus(business.room_service_open_time, business.room_service_close_time)
  let activeOrderCode: string | null = null
  try {
    const admin = createAdminClient()
    const { data: activeOrder } = await admin
      .from('nova_orders')
      .select('order_code,status')
      .eq('business_id', business.id)
      .eq('room', room)
      .in('status', ['NEW', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    activeOrderCode = activeOrder?.order_code || null
  } catch {
    activeOrderCode = null
  }

  const roomLabel = formatRoomLabel(room)

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <ContinueSupportBanner businessId={business.id} room={room} />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {business.cover_image_url ? (
            <img src={business.cover_image_url} alt={`${business.name} cover`} className="h-48 w-full object-cover" />
          ) : (
            <div className="h-48 w-full bg-gradient-to-br from-slate-200 via-slate-100 to-white" />
          )}
        </div>

        <div className="mt-6 text-center">
          {business.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="mx-auto h-24 w-24 rounded-full border border-slate-200 object-cover" />
          ) : (
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-3xl font-semibold">
              {business.name.slice(0, 1)}
            </div>
          )}
          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-500">Welcome to</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{business.name}</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">Room {roomLabel}</p>
        </div>

        <div className="mt-8 grid gap-4">
          <Link
            href={`/${business.slug}/${room}/menu`}
            className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100 ${
              roomServiceHours && !roomServiceStatus.isOpen ? 'opacity-90' : ''
            }`}
          >
            <h2 className="text-lg font-semibold text-slate-900">View In-Room Dining Menu</h2>
            {roomServiceHours ? (
              <p className="mt-1 text-sm text-slate-600">
                Hours: {roomServiceHours}{' '}
                <span className={roomServiceStatus.isOpen ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>
                  ({roomServiceStatus.isOpen ? 'Open' : 'Closed'})
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">In-room dining hours available at front desk.</p>
            )}
          </Link>

          {business.enable_nova_delivers_menu ? (
            <Link href={`/${business.slug}/${room}/partner-menu`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Late-Night Delivery (Partner)</h2>
              <p className="mt-1 text-sm text-slate-600">Nova Delivers • Hours: 19:00 - 04:00</p>
              <p className="mt-1 text-sm text-slate-600">Delivered to your room. Paid separately.</p>
            </Link>
          ) : null}

          {activeOrderCode ? (
            <Link href={`/track/${activeOrderCode}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Track your order</h2>
              <p className="mt-1 text-sm text-slate-600">Order {activeOrderCode} is in progress.</p>
            </Link>
          ) : null}

          <Link href={`/${business.slug}/${room}/feedback`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Feedback</h2>
            <p className="mt-1 text-sm text-slate-600">We would love to hear your feedback.</p>
          </Link>

          {business.show_review && business.google_map_link ? (
            <a
              href={business.google_map_link}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
            >
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                <GoogleIcon />
                <span>Review us on Google</span>
              </h2>
              <p className="mt-1 text-sm text-slate-600">Share your experience on Google Maps.</p>
            </a>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                <GoogleIcon />
                <span>Review us on Google</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">Review is not available.</p>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-5 text-center">
        <p className="text-sm text-slate-600">Powered by Sewaro</p>
        <p className="mt-1 text-sm text-slate-600">Made with ❤️ in Nepal</p>
      </footer>
    </main>
  )
}
