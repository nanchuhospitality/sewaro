import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GoogleIcon from '@/components/public/GoogleIcon'
import { RESERVED_SLUGS } from '@/lib/utils/constants'
import { getRoomServiceStatus } from '@/lib/utils/roomServiceStatus'

async function getMenuData(slug: string) {
  const supabase = createClient()
  const withMapLink = await supabase
    .from('businesses')
    .select('id,name,slug,logo_url,cover_image_url,address,phone,hours_text,room_service_open_time,room_service_close_time,google_map_link,show_review,enable_nova_delivers_menu,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  let business = withMapLink.data
  const schemaError = withMapLink.error?.message?.toLowerCase() || ''
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
      .select('id,name,slug,logo_url,address,phone,hours_text,is_active')
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

  if (!business) return null

  return { business }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug.toLowerCase()
  if (RESERVED_SLUGS.has(slug)) return { title: 'Not Found — Sewaro' }

  const data = await getMenuData(slug)
  if (!data) return { title: 'Not Found — Sewaro' }

  const title = `${data.business.name} — Sewaro`
  return {
    title,
    description: `${data.business.name} homepage`,
    openGraph: {
      title,
      description: `${data.business.name} homepage`,
    },
  }
}

export default async function PublicMenuPage({ params }: { params: { slug: string } }) {
  const slug = params.slug.toLowerCase()
  if (RESERVED_SLUGS.has(slug)) notFound()

  const data = await getMenuData(slug)
  if (!data) notFound()
  const roomServiceHours =
    data.business.room_service_open_time && data.business.room_service_close_time
      ? `${data.business.room_service_open_time.slice(0, 5)} - ${data.business.room_service_close_time.slice(0, 5)}`
      : null
  const roomServiceStatus = getRoomServiceStatus(data.business.room_service_open_time, data.business.room_service_close_time)

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {data.business.cover_image_url ? (
            <img
              src={data.business.cover_image_url}
              alt={`${data.business.name} cover`}
              className="h-48 w-full object-cover"
            />
          ) : (
            <div className="h-48 w-full bg-gradient-to-br from-slate-200 via-slate-100 to-white" />
          )}
        </div>

        <div className="mt-6 text-center">
          {data.business.logo_url ? (
            <img src={data.business.logo_url} alt={data.business.name} className="mx-auto h-24 w-24 rounded-full border border-slate-200 object-cover" />
          ) : (
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-3xl font-semibold">
              {data.business.name.slice(0, 1)}
            </div>
          )}
          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-500">Welcome to</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{data.business.name}</h1>
        </div>

        <div className="mt-8 grid gap-4">
          <Link
            href={`/${data.business.slug}/menu`}
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

          {data.business.enable_nova_delivers_menu ? (
            <Link href={`/${data.business.slug}/partner-menu`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Late-Night Delivery (Partner)</h2>
              <p className="mt-1 text-sm text-slate-600">Nova Delivers • Hours: 19:00 - 04:00</p>
              <p className="mt-1 text-sm text-slate-600">Delivered to your room. Paid separately.</p>
            </Link>
          ) : null}

          <Link href={`/${data.business.slug}/feedback`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Feedback</h2>
            <p className="mt-1 text-sm text-slate-600">We would love to hear your feedback.</p>
          </Link>

          {data.business.show_review && data.business.google_map_link ? (
            <a
              href={data.business.google_map_link}
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
