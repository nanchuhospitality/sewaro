'use client'

import { useState } from 'react'

const ratings = [
  { value: 1, label: 'Very Bad', emoji: '😡' },
  { value: 2, label: 'Bad', emoji: '😕' },
  { value: 3, label: 'Average', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Loved it!', emoji: '😄' },
]

const factors = [
  'Room Cleanliness',
  'Comfort & Sleep Quality',
  'Staff Hospitality',
  'Amenities & Facilities',
  'Food & Dining Experience',
]

export default function FeedbackForm({ slug, room = null }: { slug: string; room?: string | null }) {
  const [rating, setRating] = useState<number | null>(null)
  const [selectedFactors, setSelectedFactors] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  const toggleFactor = (factor: string) => {
    setSelectedFactors((current) =>
      current.includes(factor) ? current.filter((f) => f !== factor) : [...current, factor]
    )
  }

  const onSubmit = async () => {
    if (!rating) {
      setStatus({ type: 'error', message: 'Please select your rating.' })
      return
    }

    setPending(true)
    setStatus(null)

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        room,
        rating,
        factors: selectedFactors,
        comment,
      }),
    })

    const data = (await res.json()) as { ok?: boolean; error?: string }
    setPending(false)

    if (!res.ok || !data.ok) {
      setStatus({ type: 'error', message: data.error || 'Could not submit feedback.' })
      return
    }

    setStatus({ type: 'success', message: 'Thank you for your feedback!' })
    setRating(null)
    setSelectedFactors([])
    setComment('')
  }

  return (
    <div className="mx-auto max-w-md rounded-b-3xl bg-gradient-to-b from-[#efefef] to-[#e6e6e6] p-4">
      <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">Please take a moment to let us know how we did.</p>
        <p className="text-sm font-medium text-slate-700">It would mean a lot to us!</p>
      </section>

      <h2 className="mt-8 text-center text-2xl font-semibold tracking-tight text-slate-900">How was your stay?</h2>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {ratings.map((item) => {
          const active = rating === item.value
          return (
            <button key={item.value} type="button" onClick={() => setRating(item.value)} className="text-center transition hover:-translate-y-0.5">
              <span
                className={`inline-flex h-14 w-14 items-center justify-center rounded-full border-2 text-3xl shadow-sm ${
                  active ? 'border-slate-900 ring-2 ring-slate-300' : 'border-slate-400'
                }`}
              >
                {item.emoji}
              </span>
              <span className="mt-2 block text-xs font-medium text-slate-600">{item.label}</span>
            </button>
          )
        })}
      </div>

      <h3 className="mt-10 text-center text-2xl font-semibold tracking-tight text-slate-900">What impacted your rating?</h3>
      <div className="mt-5 space-y-3">
        {factors.map((factor) => {
          const active = selectedFactors.includes(factor)
          return (
            <button
              key={factor}
              type="button"
              onClick={() => toggleFactor(factor)}
              className={`w-full rounded-2xl border px-4 py-4 text-base font-semibold uppercase tracking-wide transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-400 bg-white text-slate-900 hover:border-slate-700'
              }`}
            >
              {factor}
            </button>
          )
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
        <label className="text-base font-medium text-slate-800">Would you like to add anything?</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Tell us about your experience. (Optional)"
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-700"
        />
      </div>

      {status && (
        <p className={`mt-3 text-center text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {status.message}
        </p>
      )}

      <div className="pb-3 pt-5 text-center">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="rounded-full bg-black px-8 py-3 text-base font-semibold tracking-widest text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'SUBMITTING' : 'SUBMIT'}
        </button>
      </div>
    </div>
  )
}
