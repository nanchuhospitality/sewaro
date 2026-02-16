'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOwnBusiness } from '@/actions/business'

export default function OnboardingBusinessForm() {
  const router = useRouter()
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <form
      action={async (formData) => {
        setPending(true)
        setStatus(null)
        const res = await createOwnBusiness(formData)
        setPending(false)

        if (res.error) {
          setStatus({ type: 'error', message: res.error })
          return
        }

        setStatus({ type: 'success', message: 'Business created successfully. Redirecting...' })
        router.replace('/dashboard')
        router.refresh()
      }}
      className="mt-4 space-y-3"
    >
      <div>
        <label className="mb-1 block text-sm">Business name</label>
        <input name="name" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Slug</label>
        <input name="slug" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Phone</label>
        <input name="phone" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Address</label>
        <input name="address" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Hours text</label>
        <textarea name="hours_text" rows={3} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {status && (
        <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}

      <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? 'Creating...' : 'Create business'}
      </button>
    </form>
  )
}
