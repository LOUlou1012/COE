import { getCalendarData } from './actions'
import { CalendarClient } from './components/calendar-client'

export default async function CalendarPage() {
  const { events, publicHolidays } = await getCalendarData()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-muted-foreground mt-1">Tampilan kalender semua event</p>
      </div>
      <CalendarClient events={events} publicHolidays={publicHolidays} />
    </div>
  )
}