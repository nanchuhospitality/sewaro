'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBusiness } from '@/actions/superadmin'

export default function NewBusinessForm() {
  const router = useRouter()
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <form
      action={async (formData) => {
        setPending(true)
        setStatus(null)
        const res = await createBusiness(formData)
        setPending(false)

        if (res.error) {
          setStatus({ type: 'error', message: res.error })
          return
        }

        setStatus({ type: 'success', message: 'Business created successfully.' })
        router.refresh()
      }}
      className="mt-4 space-y-3"
    >
      <input name="name" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Business name" />
      <input name="slug" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="business-slug" />
      <input name="phone" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" />
      <input name="admin_email" type="email" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Admin email" />
      <input name="admin_password" type="text" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Admin password" />

      {status && (
        <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}

      <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? 'Creating...' : 'Create'}
      </button>
    </form>
  )
}
