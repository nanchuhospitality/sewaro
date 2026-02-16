import { redirect } from 'next/navigation'
import OnboardingBusinessForm from '@/components/dashboard/OnboardingBusinessForm'
import { requireRole } from '@/lib/auth/requireRole'

export default async function OnboardingPage() {
  const { profile } = await requireRole('BUSINESS_ADMIN')

  if (profile.business_id) {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Add business</h1>
        <p className="mt-1 text-sm text-slate-600">Set up your public menu profile.</p>
        <OnboardingBusinessForm />
      </div>
    </main>
  )
}
