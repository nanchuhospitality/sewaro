'use client'

import { useState } from 'react'
import { createCentralOpsUser } from '@/actions/superadmin'

export default function CentralOpsCreateForm() {
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [credentials, setCredentials] = useState<{ loginUrl: string; email: string; tempPassword: string } | null>(null)

  return (
    <div className="space-y-4">
      <form
        action={async (formData) => {
          setStatus(null)
          setCredentials(null)
          const res = await createCentralOpsUser(formData)
          if (res.error) {
            setStatus({ type: 'error', message: res.error })
            return
          }
          setStatus({ type: 'success', message: 'Central Ops user created.' })
          setCredentials(res.credentials || null)
        }}
        className="grid gap-3"
      >
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Email</p>
          <input name="email" type="email" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Temporary Password</p>
          <input name="temp_password" type="text" required minLength={6} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Create Central Ops User</button>
      </form>

      {status ? (
        <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{status.message}</p>
      ) : null}

      {credentials ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p><span className="font-medium">Login URL:</span> {credentials.loginUrl}</p>
          <p><span className="font-medium">Email:</span> {credentials.email}</p>
          <p><span className="font-medium">Temporary Password:</span> {credentials.tempPassword}</p>
        </div>
      ) : null}
    </div>
  )
}
