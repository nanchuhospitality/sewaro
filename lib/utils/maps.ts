export function buildGoogleMapsReviewUrl(name: string, address?: string | null) {
  const query = [name, address || ''].filter(Boolean).join(', ').trim()
  const encoded = encodeURIComponent(query)
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`
}
