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
  const email = required('SEED_SUPERADMIN_EMAIL').toLowerCase()
  const password = required('SEED_SUPERADMIN_PASSWORD')

  const admin = createClient(url, key, { auth: { persistSession: false } })

  const user = await ensureUser(admin, email, password)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: user.id, role: 'SUPERADMIN', business_id: null })

  if (profileError) throw profileError

  console.log('Superadmin ready:')
  console.log(`  Email: ${email}`)
  console.log('  Role: SUPERADMIN')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
