/**
 * Zonga — Settings Page (Server Component).
 *
 * Profile, preferences, appearance, API keys, and notifications.
 */
import { auth, currentUser } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { getListenerProfile, ensureListenerProfile } from '@/lib/actions/listener-actions'
import { ProfileForm } from '@/components/profile/profile-form'

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const clerkName = user?.fullName ?? user?.firstName ?? 'User'
  const clerkEmail = user?.emailAddresses?.[0]?.emailAddress ?? ''

  await ensureListenerProfile({ displayName: clerkName, email: clerkEmail })
  const profile = await getListenerProfile()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, notification preferences, appearance, and API access.
        </p>
      </div>

      {/* Profile */}
      {profile ? (
        <ProfileForm profile={profile} clerkName={clerkName} clerkEmail={clerkEmail} />
      ) : (
        <Card>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Unable to load your profile.</p>
          </div>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Notification Preferences</h2>
          <div className="space-y-3">
            {[
              { key: 'payouts', label: 'Payout notifications', desc: 'Get notified when payouts are processed' },
              { key: 'releases', label: 'Release updates', desc: 'Notifications when releases go live or are reviewed' },
              { key: 'moderation', label: 'Moderation alerts', desc: 'Content flagged for review or action needed' },
              { key: 'social', label: 'Social activity', desc: 'Follows, tips, and comments on your content' },
              { key: 'system', label: 'System announcements', desc: 'Platform maintenance and feature updates' },
            ].map((pref) => (
              <div key={pref.key} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.desc}</p>
                </div>
                <div className="h-5 w-9 rounded-full bg-emerald-500 relative cursor-pointer">
                  <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Appearance</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'system', label: 'System', icon: '💻' },
              { key: 'light', label: 'Light', icon: '☀️' },
              { key: 'dark', label: 'Dark', icon: '🌙' },
            ].map((theme) => (
              <button
                key={theme.key}
                className="rounded-lg border border-border p-4 text-center hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors"
              >
                <p className="text-2xl">{theme.icon}</p>
                <p className="mt-1 text-xs font-medium text-foreground">{theme.label}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* API Access */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">API Access</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Generate API keys for programmatic access to your catalog, analytics, and payout data.
          </p>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Generate API Key
          </button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card>
        <div className="p-6 border-t-2 border-red-200">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            These actions are irreversible. Please proceed with caution.
          </p>
          <div className="flex gap-3">
            <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Export All Data
            </button>
            <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Delete Account
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
