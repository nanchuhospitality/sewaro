import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MenuView from '@/components/public/MenuView'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS } from '@/lib/utils/constants'

async function getPartnerMenuData(slug: string) {
  const supabase = createClient()
  const withEnable = await supabase
    .from('businesses')
    .select('id,name,slug,logo_url,address,phone,is_active,enable_nova_delivers_menu,enable_nova_delivers_ordering,nova_delivers_delivery_charge_npr,nova_delivers_support_phone')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  let business = withEnable.data
  const schemaError = withEnable.error?.message?.toLowerCase() || ''
  if (
    !business &&
    (
      schemaError.includes('enable_nova_delivers_menu') ||
      schemaError.includes('enable_nova_delivers_ordering') ||
      schemaError.includes('nova_delivers_delivery_charge_npr') ||
      schemaError.includes('nova_delivers_support_phone')
    )
  ) {
    const fallback = await supabase
      .from('businesses')
      .select('id,name,slug,logo_url,address,phone,is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    business = fallback.data
      ? { ...fallback.data, enable_nova_delivers_menu: false, enable_nova_delivers_ordering: false, nova_delivers_delivery_charge_npr: 0, nova_delivers_support_phone: null }
      : null
  }

  if (!business || !business.enable_nova_delivers_menu) return null

  const menu = await supabase
    .from('nova_delivers_menu')
    .select('categories,items,variants')
    .eq('id', 1)
    .maybeSingle()

  const menuSchemaError = menu.error?.message?.toLowerCase() || ''
  const menuData =
    menu.error && menuSchemaError.includes('nova_delivers_menu')
      ? { categories: [], items: [], variants: [] }
      : (menu.data ?? { categories: [], items: [], variants: [] })

  return {
    business: {
      ...business,
      room_service_phone: null,
      room_service_open_time: null,
      room_service_close_time: null,
      hours_text: null,
      google_map_link: null,
      show_review: true,
    },
    categories: Array.isArray(menuData.categories) ? menuData.categories : [],
    items: Array.isArray(menuData.items) ? menuData.items : [],
    variants: Array.isArray(menuData.variants) ? menuData.variants : [],
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug.toLowerCase()
  if (RESERVED_SLUGS.has(slug)) return { title: 'Not Found — Sewaro' }

  const data = await getPartnerMenuData(slug)
  if (!data) return { title: 'Not Found — Sewaro' }

  const title = `${data.business.name} Late-Night Delivery Menu — Sewaro`
  return {
    title,
    description: `${data.business.name} partner delivery menu`,
    openGraph: {
      title,
      description: `${data.business.name} partner delivery menu`,
    },
  }
}

export default async function PublicPartnerMenuPage({ params }: { params: { slug: string } }) {
  const slug = params.slug.toLowerCase()
  if (RESERVED_SLUGS.has(slug)) notFound()

  const data = await getPartnerMenuData(slug)
  if (!data) notFound()

  return (
    <MenuView
      business={data.business}
      categories={data.categories}
      items={data.items}
      variants={data.variants}
      room={null}
      menuTitle="Late-Night Delivery Menu"
      serviceMessage={
        data.business.enable_nova_delivers_ordering
          ? 'Delivered to your room. Paid separately.'
          : 'Delivered to your room. Paid separately. Ordering starts soon.'
      }
      showServicePhone={false}
      showServiceHours={false}
      enableCart={Boolean(data.business.enable_nova_delivers_ordering)}
      deliveryChargeNpr={data.business.nova_delivers_delivery_charge_npr || 0}
      whatsappPhone={data.business.nova_delivers_support_phone || null}
    />
  )
}
