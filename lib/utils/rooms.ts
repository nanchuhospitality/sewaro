import { ROOM_REGEX } from '@/lib/utils/constants'

export function toRoomCode(raw: string) {
  return raw.toLowerCase().trim().replace(/\s+/g, '-')
}

export function validateRoomCode(roomCode: string) {
  if (!roomCode) return 'Room code is required.'
  if (!ROOM_REGEX.test(roomCode)) return 'Use 1-20 characters: letters, numbers, hyphen only.'
  return null
}

export function buildRoomMenuUrl(baseUrl: string, slug: string, roomCode: string) {
  const cleanBase = baseUrl.replace(/\/$/, '')
  return `${cleanBase}/${slug}/${roomCode}`
}

export function buildQrImageUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

export function formatRoomLabel(roomCode: string) {
  if (!roomCode) return roomCode
  return roomCode.charAt(0).toUpperCase() + roomCode.slice(1)
}
