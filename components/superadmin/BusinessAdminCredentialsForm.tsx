'use client'

import { useState } from 'react'
import { updateBusinessAdminCredentials } from '@/actions/superadmin'

type Props = {
  businessId: string
  loginUrl: string
  adminUserId: string | null
  adminEmail: string | null
}

export default function BusinessAdminCredentialsForm({
  businessId,
  loginUrl,
  adminUserId,
  adminEmail,
}: Props) {
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Login Details</h2>
      <div className="mt-2 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-700">Login URL:</span> {loginUrl}
        </p>
        <p>
          <span className="font-medium text-slate-700">Admin Email:</span> {adminEmail || 'Not available'}
        </p>
      </div>

      <form
        action={async (formData) => {
          setStatus(null)
          const res = await updateBusinessAdminCredentials(formData)
          if (res.error) {
            setStatus({ type: 'error', message: res.error })
            return
          }
          setStatus({ type: 'success', message: 'Admin credentials updated.' })
        }}
        className="mt-4 space-y-3"
      >
        <input type="hidden" name="business_id" value={businessId} />
        <input type="hidden" name="user_id" value={adminUserId || ''} />

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Change email</p>
          <input
            name="email"
            type="email"
            defaultValue={adminEmail || ''}
            disabled={!adminUserId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            placeholder="new-admin@example.com"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Change password</p>
          <input
            name="password"
            type="text"
            disabled={!adminUserId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            placeholder="New password"
          />
        </div>

        {status && (
          <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {status.message}
          </p>
        )}

        <button
          disabled={!adminUserId}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Update credentials
        </button>
      </form>
    </div>
  )
}
