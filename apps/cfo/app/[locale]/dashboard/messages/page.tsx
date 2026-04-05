/**
 * CFO — Messages Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Mail, MailOpen } from 'lucide-react'
import { listMessages } from '@/lib/actions/misc-actions'
import { MessagesWithCompose } from '@/components/messages-with-compose'

export default async function MessagesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('messages:view')

  const messages = await listMessages()

  return (
    <div className="space-y-6">
      <MessagesWithCompose messages={messages} />

      {messages.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Mail className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">No messages</p>
          <p className="mt-1 text-sm text-muted-foreground">Your inbox is empty.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm ${!msg.read ? 'border-l-2 border-l-electric' : ''}`}
            >
              {msg.read ? (
                <MailOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />
              ) : (
                <Mail className="mt-0.5 h-4 w-4 text-electric" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-foreground">{msg.subject}</p>
                  <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('en-CA') : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{msg.from}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.preview}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
