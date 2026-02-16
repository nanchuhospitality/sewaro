export function toTelHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '')
  return `tel:${normalized}`
}
