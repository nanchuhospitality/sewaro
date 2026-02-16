'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  onUploaded: (url: string) => void
  folder: string
}

export default function StorageUploader({ onUploaded, folder }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)

    const supabase = createClient()
    const path = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`

    const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('business-assets').getPublicUrl(path)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  return (
    <div className="space-y-1">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="text-xs"
      />
      {uploading && <p className="text-xs text-slate-500">Uploading...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
