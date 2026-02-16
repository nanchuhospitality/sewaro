import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import GoogleIcon from '@/components/public/GoogleIcon'

export default async function HomePage() {
  const supabase = createClient()
  const withLatest = await supabase
    .from('businesses')
    .select('name,slug,google_map_link,show_review,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let business = withLatest.data
  const schemaError = withLatest.error?.message?.toLowerCase() || ''
  if (!business && schemaError.includes('show_review')) {
    const fallback = await supabase
      .from('businesses')
      .select('name,slug,google_map_link,is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (fallback.data) business = { ...fallback.data, show_review: true }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome</h1>
        <p className="mt-1 text-sm text-slate-600">Choose an option</p>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">View Menu</h2>
            <p className="mt-1 text-sm text-slate-600">Open the digital menu.</p>
            {business ? (
              <Link href={`/${business.slug}`} className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                View Menu
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active menu available right now.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <GoogleIcon />
              <span>Review us on Google</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">Leave your review on Google Maps.</p>
            {business?.show_review && business.google_map_link ? (
              <a
                href={business.google_map_link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                <span className="inline-flex items-center gap-2">
                  <GoogleIcon className="h-4 w-4" />
                  <span>Review us on Google</span>
                </span>
              </a>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Review is not available.</p>
            )}
          </div>

          <div className="pt-2">
            <Link href="/login" className="text-sm text-slate-600 underline-offset-2 hover:underline">
              Admin Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
