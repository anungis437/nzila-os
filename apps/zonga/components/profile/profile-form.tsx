'use client'

import { useState, useTransition } from 'react'
import { Card } from '@nzila/ui'
import { Save, Loader2 } from 'lucide-react'
import { AvatarSelector } from '@/components/profile/avatar-selector'
import { updateListenerProfile, type ListenerProfile } from '@/lib/actions/listener-actions'

interface ProfileFormProps {
  profile: ListenerProfile
  clerkName: string
  clerkEmail: string
}

export function ProfileForm({ profile, clerkName, clerkEmail }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [displayName, setDisplayName] = useState(profile.displayName || clerkName)
  const [email, setEmail] = useState(profile.email || clerkEmail)
  const [bio, setBio] = useState(profile.bio || '')
  const [city, setCity] = useState(profile.city || '')
  const [country, setCountry] = useState(profile.country || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await updateListenerProfile({
        displayName,
        email,
        bio: bio || undefined,
        city: city || undefined,
        country: country || undefined,
        avatarUrl: avatarUrl || undefined,
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Avatar</h2>
          <AvatarSelector currentAvatarUrl={avatarUrl || null} onSelect={setAvatarUrl} />
        </div>
      </Card>

      {/* Personal Info */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="displayName" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Kinshasa"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label htmlFor="country" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Country
              </label>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. DR Congo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Bio */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Bio</h2>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell other listeners and creators about yourself..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
          <p className="mt-1 text-xs text-muted-foreground text-right">{bio.length}/500</p>
        </div>
      </Card>

      {/* Account Info (read-only) */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Account Info</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Plan
              </label>
              <p className="mt-1 text-sm text-foreground capitalize">{profile.plan ?? 'Free'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Subscription Status
              </label>
              <p className="mt-1 text-sm text-foreground capitalize">{profile.subscriptionStatus ?? 'None'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Member Since
              </label>
              <p className="mt-1 text-sm text-foreground">
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Following / Favorites
              </label>
              <p className="mt-1 text-sm text-foreground">
                {profile.followingCount} artists · {profile.favoritesCount} favorites
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
