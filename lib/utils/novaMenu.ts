export type NovaMenuOption = {
  key: string
  itemName: string
  variantName: string
  unitPriceNpr: number
  label: string
}

export function buildNovaMenuOptions(payload: { items?: any[]; variants?: any[] } | null | undefined): NovaMenuOption[] {
  const items = Array.isArray(payload?.items) ? payload!.items : []
  const variants = Array.isArray(payload?.variants) ? payload!.variants : []

  const variantsByItem = new Map<string, any[]>()
  for (const variant of variants) {
    if (!variant || variant.is_active === false) continue
    const itemId = String(variant.menu_item_id || '').trim()
    if (!itemId) continue
    if (!variantsByItem.has(itemId)) variantsByItem.set(itemId, [])
    variantsByItem.get(itemId)!.push(variant)
  }

  const options: NovaMenuOption[] = []

  for (const item of items) {
    if (!item || item.is_available === false) continue
    const itemId = String(item.id || '').trim()
    const itemName = String(item.name || '').trim()
    const itemPrice = Number(item.price_npr || 0)
    if (!itemName || !Number.isInteger(itemPrice) || itemPrice < 0) continue

    const itemVariants = itemId ? variantsByItem.get(itemId) || [] : []
    if (itemVariants.length > 0) {
      for (const variant of itemVariants) {
        const variantName = String(variant.name || '').trim()
        const variantPrice = Number(variant.price_npr || 0)
        if (!variantName || !Number.isInteger(variantPrice) || variantPrice < 0) continue
        options.push({
          key: `${itemId}:${String(variant.id || variantName)}`,
          itemName,
          variantName,
          unitPriceNpr: variantPrice,
          label: `${itemName} (${variantName}) - ${variantPrice}`,
        })
      }
      continue
    }

    options.push({
      key: itemId || itemName,
      itemName,
      variantName: '',
      unitPriceNpr: itemPrice,
      label: `${itemName} - ${itemPrice}`,
    })
  }

  return options
}
