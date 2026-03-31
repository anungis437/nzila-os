'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { Mic2, Music, Globe, Zap, CheckCircle2 } from 'lucide-react'
import { applyAsCreator } from '@/lib/actions/creator-actions'

const GENRE_GROUPS = [
  {
    region: 'Pan-African',
    genres: [
      { label: 'Afrobeats', value: 'AFROBEATS' },
      { label: 'Afro Pop', value: 'AFRO_POP' },
      { label: 'Afro Soul', value: 'AFRO_SOUL' },
      { label: 'Afro House', value: 'AFRO_HOUSE' },
      { label: 'Afro Fusion', value: 'AFRO_FUSION' },
      { label: 'Afro Hip Hop', value: 'AFRO_HIP_HOP' },
      { label: 'Afro R&B', value: 'AFRO_RNB' },
      { label: 'Afro Gospel', value: 'AFRO_GOSPEL' },
      { label: 'Afro Jazz', value: 'AFRO_JAZZ' },
    ],
  },
  {
    region: 'West Africa',
    genres: [
      { label: 'Highlife', value: 'HIGHLIFE' },
      { label: 'Jùjú', value: 'JUJU' },
      { label: 'Fuji', value: 'FUJI' },
      { label: 'Hiplife', value: 'HIPLIFE' },
      { label: 'Coupé-Décalé', value: 'COUPE_DECALE' },
    ],
  },
  {
    region: 'East Africa',
    genres: [
      { label: 'Bongo Flava', value: 'BONGO_FLAVA' },
      { label: 'Benga', value: 'BENGA' },
      { label: 'Gengetone', value: 'GENGETONE' },
      { label: 'Ethio-Jazz', value: 'ETHIO_JAZZ' },
    ],
  },
  {
    region: 'Southern Africa',
    genres: [
      { label: 'Amapiano', value: 'AMAPIANO' },
      { label: 'Gqom', value: 'GQOM' },
      { label: 'Kwaito', value: 'KWAITO' },
      { label: 'Kizomba', value: 'KIZOMBA' },
      { label: 'Maskandi', value: 'MASKANDI' },
    ],
  },
  {
    region: 'Central Africa',
    genres: [
      { label: 'Soukous', value: 'SOUKOUS' },
      { label: 'Ndombolo', value: 'NDOMBOLO' },
      { label: 'Congolese Rumba', value: 'CONGOLESE_RUMBA' },
      { label: 'Makossa', value: 'MAKOSSA' },
    ],
  },
  {
    region: 'North Africa',
    genres: [
      { label: 'Raï', value: 'RAI' },
      { label: 'Gnawa', value: 'GNAWA' },
    ],
  },
]

const COUNTRIES = [
  { label: 'Cameroon', value: 'CM' }, { label: 'DRC', value: 'CD' },
  { label: 'Egypt', value: 'EG' }, { label: 'Ethiopia', value: 'ET' },
  { label: 'Ghana', value: 'GH' }, { label: 'Ivory Coast', value: 'CI' },
  { label: 'Kenya', value: 'KE' }, { label: 'Morocco', value: 'MA' },
  { label: 'Nigeria', value: 'NG' }, { label: 'Rwanda', value: 'RW' },
  { label: 'Senegal', value: 'SN' }, { label: 'South Africa', value: 'ZA' },
  { label: 'Tanzania', value: 'TZ' }, { label: 'Uganda', value: 'UG' },
  { label: 'Other', value: 'OTHER' },
]

export default function ApplyAsCreatorPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-electric focus:border-transparent transition'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    const name = (fd.get('name') as string).trim()
    const email = (fd.get('email') as string).trim()
    if (!name || !email) {
      setError('Name and email are required.')
      return
    }

    startTransition(async () => {
      const res = await applyAsCreator({
        name,
        email,
        genre: (fd.get('genre') as string) || undefined,
        country: (fd.get('country') as string) || undefined,
        bio: (fd.get('bio') as string) || undefined,
      })

      if (!res.success) {
        setError(res.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSuccess(true)
    })
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Application Received!</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Your creator application is being reviewed. Once approved, you&apos;ll be able to
          create or join a label and start distributing your music.
        </p>
        <button
          type="button"
          onClick={() => router.push('../listener')}
          className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition"
        >
          Back to My Library
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10">
            <Mic2 size={24} className="text-electric" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Become a Creator</h1>
            <p className="text-muted-foreground text-sm">Share your music with the world on Zonga</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Music size={18} className="text-electric shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Distribute</p>
              <p className="text-xs text-muted-foreground">Upload and release music</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Globe size={18} className="text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Reach</p>
              <p className="text-xs text-muted-foreground">Pan-African audience</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Zap size={18} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Earn</p>
              <p className="text-xs text-muted-foreground">Royalties via mobile money</p>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Artist / Stage Name *
              </label>
              <input
                name="name"
                required
                className={inputClass}
                placeholder="Your stage name or artist name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email *
              </label>
              <input
                name="email"
                type="email"
                required
                className={inputClass}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Bio
              </label>
              <textarea
                name="bio"
                rows={3}
                className={inputClass}
                placeholder="Tell us about your music and artistry"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Primary Genre
                </label>
                <select name="genre" className={inputClass}>
                  <option value="">Select genre</option>
                  {GENRE_GROUPS.map((g) => (
                    <optgroup key={g.region} label={`── ${g.region} ──`}>
                      {g.genres.map((genre) => (
                        <option key={genre.value} value={genre.value}>
                          {genre.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Country
                </label>
                <select name="country" className={inputClass}>
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-electric/90 transition disabled:opacity-50"
            >
              {isPending ? 'Submitting…' : 'Apply as Creator'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            After applying, your profile will be reviewed. Once approved you can create or
            join a label organization to start uploading music and receiving royalties.
          </p>
        </form>
      </Card>
    </div>
  )
}
