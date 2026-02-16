'use client'

import { useState } from 'react'
import { updateBusinessStatus } from '@/actions/superadmin'

type Props = {
  businessId: string
  isActive: boolean
}

export default function BusinessStatusForm({ businessId, isActive }: Props) {
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  return (
    <div className="mt-4">
      <form
        action={async (formData) => {
          setStatus(null)
          const res = await updateBusinessStatus(formData)
          if (res.error) {
            setStatus({ type: 'error', message: res.error })
            return
          }
          setStatus({ type: 'success', message: 'Business status updated.' })
        }}
        className="flex items-center gap-3"
      >
        <input type="hidden" name="id" value={businessId} />
        <select name="is_active" defaultValue={String(isActive)} className="rounded border border-slate-300 px-3 py-2 text-sm">
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Update status</button>
      </form>
      {status && (
        <p className={`mt-2 text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}
    </div>
  )
}
