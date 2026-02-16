import Link from 'next/link'
import { requireRole } from '@/lib/auth/requireRole'

export default async function SuperadminPage({ searchParams }: { searchParams?: { q?: string } }) {
  const { supabase } = await requireRole('SUPERADMIN')
  const q = (searchParams?.q || '').trim()

  let query = supabase
    .from('businesses')
    .select('id,name,slug,is_active,enable_nova_delivers_menu,created_at')
    .order('created_at', { ascending: false })

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const withNovaFlag = await query
  const schemaError = withNovaFlag.error?.message?.toLowerCase() || ''
  let businesses = withNovaFlag.data
  if (!businesses && schemaError.includes('enable_nova_delivers_menu')) {
    let fallbackQuery = supabase
      .from('businesses')
      .select('id,name,slug,is_active,created_at')
      .order('created_at', { ascending: false })
    if (q) fallbackQuery = fallbackQuery.ilike('name', `%${q}%`)
    const fallback = await fallbackQuery
    businesses = (fallback.data || []).map((business) => ({ ...business, enable_nova_delivers_menu: false }))
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Superadmin</h1>
        <Link href="/superadmin/businesses/new" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">New business</Link>
      </div>

      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search business"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </form>

      <div className="space-y-2">
        {(businesses || []).map((business) => {
          const novaEnabled =
            business.enable_nova_delivers_menu === true ||
            business.enable_nova_delivers_menu === 'true' ||
            business.enable_nova_delivers_menu === 1

          return (
            <Link key={business.id} href={`/superadmin/businesses/${business.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="inline-flex items-center gap-2 font-medium">
                  <span>{business.name}</span>
                  {novaEnabled ? (
                    <span className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Nova Delivers Partner
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-600">/{business.slug} · {business.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
