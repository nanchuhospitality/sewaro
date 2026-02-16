import { RESERVED_SLUGS } from './constants'

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function validateBusinessSlug(slug: string): string | null {
  if (!slug) return 'Slug is required.'
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return 'Use 2-40 lowercase letters, numbers, and hyphens.'
  if (RESERVED_SLUGS.has(slug)) return 'This slug is reserved. Please choose another.'
  return null
}
