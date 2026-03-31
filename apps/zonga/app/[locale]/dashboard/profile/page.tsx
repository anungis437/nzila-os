/**
 * Zonga — Profile Page (Server Component).
 *
 * Displays the listener's profile with editable fields and avatar selection.
 * Distinct from the Settings page which handles preferences, appearance, and API keys.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getListenerProfile, ensureListenerProfile } from '@/lib/actions/listener-actions'
import { ProfileForm } from '@/components/profile/profile-form'

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const clerkName = user?.fullName ?? user?.firstName ?? 'User'
  const clerkEmail = user?.emailAddresses?.[0]?.emailAddress ?? ''

  // Ensure the listener row exists
  await ensureListenerProfile({ displayName: clerkName, email: clerkEmail })

  // Fetch the full profile
  const profile = await getListenerProfile()

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Unable to load your profile. Please try again later.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal information, bio, and avatar.
        </p>
      </div>

      <ProfileForm profile={profile} clerkName={clerkName} clerkEmail={clerkEmail} />
    </div>
  )
}
