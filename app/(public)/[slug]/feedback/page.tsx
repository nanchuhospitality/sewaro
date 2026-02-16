import Link from 'next/link'
import { notFound } from 'next/navigation'
import FeedbackForm from '@/components/public/FeedbackForm'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS } from '@/lib/utils/constants'

async function getBusiness(slug: string) {
  const supabase = createClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('id,name,slug,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return business
}

export default async function FeedbackPage({ params }: { params: { slug: string } }) {
  const slug = params.slug.toLowerCase()
  if (RESERVED_SLUGS.has(slug)) notFound()

  const business = await getBusiness(slug)
  if (!business) notFound()

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#ececec]">
      <header className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
        <Link href={`/${slug}`} className="text-xl leading-none">
          ←
        </Link>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <span className="w-5" />
      </header>
      <FeedbackForm slug={business.slug} room={null} />
    </main>
  )
}
