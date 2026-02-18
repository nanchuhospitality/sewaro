import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createClient()
  const withLatest = await supabase
    .from('businesses')
    .select('name,slug,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let business = withLatest.data

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 -top-40 h-80 bg-gradient-to-b from-amber-100 via-orange-50 to-transparent" />
      <div className="absolute -left-16 top-44 h-44 w-44 rounded-full bg-emerald-100 blur-2xl" />
      <div className="absolute -right-16 top-80 h-44 w-44 rounded-full bg-amber-100 blur-2xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Hotel Tech Platform</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">Sewaro powers in-room menu, orders, and support in one flow.</h1>
            <p className="mt-4 max-w-xl text-sm text-slate-600 md:text-base">
              Guests scan, order, and request help instantly. Hotel teams manage rooms, menus, and feedback from a central dashboard. Nova Delivers adds partner
              delivery operations with live order tracking.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {business ? (
                <Link href={`/${business.slug}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Open Live Menu
                </Link>
              ) : (
                <span className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-600">No active menu yet</span>
              )}
              <Link href="/login" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Login to Dashboard
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Guest Journey</p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">Scan {'->'} Browse {'->'} Order</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs uppercase tracking-wide text-blue-700">Room Service</p>
                <p className="mt-1 text-sm font-semibold text-blue-900">Fast in-room ordering flow</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-700">Partner Program</p>
                <p className="mt-1 text-sm font-semibold text-amber-900">Nova Delivers analytics</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1400&q=80"
                alt="Hotel room with in-room service setup"
                className="h-80 w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
                <p className="text-sm font-semibold">Hotel Room Experience</p>
                <p className="mt-1 text-xs text-slate-100">Designed for guests ordering directly from their room.</p>
              </div>
            </div>
            <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:grid-cols-[0.45fr_0.55fr]">
              <img
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80"
                alt="Burger platter"
                className="h-40 w-full object-cover sm:h-full"
              />
              <div className="p-4">
                <p className="text-sm font-semibold text-slate-900">Featured: Burger Favorites</p>
                <p className="mt-1 text-xs text-slate-600">
                  Showcase your menu beautifully and turn every room into a quick ordering point.
                </p>
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  QR Powered Hospitality
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">For Guests</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>QR-first browsing with room-specific links</li>
              <li>Order via WhatsApp or OTP flow</li>
              <li>Feedback and support ticket continuation</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">For Business Admin</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Rooms and QR generation (single + CSV bulk)</li>
              <li>Menu and settings management</li>
              <li>Partner dashboard with completed orders and commission</li>
            </ul>
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
          <h2 className="text-2xl font-bold">Ready to manage your hotel service digitally?</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-200">
            Sign in as Business Admin to manage your property dashboard, or open the public menu to preview the guest experience.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/login" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
              Login
            </Link>
            {business ? (
              <Link href={`/${business.slug}`} className="rounded-xl border border-slate-400 px-4 py-2 text-sm font-semibold text-white">
                Preview Menu
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
