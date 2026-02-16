'use client'

import { useState } from 'react'
import { updateBusinessSettings } from '@/actions/business'
import StorageUploader from './StorageUploader'

type Business = {
  name: string
  slug: string
  phone: string | null
  room_service_phone: string | null
  room_service_open_time: string | null
  room_service_close_time: string | null
  address: string | null
  hours_text: string | null
  logo_url: string | null
  cover_image_url: string | null
  google_business_map_link: string | null
  google_map_link: string | null
  show_review: boolean
}

export default function SettingsForm({ business, businessId }: { business: Business; businessId?: string }) {
  const [logoUrl, setLogoUrl] = useState(business.logo_url || '')
  const [coverImageUrl, setCoverImageUrl] = useState(business.cover_image_url || '')
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <form
      action={async (formData) => {
        setPending(true)
        setStatus(null)
        if (businessId) formData.set('business_id', businessId)
        formData.set('logo_url', logoUrl)
        formData.set('cover_image_url', coverImageUrl)
        const res = await updateBusinessSettings(formData)
        setPending(false)
        if (res.error) {
          setStatus({ type: 'error', message: res.error })
          return
        }
        setStatus({ type: 'success', message: 'Saved successfully.' })
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1 block text-sm">Business name</label>
        <input name="name" defaultValue={business.name} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Slug</label>
        <input name="slug" defaultValue={business.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Phone</label>
        <input name="phone" defaultValue={business.phone || ''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Room service phone</label>
        <input
          name="room_service_phone"
          defaultValue={business.room_service_phone || ''}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm">In-room dining opens at</label>
          <input
            name="room_service_open_time"
            type="time"
            defaultValue={business.room_service_open_time || ''}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">In-room dining closes at</label>
          <input
            name="room_service_close_time"
            type="time"
            defaultValue={business.room_service_close_time || ''}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm">Address</label>
        <input name="address" defaultValue={business.address || ''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm">Google Maps business link</label>
        <input
          name="google_business_map_link"
          defaultValue={business.google_business_map_link || ''}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm">Google Maps review link</label>
        <input
          name="google_map_link"
          defaultValue={business.google_map_link || ''}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="show_review" defaultChecked={business.show_review} className="h-4 w-4 rounded border-slate-300" />
        Show review button to customers
      </label>
      <div>
        <label className="mb-1 block text-sm">Hours text</label>
        <textarea name="hours_text" defaultValue={business.hours_text || ''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
      </div>
      <div>
        <label className="mb-1 block text-sm">Logo URL</label>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <div className="mt-2">
          <StorageUploader folder="logos" onUploaded={(url) => setLogoUrl(url)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm">Cover image URL</label>
        <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <div className="mt-2">
          <StorageUploader folder="covers" onUploaded={(url) => setCoverImageUrl(url)} />
        </div>
      </div>
      {status && (
        <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}
      <button disabled={pending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? 'Saving...' : 'Save settings'}
      </button>
    </form>
  )
}
