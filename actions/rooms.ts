'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/requireRole'
import { friendlyError } from '@/lib/utils/errors'
import { toRoomCode, validateRoomCode } from '@/lib/utils/rooms'

async function resolveRoomsContext(formData?: FormData) {
  const requestedBusinessId = String(formData?.get('business_id') || '').trim()
  if (requestedBusinessId) {
    const { supabase } = await requireRole('SUPERADMIN')
    return { supabase, businessId: requestedBusinessId }
  }

  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')
  if (!profile.business_id) return { error: 'No business linked.' as const }
  return { supabase, businessId: profile.business_id }
}

export async function createRoom(formData: FormData) {
  const context = await resolveRoomsContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const roomCode = toRoomCode(String(formData.get('room_code') || ''))
  const roomErr = validateRoomCode(roomCode)
  if (roomErr) return { error: roomErr }

  const { error } = await supabase.from('business_rooms').insert({
    business_id: businessId,
    room_code: roomCode,
    is_active: true,
  })

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/rooms')
  return { success: true }
}

export async function deleteRoom(formData: FormData) {
  const context = await resolveRoomsContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Room id is required.' }

  const { error } = await supabase
    .from('business_rooms')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/dashboard/rooms')
  revalidatePath('/superadmin')
  return { success: true }
}
