import { requireRole } from '@/lib/auth/requireRole'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import CentralOpsCreateForm from '@/components/superadmin/CentralOpsCreateForm'
import { deleteCentralOpsUser } from '@/actions/superadmin'

function serverAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
  return createSupabaseClient(url, key, { auth: { persistSession: false } })
}

export default async function SuperadminCentralOpsPage() {
  const { user, supabase } = await requireRole('SUPERADMIN')
  const { data: opsProfiles } = await supabase
    .from('profiles')
    .select('user_id,created_at')
    .eq('role', 'CENTRAL_OPS')
    .order('created_at', { ascending: false })

  const admin = serverAdminClient()
  const opsUsers = await Promise.all(
    (opsProfiles || []).map(async (profile) => {
      const info = await admin.auth.admin.getUserById(profile.user_id)
      return {
        user_id: profile.user_id,
        created_at: profile.created_at,
        email: info.data.user?.email || 'Unknown email',
      }
    }),
  )

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Central Ops Users</h1>
        <p className="mt-1 text-sm text-slate-600">Create login credentials for Central Ops team members.</p>
        <div className="mt-4">
          <CentralOpsCreateForm />
        </div>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h2 className="text-base font-semibold text-slate-900">Existing Users</h2>
          <div className="mt-3 space-y-2">
            {opsUsers.length === 0 ? (
              <p className="text-sm text-slate-500">No Central Ops users created yet.</p>
            ) : (
              opsUsers.map((opsUser) => (
                <div key={opsUser.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{opsUser.email}</p>
                    <p className="text-xs text-slate-500">{new Date(opsUser.created_at).toLocaleString()}</p>
                  </div>
                  <form
                    action={async (formData) => {
                      'use server'
                      await deleteCentralOpsUser(formData)
                    }}
                  >
                    <input type="hidden" name="user_id" value={opsUser.user_id} />
                    <button
                      disabled={opsUser.user_id === user.id}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
