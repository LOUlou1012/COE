'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'


export async function deleteEvent(eventId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: old } = await supabase.from('events').select('*').eq('id', eventId).single()

  const { error } = await supabase.from('events').delete().eq('id', eventId)

  if (error) return { error: error.message }

  await supabase.from('audit_trail').insert({
    user_id: user.id,
    action: 'delete',
    module: 'events',
    target_id: eventId,
    old_value: old,
  })

  revalidatePath('/events')
  revalidatePath('/dashboard')
  return {}
}



export async function getEvents(month?: number, year?: number) {
  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const m = month ?? now.getMonth()
  const y = year ?? now.getFullYear()

  const startDate = new Date(y, m, 1).toISOString().split('T')[0]
  const endDate = new Date(y, m + 1, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      profiles(full_name),
      event_bod(bod_id, bod(name))
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  return { data: data ?? [], error }
}

export async function getBods() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('bod').select('*').eq('is_active', true)
  return data ?? []
}

export async function checkConflict(date: string, excludeEventId?: string) {
  const supabase = await createSupabaseServerClient()

  let query = supabase.from('events').select('id, title, start_time, end_time').eq('date', date)

  if (excludeEventId) {
    query = query.neq('id', excludeEventId)
  }

  const { data } = await query
  return data ?? []
}

export async function createEvent(formData: {
  title: string
  date: string
  start_time: string
  end_time: string
  location: string
  notes: string
  bod_ids: string[]
  force?: boolean
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      title: formData.title,
      date: formData.date,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      location: formData.location,
      notes: formData.notes,
      status: 'need_review',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Insert event_bod
  if (formData.bod_ids.length > 0) {
    await supabase.from('event_bod').insert(
      formData.bod_ids.map((bod_id) => ({ event_id: event.id, bod_id }))
    )
  }

  // Kalau ada conflict, simpan ke event_conflicts & kirim notifikasi ke CMS
  if (formData.force) {
    const conflicts = await checkConflict(formData.date, event.id)
    if (conflicts.length > 0) {
      await supabase.from('event_conflicts').insert(
        conflicts.map((c) => ({
          event_id: event.id,
          conflicting_event_id: c.id,
        }))
      )

      // Kirim notif ke semua CMS
      const { data: cmsUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'cms')

      if (cmsUsers && cmsUsers.length > 0) {
        await supabase.from('notifications').insert(
          cmsUsers.map((cms) => ({
            event_id: event.id,
            sender_id: user.id,
            receiver_id: cms.id,
            message: `Event "${formData.title}" pada ${formData.date} terdeteksi bentrok jadwal.`,
          }))
        )
      }
    }
  }

  // Audit trail
  await supabase.from('audit_trail').insert({
    user_id: user.id,
    action: 'create',
    module: 'events',
    target_id: event.id,
    new_value: event,
  })

  revalidatePath('/events')
  revalidatePath('/dashboard')
  return { data: event }
}

export async function updateEvent(
  eventId: string,
  formData: {
    title: string
    date: string
    start_time: string
    end_time: string
    location: string
    notes: string
    bod_ids: string[]
  }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: old } = await supabase.from('events').select('*').eq('id', eventId).single()

  const { data: event, error } = await supabase
    .from('events')
    .update({
      title: formData.title,
      date: formData.date,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      location: formData.location,
      notes: formData.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single()

  if (error) return { error: error.message }

  // Update event_bod
  await supabase.from('event_bod').delete().eq('event_id', eventId)
  if (formData.bod_ids.length > 0) {
    await supabase.from('event_bod').insert(
      formData.bod_ids.map((bod_id) => ({ event_id: eventId, bod_id }))
    )
  }

  // Event log
  await supabase.from('event_logs').insert({
    event_id: eventId,
    changed_by: user.id,
    field_changed: 'multiple',
    old_value: JSON.stringify(old),
    new_value: JSON.stringify(event),
  })

  // Audit trail
  await supabase.from('audit_trail').insert({
    user_id: user.id,
    action: 'update',
    module: 'events',
    target_id: eventId,
    old_value: old,
    new_value: event,
  })

  revalidatePath('/events')
  revalidatePath('/dashboard')
  return { data: event }
}