import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MenuView from '@/components/public/MenuView'
import { createClient } from '@/lib/supabase/server'
import { RESERVED_SLUGS, ROOM_REGEX } from '@/lib/utils/constants'
import { formatRoomLabel } from '@/lib/utils/rooms'

async function getMenuData(slug: string) {
  const supabase = createClient()
  const withMapLink = await supabase
    .from('businesses')
    .select('id,name,slug,logo_url,address,phone,room_service_phone,room_service_open_time,room_service_close_time,hours_text,google_map_link,show_review,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  let business = withMapLink.data
  const schemaError = withMapLink.error?.message?.toLowerCase() || ''
  if (
    !business &&
    (
      schemaError.includes('google_map_link') ||
      schemaError.includes('show_review') ||
      schemaError.includes('room_service_phone') ||
      schemaError.includes('room_service_open_time') ||
      schemaError.includes('room_service_close_time')
    )
  ) {
    const fallback = await supabase
      .from('businesses')
      .select('id,name,slug,logo_url,address,phone,hours_text,is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    if (fallback.data) {
      business = {
        ...fallback.data,
        room_service_phone: null,
        room_service_open_time: null,
        room_service_close_time: null,
        google_map_link: null,
        show_review: true,
      }
    }
  }

  if (!business) return null

  const withParentCategories = await supabase
    .from('menu_categories')
    .select('id,name,description,parent_id,sort_order')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const categorySchemaError = withParentCategories.error?.message?.toLowerCase() || ''
  let categories = withParentCategories.data
  if (!categories && (categorySchemaError.includes('parent_id') || categorySchemaError.includes('description'))) {
    const fallback = await supabase
      .from('menu_categories')
      .select('id,name,sort_order')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    categories = (fallback.data || []).map((category) => ({ ...category, description: null, parent_id: null }))
  }

  const withVegItems = await supabase
    .from('menu_items')
    .select('id,category_id,name,price_npr,description,image_url,is_available,is_veg,sort_order')
    .eq('business_id', business.id)
    .order('sort_order', { ascending: true })
  const itemSchemaError = withVegItems.error?.message?.toLowerCase() || ''
  let items = withVegItems.data
  if (!items && itemSchemaError.includes('is_veg')) {
    const fallback = await supabase
      .from('menu_items')
      .select('id,category_id,name,price_npr,description,image_url,is_available,sort_order')
      .eq('business_id', business.id)
      .order('sort_order', { ascending: true })
    items = (fallback.data || []).map((item) => ({ ...item, is_veg: true }))
  }

  let variants: Array<{ id: string; menu_item_id: string; name: string; price_npr: number; is_active: boolean; is_veg: boolean | null; sort_order: number }> = []
  if ((items || []).length > 0) {
    const withVariants = await supabase
      .from('menu_item_variants')
      .select('id,menu_item_id,name,price_npr,is_active,is_veg,sort_order')
      .in('menu_item_id', (items || []).map((item) => item.id))
      .order('sort_order', { ascending: true })
    const variantSchemaError = withVariants.error?.message?.toLowerCase() || ''
    if (!withVariants.error) {
      variants = withVariants.data || []
    } else if (variantSchemaError.includes('is_veg') || variantSchemaError.includes('menu_item_variants')) {
      const fallback = await supabase
        .from('menu_item_variants')
        .select('id,menu_item_id,name,price_npr,is_active,sort_order')
        .in('menu_item_id', (items || []).map((item) => item.id))
        .order('sort_order', { ascending: true })
      variants = (fallback.data || []).map((variant) => ({ ...variant, is_veg: null }))
    }
  }

  return {
    business,
    categories: categories || [],
    items: items || [],
    variants,
  }
}

export async function generateMetadata({ params }: { params: { slug: string; room: string } }): Promise<Metadata> {
  const slug = params.slug.toLowerCase()
  const room = params.room.toLowerCase()
  if (RESERVED_SLUGS.has(slug) || !ROOM_REGEX.test(room)) return { title: 'Not Found — Sewaro' }
  const data = await getMenuData(slug)
  if (!data) return { title: 'Not Found — Sewaro' }
  const title = `${data.business.name} Menu Room ${formatRoomLabel(room)} — Sewaro`
  return {
    title,
    description: `${data.business.name} digital menu`,
    openGraph: { title, description: `${data.business.name} digital menu` },
  }
}

export default async function RoomMenuPage({ params }: { params: { slug: string; room: string } }) {
  const slug = params.slug.toLowerCase()
  const room = params.room.toLowerCase()
  if (RESERVED_SLUGS.has(slug) || !ROOM_REGEX.test(room)) notFound()

  const data = await getMenuData(slug)
  if (!data) notFound()

  return <MenuView business={data.business} categories={data.categories} items={data.items} variants={data.variants} room={room} />
}
