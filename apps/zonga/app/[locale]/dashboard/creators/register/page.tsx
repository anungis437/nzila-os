'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { registerCreator } from '@/lib/actions/creator-actions'

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
      { label: 'Afro Classical', value: 'AFRO_CLASSICAL' },
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
      { label: 'Azonto', value: 'AZONTO' },
      { label: 'Coupé-Décalé', value: 'COUPE_DECALE' },
      { label: 'Zouglou', value: 'ZOUGLOU' },
    ],
  },
  {
    region: 'East Africa',
    genres: [
      { label: 'Bongo Flava', value: 'BONGO_FLAVA' },
      { label: 'Benga', value: 'BENGA' },
      { label: 'Gengetone', value: 'GENGETONE' },
      { label: 'Taarab', value: 'TAARAB' },
      { label: 'Kidandali', value: 'KIDANDALI' },
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
      { label: 'Sebene', value: 'SEBENE' },
    ],
  },
  {
    region: 'Southern Africa',
    genres: [
      { label: 'Amapiano', value: 'AMAPIANO' },
      { label: 'Gqom', value: 'GQOM' },
      { label: 'Kwaito', value: 'KWAITO' },
      { label: 'Kizomba', value: 'KIZOMBA' },
      { label: 'Marrabenta', value: 'MARRABENTA' },
      { label: 'Maskandi', value: 'MASKANDI' },
      { label: 'Shangaan Electro', value: 'SHANGAAN_ELECTRO' },
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
  { label: 'Benin', value: 'BJ' }, { label: 'Botswana', value: 'BW' },
  { label: 'Burkina Faso', value: 'BF' }, { label: 'Burundi', value: 'BI' },
  { label: 'Cameroon', value: 'CM' }, { label: 'Cape Verde', value: 'CV' },
  { label: 'Central African Republic', value: 'CF' }, { label: 'Chad', value: 'TD' },
  { label: 'Comoros', value: 'KM' }, { label: 'Congo-Brazzaville', value: 'CG' },
  { label: 'Djibouti', value: 'DJ' }, { label: 'DRC', value: 'CD' },
  { label: 'Egypt', value: 'EG' }, { label: 'Equatorial Guinea', value: 'GQ' },
  { label: 'Eritrea', value: 'ER' }, { label: 'Eswatini', value: 'SZ' },
  { label: 'Ethiopia', value: 'ET' }, { label: 'Gabon', value: 'GA' },
  { label: 'Gambia', value: 'GM' }, { label: 'Ghana', value: 'GH' },
  { label: 'Guinea', value: 'GN' }, { label: 'Guinea-Bissau', value: 'GW' },
  { label: 'Ivory Coast', value: 'CI' }, { label: 'Kenya', value: 'KE' },
  { label: 'Lesotho', value: 'LS' }, { label: 'Liberia', value: 'LR' },
  { label: 'Libya', value: 'LY' }, { label: 'Madagascar', value: 'MG' },
  { label: 'Malawi', value: 'MW' }, { label: 'Mali', value: 'ML' },
  { label: 'Mauritania', value: 'MR' }, { label: 'Mauritius', value: 'MU' },
  { label: 'Morocco', value: 'MA' }, { label: 'Mozambique', value: 'MZ' },
  { label: 'Namibia', value: 'NA' }, { label: 'Niger', value: 'NE' },
  { label: 'Nigeria', value: 'NG' }, { label: 'Rwanda', value: 'RW' },
  { label: 'São Tomé & Príncipe', value: 'ST' }, { label: 'Senegal', value: 'SN' },
  { label: 'Seychelles', value: 'SC' }, { label: 'Sierra Leone', value: 'SL' },
  { label: 'Somalia', value: 'SO' }, { label: 'South Africa', value: 'ZA' },
  { label: 'South Sudan', value: 'SS' }, { label: 'Sudan', value: 'SD' },
  { label: 'Tanzania', value: 'TZ' }, { label: 'Togo', value: 'TG' },
  { label: 'Tunisia', value: 'TN' }, { label: 'Uganda', value: 'UG' },
  { label: 'Zambia', value: 'ZM' }, { label: 'Zimbabwe', value: 'ZW' },
]

const LANGUAGES = [
  'English', 'French', 'Swahili', 'Yoruba', 'Igbo', 'Hausa',
  'Amharic', 'Zulu', 'Lingala', 'Wolof', 'Twi', 'Shona',
  'Arabic', 'Portuguese', 'Afrikaans', 'Kinyarwanda', 'Somali', 'Pidgin',
]

const PAYOUT_RAILS = [
  { label: 'M-Pesa', value: 'mpesa', icon: '📱' },
  { label: 'MTN MoMo', value: 'mtn_momo', icon: '📱' },
  { label: 'Airtel Money', value: 'airtel_money', icon: '📱' },
  { label: 'Orange Money', value: 'orange_money', icon: '📱' },
  { label: 'Stripe', value: 'stripe', icon: '💳' },
  { label: 'Bank Transfer', value: 'bank_transfer', icon: '🏦' },
  { label: 'Chipper Cash', value: 'chipper_cash', icon: '📲' },
  { label: 'Flutterwave', value: 'flutterwave', icon: '🦋' },
]

const STEPS = [
  { label: 'Identity', description: 'Name, email & bio' },
  { label: 'Profile', description: 'Genre, country & payout' },
]

export default function RegisterCreatorPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    if (step === 0) {
      const name = (fd.get('name') as string).trim()
      const email = (fd.get('email') as string).trim()
      if (!name || !email) {
        setError('Name and email are required.')
        return
      }
      setStep(1)
      return
    }

    startTransition(async () => {
      const res = await registerCreator({
        name: fd.get('name') as string,
        email: fd.get('email') as string,
        genre: (fd.get('genre') as string) || undefined,
        country: (fd.get('country') as string) || undefined,
        bio: (fd.get('bio') as string) || undefined,
        language: (fd.get('language') as string) || undefined,
        payoutRail: (fd.get('payoutRail') as string) || undefined,
      })

      if (!res.success) {
        setError('Failed to register creator. Please try again.')
        return
      }
      router.push(`../${res.creatorId}`)
    })
  }

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">Register Creator</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Onboard a new artist or rights-holder onto the Zonga platform.
      </p>

      {/* Stepper */}
      <div className="flex gap-2 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={`flex-1 rounded-lg py-2 px-3 text-left transition ${
              i === step
                ? 'bg-electric/10 border-2 border-electric'
                : i < step
                  ? 'bg-emerald-50 border-2 border-emerald-400 cursor-pointer'
                  : 'bg-muted border-2 border-border'
            }`}
          >
            <span className="text-xs font-semibold text-muted-foreground">
              Step {i + 1}
            </span>
            <p className="text-sm font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground/70">{s.description}</p>
          </button>
        ))}
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Step 1 — Identity (always rendered but hidden) */}
          <div className={step !== 0 ? 'hidden' : undefined}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Artist / Creator Name *
                </label>
                <input
                  name="name"
                  required
                  className={inputClass}
                  placeholder="Stage name or legal name"
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
                  placeholder="creator@example.com"
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
                  placeholder="A short bio (shown on creator profile)"
                />
              </div>
            </div>
          </div>

          {/* Step 2 — Profile */}
          <div className={step !== 1 ? 'hidden' : undefined}>
            <div className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Primary Language
                  </label>
                  <select name="language" className={inputClass}>
                    <option value="">Select language</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l.toLowerCase()}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Preferred Payout Rail
                  </label>
                  <select name="payoutRail" className={inputClass}>
                    <option value="">Select payout method</option>
                    {PAYOUT_RAILS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
            >
              {step === 0
                ? 'Next →'
                : isPending
                  ? 'Registering…'
                  : 'Register Creator'}
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
