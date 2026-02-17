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

function parseRoomCell(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }
  return trimmed
}

function parseRoomsCsv(csvText: string) {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []

  const firstCell = parseRoomCell(lines[0].split(',')[0] || '').toLowerCase()
  const hasHeader = ['room', 'room_code', 'room-code', 'code'].includes(firstCell)
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line, index) => {
    const rawCell = line.split(',')[0] || ''
    return {
      rowNo: hasHeader ? index + 2 : index + 1,
      raw: parseRoomCell(rawCell),
    }
  })
}

export async function createRoomsFromCsv(formData: FormData) {
  const context = await resolveRoomsContext(formData)
  if ('error' in context) return { error: context.error }
  const { businessId, supabase } = context

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Please select a CSV file.' }
  if (!file.name.toLowerCase().endsWith('.csv')) return { error: 'Only .csv files are supported.' }

  const csvText = await file.text()
  const rows = parseRoomsCsv(csvText)
  if (rows.length === 0) return { error: 'CSV is empty.' }

  const { data: existingRooms, error: existingError } = await supabase
    .from('business_rooms')
    .select('room_code')
    .eq('business_id', businessId)
  if (existingError) return { error: friendlyError(existingError.message) }

  const existingCodes = new Set((existingRooms || []).map((room) => String(room.room_code || '').toLowerCase()))
  const seenInCsv = new Set<string>()
  const toInsert: Array<{ business_id: string; room_code: string; is_active: boolean }> = []

  let skippedExisting = 0
  let skippedDuplicateInCsv = 0
  let skippedInvalid = 0
  const errorRows: string[] = []

  for (const row of rows) {
    const roomCode = toRoomCode(row.raw)
    const roomErr = validateRoomCode(roomCode)
    if (roomErr) {
      skippedInvalid += 1
      errorRows.push(`Row ${row.rowNo}: ${roomErr}`)
      continue
    }
    if (existingCodes.has(roomCode)) {
      skippedExisting += 1
      continue
    }
    if (seenInCsv.has(roomCode)) {
      skippedDuplicateInCsv += 1
      continue
    }

    seenInCsv.add(roomCode)
    toInsert.push({
      business_id: businessId,
      room_code: roomCode,
      is_active: true,
    })
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('business_rooms').insert(toInsert)
    if (error) return { error: friendlyError(error.message) }
  }

  revalidatePath('/dashboard/rooms')
  revalidatePath('/superadmin')

  return {
    success: true,
    summary: {
      totalRows: rows.length,
      created: toInsert.length,
      skippedExisting,
      skippedDuplicateInCsv,
      skippedInvalid,
      errorRows: errorRows.slice(0, 5),
    },
  }
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
