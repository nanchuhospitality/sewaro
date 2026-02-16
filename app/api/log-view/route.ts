import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROOM_REGEX } from '@/lib/utils/constants'

export async function POST(req: Request) {
  const supabase = createClient()
  const body = (await req.json()) as { slug?: string; room?: string | null }
  const slug = String(body.slug || '').toLowerCase().trim()

  if (!slug) return NextResponse.json({ ok: false }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id,slug,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!business) return NextResponse.json({ ok: false }, { status: 404 })

  const rawRoom = (body.room || '').toString().trim().toLowerCase()
  const room = rawRoom && ROOM_REGEX.test(rawRoom) ? rawRoom : null
  const userAgent = req.headers.get('user-agent')

  await supabase.from('menu_page_views').insert({
    business_id: business.id,
    slug: business.slug,
    room,
    user_agent: userAgent,
  })

  return NextResponse.json({ ok: true })
}
