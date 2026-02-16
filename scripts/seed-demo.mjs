import { createClient } from '@supabase/supabase-js'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

async function findUserByEmail(admin, email) {
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (found) return found

    if (data.users.length < perPage) return null
    page += 1
  }
}

async function ensureUser(admin, email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (!error && data.user) return data.user

  if (error && /already|exists|registered/i.test(error.message)) {
    const existing = await findUserByEmail(admin, email)
    if (!existing) throw new Error(`User already exists but could not be fetched: ${email}`)
    return existing
  }

  throw error || new Error('Failed to create/fetch user')
}

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const key = required('SUPABASE_SERVICE_ROLE_KEY')

  const businessName = (process.env.SEED_DEMO_BUSINESS_NAME || 'Demo Hotel').trim()
  const businessSlug = (process.env.SEED_DEMO_BUSINESS_SLUG || 'demo-hotel').trim().toLowerCase()
  const adminEmail = required('SEED_DEMO_ADMIN_EMAIL').toLowerCase()
  const adminPassword = required('SEED_DEMO_ADMIN_PASSWORD')

  const admin = createClient(url, key, { auth: { persistSession: false } })

  let businessId
  {
    const { data: existing, error } = await admin
      .from('businesses')
      .select('id')
      .eq('slug', businessSlug)
      .maybeSingle()

    if (error) throw error

    if (existing) {
      businessId = existing.id
    } else {
      const { data: created, error: createError } = await admin
        .from('businesses')
        .insert({ name: businessName, slug: businessSlug, is_active: true })
        .select('id')
        .single()
      if (createError || !created) throw createError || new Error('Failed to create demo business')
      businessId = created.id
    }
  }

  const user = await ensureUser(admin, adminEmail, adminPassword)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: user.id, role: 'BUSINESS_ADMIN', business_id: businessId })

  if (profileError) throw profileError

  console.log('Demo business + admin ready:')
  console.log(`  Business: ${businessName}`)
  console.log(`  Slug: ${businessSlug}`)
  console.log(`  Admin email: ${adminEmail}`)
  console.log(`  Login URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
