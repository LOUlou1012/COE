import { getNotifications } from './actions'
import { NotificationsClient } from './components/notifications-client'
import EmailBlastButton from './components/email-blast-button'

export default async function NotificationsPage() {
  const { sent, received } = await getNotifications()

  return (
    <div className="space-y-6 p-6">
      {/* HEADER UI */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Manage system notifications
          </p>
        </div>

        {/* BUTTON EMAIL BLAST */}
        <EmailBlastButton />
      </div>

      {/* EXISTING UI */}
      <NotificationsClient sent={sent} received={received} />
    </div>
  )
}