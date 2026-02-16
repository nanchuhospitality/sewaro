import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROOM_REGEX } from '@/lib/utils/constants'

export async function POST(req: Request) {
  const supabase = createClient()
  const body = (await req.json()) as {
    slug?: string
    room?: string | null
    rating?: number
    factors?: string[]
    comment?: string
  }

  const slug = String(body.slug || '').trim().toLowerCase()
  const rating = Number(body.rating)
  const factors = Array.isArray(body.factors)
    ? body.factors.map((f) => String(f).trim()).filter(Boolean).slice(0, 5)
    : []
  const comment = String(body.comment || '').trim().slice(0, 1000) || null
  const rawRoom = String(body.room || '').trim().toLowerCase()
  const room = rawRoom && ROOM_REGEX.test(rawRoom) ? rawRoom : null

  if (!slug) return NextResponse.json({ ok: false, error: 'Missing slug.' }, { status: 400 })
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: 'Please select a rating.' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!business) return NextResponse.json({ ok: false, error: 'Business not found.' }, { status: 404 })

  const { error } = await supabase.from('feedback_submissions').insert({
    business_id: business.id,
    room,
    rating,
    factors,
    comment,
  })

  if (error) return NextResponse.json({ ok: false, error: 'Could not submit feedback.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
