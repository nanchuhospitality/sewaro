import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MenuView from '@/components/public/MenuView'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS } from '@/lib/utils/constants'

async function getMartMenuData(slug: string) {
  const supabase = createClient()
  const withEnable = await supabase
    .from('businesses')
    .select('id,name,slug,logo_url,address,phone,is_active,enable_nova_mart_menu,enable_nova_mart_ordering,nova_mart_delivery_charge_npr,nova_mart_support_phone,nova_delivers_delivery_charge_npr')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  let business = withEnable.data
  const schemaError = withEnable.error?.message?.toLowerCase() || ''
  if (
    !business &&
    (
      schemaError.includes('enable_nova_mart_menu') ||
      schemaError.includes('enable_nova_mart_ordering') ||
      schemaError.includes('nova_mart_delivery_charge_npr') ||
      schemaError.includes('nova_mart_support_phone') ||
      schemaError.includes('nova_delivers_delivery_charge_npr')
    )
  ) {
    const fallback = await supabase
      .from('businesses')
      .select('id,name,slug,logo_url,address,phone,is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    business = fallback.data
      ? {
          ...fallback.data,
          enable_nova_mart_menu: false,
          enable_nova_mart_ordering: false,
          nova_mart_delivery_charge_npr: 0,
          nova_mart_support_phone: null,
          nova_delivers_delivery_charge_npr: 0,
        }
      : null
  }

  if (!business || !business.enable_nova_mart_menu) return null

  const menu = await supabase
    .from('nova_mart_menu')
    .select('categories,items,variants')
    .eq('id', 1)
    .maybeSingle()

  const menuSchemaError = menu.error?.message?.toLowerCase() || ''
  const menuData =
    menu.error && menuSchemaError.includes('nova_mart_menu')
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

  const data = await getMartMenuData(slug)
  if (!data) return { title: 'Not Found — Sewaro' }

  const title = `${data.business.name} Midnight Mart — Sewaro`
  return {
    title,
    description: `${data.business.name} midnight mart menu`,
    openGraph: {
      title,
      description: `${data.business.name} midnight mart menu`,
    },
  }
}

export default async function PublicMartMenuPage({ params }: { params: { slug: string } }) {
  const slug = params.slug.toLowerCase()
  if (RESERVED_SLUGS.has(slug)) notFound()

  const data = await getMartMenuData(slug)
  if (!data) notFound()

  return (
    <MenuView
      business={data.business}
      categories={data.categories}
      items={data.items}
      variants={data.variants}
      room={null}
      menuTitle="Midnight Mart"
      serviceMessage={
        data.business.enable_nova_mart_ordering
          ? 'Delivered to your room. Paid separately.'
          : 'Delivered to your room. Paid separately. Ordering starts soon.'
      }
      showServicePhone={false}
      showServiceHours={false}
      enableCart={Boolean(data.business.enable_nova_mart_ordering)}
      deliveryChargeNpr={Number(data.business.nova_mart_delivery_charge_npr || 0)}
      deliveryChargeBySource={{
        DELIVERS: Number(data.business.nova_delivers_delivery_charge_npr || 0),
        MART: Number(data.business.nova_mart_delivery_charge_npr || 0),
      }}
      whatsappPhone={data.business.nova_mart_support_phone || null}
      partnerLabel="Midnight Mart"
      cartSource="MART"
      sharedPartnerCart
      showVegFilter={false}
      showDietaryIcons={false}
      backHrefOverride={`/${slug}/partner-menu`}
    />
  )
}
