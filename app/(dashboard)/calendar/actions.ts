'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import Holidays from 'date-holidays'

export async function getCalendarData() {
  const supabase = await createSupabaseServerClient()

  const hd = new Holidays('ID')
  const currentYear = new Date().getFullYear()

  const publicHolidays = [
    ...hd.getHolidays(currentYear),
    ...hd.getHolidays(currentYear + 1),
  ].filter(h => h.type === 'public')

  const { data: events } = await supabase
    .from('events')
    .select(`*, event_bod(bod(name))`)
    .is('deleted_at', null)
    .order('date', { ascending: true })

  return {
    events: events ?? [],
    publicHolidays: publicHolidays.map(h => ({
      id: h.date,
      name: h.name,
      date: h.date.split(' ')[0],
    })),
  }
}