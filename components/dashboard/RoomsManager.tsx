'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, deleteRoom } from '@/actions/rooms'
import { buildQrImageUrl, formatRoomLabel } from '@/lib/utils/rooms'

type Room = {
  id: string
  room_code: string
  created_at: string
}

export default function RoomsManager({ slug, rooms, businessId }: { slug: string; rooms: Room[]; businessId?: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  const baseUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
    if (typeof window !== 'undefined') return window.location.origin
    return 'http://localhost:3000'
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Hotel Rooms</h1>
        <p className="mt-1 text-sm text-slate-600">Create room codes and generate QR links for in-room dining menu.</p>

        <form
          action={async (fd) => {
            setPending(true)
            setStatus(null)
            if (businessId) fd.set('business_id', businessId)
            const res = await createRoom(fd)
            setPending(false)
            if (res.error) {
              setStatus({ type: 'error', message: res.error })
              return
            }
            setStatus({ type: 'success', message: 'Room created.' })
            router.refresh()
          }}
          className="mt-4 flex gap-2"
        >
          <input
            name="room_code"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. 101, deluxe-2, a-12"
          />
          <button disabled={pending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? 'Adding...' : 'Add Room'}
          </button>
        </form>

        {status && (
          <p className={`mt-3 text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {status.message}
          </p>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">No rooms added yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room) => {
            const homepageUrl = `${baseUrl.replace(/\/$/, '')}/${slug}/${room.room_code}`
            const qrUrl = buildQrImageUrl(homepageUrl, 260)
            const roomLabel = formatRoomLabel(room.room_code)

            return (
              <article key={room.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-base font-semibold text-slate-900">Room {roomLabel}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{homepageUrl}</p>
                <div className="mt-3 grid gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">Homepage QR</p>
                    <img src={qrUrl} alt={`Homepage QR for room ${roomLabel}`} className="mt-2 h-48 w-48 rounded-lg border border-slate-200 object-cover" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(homepageUrl)
                          setStatus({ type: 'success', message: `Copied homepage URL for room ${roomLabel}.` })
                        }}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Copy Link
                      </button>
                      <a
                        href={qrUrl}
                        download={`room-${room.room_code}-homepage-qr.png`}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Download QR
                      </a>
                    </div>
                  </div>

                  <form
                    action={async (fd) => {
                      setStatus(null)
                      if (businessId) fd.set('business_id', businessId)
                      fd.set('id', room.id)
                      const res = await deleteRoom(fd)
                      if (res.error) {
                        setStatus({ type: 'error', message: res.error })
                        return
                      }
                      setStatus({ type: 'success', message: `Deleted room ${roomLabel}.` })
                      router.refresh()
                    }}
                  >
                    <button className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700">
                      Delete Room
                    </button>
                  </form>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
