'use client'

import { useState } from 'react'
import { updateBusiness } from '@/actions/superadmin'

type Props = {
  business: {
    id: string
    name: string
    slug: string
    phone: string | null
    is_active: boolean
    enable_nova_delivers_menu: boolean
    enable_nova_delivers_ordering: boolean
    nova_delivers_commission_percent: number
    nova_delivers_delivery_charge_npr: number
    nova_delivers_support_phone: string | null
    enable_nova_mart_menu: boolean
    enable_nova_mart_ordering: boolean
    nova_mart_commission_percent: number
    nova_mart_delivery_charge_npr: number
    nova_mart_support_phone: string | null
  }
  novaDeliversSupported?: boolean
  novaMartSupported?: boolean
}

export default function BusinessEditForm({ business, novaDeliversSupported = true, novaMartSupported = true }: Props) {
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  return (
    <form
      action={async (formData) => {
        setStatus(null)
        const res = await updateBusiness(formData)
        if (res.error) {
          setStatus({ type: 'error', message: res.error })
          return
        }
        setStatus({ type: 'success', message: 'Business updated.' })
      }}
      className="mt-4 space-y-3"
    >
      <input type="hidden" name="id" value={business.id} />

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Business name</p>
        <input name="name" defaultValue={business.name} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Slug</p>
        <input name="slug" defaultValue={business.slug} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Phone</p>
        <input name="phone" defaultValue={business.phone || ''} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Business status</p>
          <select name="is_active" defaultValue={String(business.is_active)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-900">Nova Delivers Partner Program</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Nova Delivers Menu</p>
            <select
              name="enable_nova_delivers_menu"
              defaultValue={String(business.enable_nova_delivers_menu)}
              disabled={!novaDeliversSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Nova Ordering</p>
            <select
              name="enable_nova_delivers_ordering"
              defaultValue={String(business.enable_nova_delivers_ordering)}
              disabled={!novaDeliversSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Commission (%)</p>
            <input
              name="nova_delivers_commission_percent"
              type="number"
              min={0}
              defaultValue={business.nova_delivers_commission_percent}
              disabled={!novaDeliversSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Delivery Charge (NPR)</p>
            <input
              name="nova_delivers_delivery_charge_npr"
              type="number"
              min={0}
              defaultValue={business.nova_delivers_delivery_charge_npr}
              disabled={!novaDeliversSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Support Phone</p>
            <input
              name="nova_delivers_support_phone"
              defaultValue={business.nova_delivers_support_phone || ''}
              placeholder="e.g. 9800000000"
              disabled={!novaDeliversSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>
        {!novaDeliversSupported ? (
          <p className="mt-2 text-xs text-amber-700">
            Run migrations <code>0016_add_business_enable_nova_delivers_menu.sql</code>, <code>0017_add_nova_delivers_partner_fields.sql</code>, <code>0019_add_business_enable_nova_delivers_ordering.sql</code>, and <code>0020_add_business_nova_delivers_support_phone.sql</code> to enable this section.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-900">Nova Mart Partner Program</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Nova Mart Menu</p>
            <select
              name="enable_nova_mart_menu"
              defaultValue={String(business.enable_nova_mart_menu)}
              disabled={!novaMartSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Nova Mart Ordering</p>
            <select
              name="enable_nova_mart_ordering"
              defaultValue={String(business.enable_nova_mart_ordering)}
              disabled={!novaMartSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Commission (%)</p>
            <input
              name="nova_mart_commission_percent"
              type="number"
              min={0}
              defaultValue={business.nova_mart_commission_percent}
              disabled={!novaMartSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Delivery Charge (NPR)</p>
            <input
              name="nova_mart_delivery_charge_npr"
              type="number"
              min={0}
              defaultValue={business.nova_mart_delivery_charge_npr}
              disabled={!novaMartSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Support Phone</p>
            <input
              name="nova_mart_support_phone"
              defaultValue={business.nova_mart_support_phone || ''}
              placeholder="e.g. 9800000000"
              disabled={!novaMartSupported}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>
        {!novaMartSupported ? (
          <p className="mt-2 text-xs text-amber-700">
            Run migration <code>0027_add_nova_mart_partner_fields.sql</code> to enable this section.
          </p>
        ) : null}
      </div>

      {status && (
        <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}

      <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Save changes</button>
    </form>
  )
}
