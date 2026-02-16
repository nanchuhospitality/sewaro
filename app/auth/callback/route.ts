import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('user_id,role').eq('user_id', user.id).maybeSingle()
    if (!profile) {
      await supabase.from('profiles').insert({ user_id: user.id, role: 'BUSINESS_ADMIN', business_id: null })
      return NextResponse.redirect(`${origin}/dashboard`)
    }
    if (profile.role === 'SUPERADMIN') return NextResponse.redirect(`${origin}/superadmin`)
    if (profile.role === 'CENTRAL_OPS') return NextResponse.redirect(`${origin}/ops/orders`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
