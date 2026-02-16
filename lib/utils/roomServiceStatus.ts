type RoomServiceStatus = {
  isConfigured: boolean
  isOpen: boolean
}

function toMinutes(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  const parts = normalized.split(':')
  if (parts.length < 2) return null
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function getRoomServiceStatus(
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  now: Date = new Date()
): RoomServiceStatus {
  const open = toMinutes(openTime)
  const close = toMinutes(closeTime)
  if (open === null || close === null) {
    return { isConfigured: false, isOpen: false }
  }

  const current = now.getHours() * 60 + now.getMinutes()

  if (open === close) {
    return { isConfigured: true, isOpen: true }
  }

  if (open < close) {
    return { isConfigured: true, isOpen: current >= open && current < close }
  }

  return { isConfigured: true, isOpen: current >= open || current < close }
}
