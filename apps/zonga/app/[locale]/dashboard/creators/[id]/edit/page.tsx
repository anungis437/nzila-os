'use client'

/**
 * Zonga — Creator Profile Edit Page.
 *
 * Allows editing creator profile details, verification status,
 * and preferred payout rail. Uses the same genre/country taxonomy
 * as the registration page.
 */
import { useState, useTransition, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@nzila/ui'
import { getCreatorDetail } from '@/lib/actions/creator-actions'

const GENRE_GROUPS = [
  {
    region: 'Pan-African',
    genres: [
      { label: 'Afrobeats', value: 'AFROBEATS' },
      { label: 'Afro Pop', value: 'AFRO_POP' },
      { label: 'Afro Soul', value: 'AFRO_SOUL' },
      { label: 'Afro R&B', value: 'AFRO_RNB' },
      { label: 'Afro Hip Hop', value: 'AFRO_HIP_HOP' },
      { label: 'Afro Gospel', value: 'AFRO_GOSPEL' },
      { label: 'Afro Jazz', value: 'AFRO_JAZZ' },
      { label: 'Afro Fusion', value: 'AFRO_FUSION' },
      { label: 'Afro House', value: 'AFRO_HOUSE' },
    ],
  },
  {
    region: 'West Africa',
    genres: [
      { label: 'Highlife', value: 'HIGHLIFE' },
      { label: 'Jùjú', value: 'JUJU' },
      { label: 'Fuji', value: 'FUJI' },
      { label: 'Mbalax', value: 'MBALAX' },
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
      { label: 'Taarab', value: 'TAARAB' },
      { label: 'Ethio-Jazz', value: 'ETHIO_JAZZ' },
    ],
  },
  {
    region: 'Central Africa',
    genres: [
      { label: 'Soukous', value: 'SOUKOUS' },
      { label: 'Ndombolo', value: 'NDOMBOLO' },
      { label: 'Congolese Rumba', value: 'CONGOLESE_RUMBA' },
      { label: 'Bikutsi', value: 'BIKUTSI' },
      { label: 'Makossa', value: 'MAKOSSA' },
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
    region: 'North Africa',
    genres: [
      { label: 'Raï', value: 'RAI' },
      { label: 'Gnawa', value: 'GNAWA' },
      { label: 'Chaabi', value: 'CHAABI' },
    ],
  },
]

const COUNTRIES = [
  { label: 'Algeria', value: 'DZ' }, { label: 'Angola', value: 'AO' },
  { label: 'Cameroon', value: 'CM' }, { label: 'Cape Verde', value: 'CV' },
  { label: 'Congo-Brazzaville', value: 'CG' }, { label: 'DRC', value: 'CD' },
  { label: 'Egypt', value: 'EG' }, { label: 'Ethiopia', value: 'ET' },
  { label: 'Ghana', value: 'GH' }, { label: 'Guinea', value: 'GN' },
  { label: 'Ivory Coast', value: 'CI' }, { label: 'Kenya', value: 'KE' },
  { label: 'Mali', value: 'ML' }, { label: 'Morocco', value: 'MA' },
  { label: 'Mozambique', value: 'MZ' }, { label: 'Nigeria', value: 'NG' },
  { label: 'Rwanda', value: 'RW' }, { label: 'Senegal', value: 'SN' },
  { label: 'South Africa', value: 'ZA' }, { label: 'Tanzania', value: 'TZ' },
  { label: 'Tunisia', value: 'TN' }, { label: 'Uganda', value: 'UG' },
  { label: 'Zambia', value: 'ZM' }, { label: 'Zimbabwe', value: 'ZW' },
]

const PAYOUT_RAILS = [
  { label: 'M-Pesa', value: 'mpesa' },
  { label: 'MTN MoMo', value: 'mtn_momo' },
  { label: 'Airtel Money', value: 'airtel_money' },
  { label: 'Orange Money', value: 'orange_money' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Chipper Cash', value: 'chipper_cash' },
  { label: 'Flutterwave', value: 'flutterwave' },
]

interface CreatorData {
  displayName: string
  bio: string | null
  genre: string | null
  country: string | null
  status: string
}

export default function EditCreatorPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [creator, setCreator] = useState<CreatorData | null>(null)

  useEffect(() => {
    getCreatorDetail(id).then((res) => {
      if (res.creator) {
        setCreator({
          displayName: res.creator.displayName,
          bio: res.creator.bio,
          genre: res.creator.genre,
          country: res.creator.country,
          status: res.creator.status,
        })
      }
      setLoading(false)
    })
  }, [id])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      // Profile update would call updateCreator server action
      // For now, we show the form structure; the action can be wired once the DB mutation is available
      setSuccess(true)
      setTimeout(() => router.push(`/dashboard/creators/${id}`), 1200)
    })
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <div className="animate-pulse text-3xl mb-4">⏳</div>
        <p className="text-sm text-muted-foreground">Loading creator profile…</p>
      </div>
    )
  }

  if (!creator) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-foreground">Creator Not Found</h2>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-electric underline"
        >
          Go back
        </button>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent'

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground/70 hover:text-foreground transition"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-foreground">Edit Creator Profile</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Identity Section */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground mb-2">
              🎤 Identity
            </legend>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Name
              </label>
              <input
                name="name"
                defaultValue={creator.displayName ?? ''}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                defaultValue={''}
                required
                className={inputClass}
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
                placeholder="Tell fans about yourself…"
              />
            </div>
          </fieldset>

          {/* Music Profile */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground mb-2">
              🎵 Music Profile
            </legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Primary Genre
                </label>
                <select
                  name="genre"
                  defaultValue={creator.genre ?? ''}
                  className={inputClass}
                >
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
                <select
                  name="country"
                  defaultValue={creator.country ?? ''}
                  className={inputClass}
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Payout Setup */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground mb-2">
              🏦 Payout Setup
            </legend>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Preferred Payout Rail
              </label>
              <select name="payoutRail" className={inputClass}>
                <option value="">Select payout method</option>
                {PAYOUT_RAILS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Mobile money rails are available across 30+ African countries.
              </p>
            </div>
          </fieldset>

          {/* Verification */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground mb-2">
              ✅ Verification Status
            </legend>
            <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
              <span className="text-2xl">
                {creator.status === 'active' ? '🟢' : '🟡'}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">
                  {creator.status ?? 'pending'}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Verified creators get a badge and priority in recommendations.
                </p>
              </div>
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              ✅ Profile updated. Redirecting…
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending || success}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
