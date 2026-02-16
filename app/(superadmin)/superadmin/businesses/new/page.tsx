import NewBusinessForm from '@/components/superadmin/NewBusinessForm'
import { requireRole } from '@/lib/auth/requireRole'

export default async function NewBusinessPage() {
  await requireRole('SUPERADMIN')

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Create business</h1>
        <NewBusinessForm />
      </div>
    </main>
  )
}
