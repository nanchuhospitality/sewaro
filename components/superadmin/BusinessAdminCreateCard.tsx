'use client'

import { useState } from 'react'
import { createBusinessAdminUser } from '@/actions/superadmin'

type Props = {
  businessId: string
}

export default function BusinessAdminCreateCard({ businessId }: Props) {
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [credentials, setCredentials] = useState<null | {
    loginUrl: string
    email: string
    tempPassword: string
    businessSlug: string
  }>(null)

  const copyCredentials = async () => {
    if (!credentials) return
    const text = [
      `Login URL: ${credentials.loginUrl}`,
      `Email: ${credentials.email}`,
      `Temp password: ${credentials.tempPassword}`,
      `Business slug: ${credentials.businessSlug}`,
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setStatus({ type: 'success', message: 'Credentials copied.' })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Create business admin user</h2>
      <form
        action={async (fd) => {
          setStatus(null)
          setCredentials(null)
          fd.set('business_id', businessId)
          const res = await createBusinessAdminUser(fd)
          if (res.error) {
            setStatus({ type: 'error', message: res.error })
            return
          }
          setStatus({ type: 'success', message: 'Business admin user created.' })
          if (res.credentials) setCredentials(res.credentials)
        }}
        className="mt-3 grid gap-2"
      >
        <input name="email" type="email" required className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="admin@example.com" />
        <input name="temp_password" type="text" required className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Temporary password" />
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create user</button>
      </form>

      {status && (
        <p className={`mt-2 text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}

      {credentials && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p><span className="font-medium">Login URL:</span> {credentials.loginUrl}</p>
          <p><span className="font-medium">Email:</span> {credentials.email}</p>
          <p><span className="font-medium">Temp password:</span> {credentials.tempPassword}</p>
          <p><span className="font-medium">Business slug:</span> {credentials.businessSlug}</p>
          <button onClick={copyCredentials} className="mt-2 rounded border border-slate-300 px-3 py-1 text-xs">
            Copy credentials
          </button>
        </div>
      )}
    </div>
  )
}
