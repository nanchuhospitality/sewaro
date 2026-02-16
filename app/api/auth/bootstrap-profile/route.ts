import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 })

  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    await supabase.from('profiles').insert({
      user_id: user.id,
      role: 'BUSINESS_ADMIN',
      business_id: null,
    })
  }

  return NextResponse.json({ ok: true })
}
