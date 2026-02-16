import { requireRole } from '@/lib/auth/requireRole'
import MenuManager from '@/components/dashboard/MenuManager'

export default async function DashboardMenuPage() {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')
  if (!profile.business_id) {
    return <p className="text-sm text-slate-600">No business linked to this account yet.</p>
  }

  const withParentCategories = await supabase
    .from('menu_categories')
    .select('id,name,description,parent_id,sort_order,is_active')
    .eq('business_id', profile.business_id)
    .order('sort_order', { ascending: true })
  const categorySchemaError = withParentCategories.error?.message?.toLowerCase() || ''
  let categories = withParentCategories.data
  if (!categories && (categorySchemaError.includes('parent_id') || categorySchemaError.includes('description'))) {
    const fallback = await supabase
      .from('menu_categories')
      .select('id,name,sort_order,is_active')
      .eq('business_id', profile.business_id)
      .order('sort_order', { ascending: true })
    categories = (fallback.data || []).map((category) => ({ ...category, description: null, parent_id: null }))
  }

  const withVegItems = await supabase
    .from('menu_items')
    .select('id,name,category_id,price_npr,description,image_url,is_available,is_veg,sort_order')
    .eq('business_id', profile.business_id)
    .order('sort_order', { ascending: true })
  const itemSchemaError = withVegItems.error?.message?.toLowerCase() || ''
  let menuItems = withVegItems.data
  if (!menuItems && itemSchemaError.includes('is_veg')) {
    const fallback = await supabase
      .from('menu_items')
      .select('id,name,category_id,price_npr,description,image_url,is_available,sort_order')
      .eq('business_id', profile.business_id)
      .order('sort_order', { ascending: true })
    menuItems = (fallback.data || []).map((item) => ({ ...item, is_veg: true }))
  }

  let variants: Array<{ id: string; menu_item_id: string; name: string; price_npr: number; is_active: boolean; is_veg: boolean | null; sort_order: number }> = []
  if ((menuItems || []).length > 0) {
    const withVariants = await supabase
      .from('menu_item_variants')
      .select('id,menu_item_id,name,price_npr,is_active,is_veg,sort_order')
      .in('menu_item_id', (menuItems || []).map((item) => item.id))
      .order('sort_order', { ascending: true })
    const variantSchemaError = withVariants.error?.message?.toLowerCase() || ''
    if (!withVariants.error) {
      variants = withVariants.data || []
    } else if (variantSchemaError.includes('is_veg') || variantSchemaError.includes('menu_item_variants')) {
      const fallback = await supabase
        .from('menu_item_variants')
        .select('id,menu_item_id,name,price_npr,is_active,sort_order')
        .in('menu_item_id', (menuItems || []).map((item) => item.id))
        .order('sort_order', { ascending: true })
      variants = (fallback.data || []).map((variant) => ({ ...variant, is_veg: null }))
    }
  }

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Menu builder</h1>
      <MenuManager categories={categories || []} items={menuItems || []} variants={variants} />
    </div>
  )
}
