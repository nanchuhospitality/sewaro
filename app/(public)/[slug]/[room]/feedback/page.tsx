import Link from 'next/link'
import { notFound } from 'next/navigation'
import FeedbackForm from '@/components/public/FeedbackForm'
import ContinueSupportBanner from '@/components/public/ContinueSupportBanner'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS, ROOM_REGEX } from '@/lib/utils/constants'

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

export default async function RoomFeedbackPage({ params }: { params: { slug: string; room: string } }) {
  const slug = params.slug.toLowerCase()
  const room = params.room.toLowerCase()
  if (RESERVED_SLUGS.has(slug) || !ROOM_REGEX.test(room)) notFound()

  const business = await getBusiness(slug)
  if (!business) notFound()

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#ececec]">
      <header className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
        <Link href={`/${slug}/${room}`} className="text-xl leading-none">
          ←
        </Link>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <span className="w-5" />
      </header>
      <div className="px-3 pt-3">
        <ContinueSupportBanner businessId={business.id} room={room} className="mb-0" />
      </div>
      <FeedbackForm slug={business.slug} room={room} />
    </main>
  )
}
