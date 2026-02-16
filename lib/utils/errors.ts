export function friendlyError(message: string) {
  const m = message.toLowerCase()

  if (m.includes('duplicate key value') || m.includes('unique constraint')) {
    return 'This value already exists. Please choose a different one.'
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return 'You do not have permission to perform this action.'
  }
  if (m.includes('invalid input syntax')) {
    return 'Some values are invalid. Please check the form and try again.'
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Network error. Please check your connection and try again.'
  }

  return message || 'Something went wrong. Please try again.'
}
