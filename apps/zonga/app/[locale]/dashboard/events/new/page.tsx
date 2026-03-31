'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { createEvent } from '@/lib/actions/event-actions'

const COUNTRIES = [
  { label: 'Nigeria', value: 'NG' },
  { label: 'Kenya', value: 'KE' },
  { label: 'South Africa', value: 'ZA' },
  { label: 'Ghana', value: 'GH' },
  { label: 'Tanzania', value: 'TZ' },
  { label: 'Cameroon', value: 'CM' },
  { label: 'DRC', value: 'CD' },
  { label: 'Senegal', value: 'SN' },
  { label: 'Morocco', value: 'MA' },
  { label: 'Egypt', value: 'EG' },
  { label: 'Ethiopia', value: 'ET' },
  { label: 'Rwanda', value: 'RW' },
  { label: 'Congo-Brazzaville', value: 'CG' },
]

const CURRENCIES = [
  { label: 'USD', value: 'USD' },
  { label: 'NGN (Naira)', value: 'NGN' },
  { label: 'KES (Shilling)', value: 'KES' },
  { label: 'ZAR (Rand)', value: 'ZAR' },
  { label: 'GHS (Cedi)', value: 'GHS' },
  { label: 'TZS (Shilling)', value: 'TZS' },
  { label: 'MAD (Dirham)', value: 'MAD' },
  { label: 'EGP (Pound)', value: 'EGP' },
  { label: 'CAD', value: 'CAD' },
  { label: 'EUR', value: 'EUR' },
  { label: 'GBP', value: 'GBP' },
]

const GENRES = [
  { label: 'Afrobeats', value: 'AFROBEATS' },
  { label: 'Amapiano', value: 'AMAPIANO' },
  { label: 'Soukous', value: 'SOUKOUS' },
  { label: 'Highlife', value: 'HIGHLIFE' },
  { label: 'Bongo Flava', value: 'BONGO_FLAVA' },
  { label: 'Gospel', value: 'AFRO_GOSPEL' },
  { label: 'Kizomba', value: 'KIZOMBA' },
  { label: 'Gqom', value: 'GQOM' },
  { label: 'Ndombolo', value: 'NDOMBOLO' },
  { label: 'Rumba', value: 'CONGOLESE_RUMBA' },
  { label: 'Mixed / Festival', value: 'MIXED' },
]

export default function NewEventPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [performers, setPerformers] = useState<string[]>([])
  const [performerInput, setPerformerInput] = useState('')

  function addPerformer() {
    const name = performerInput.trim()
    if (name && !performers.includes(name)) {
      setPerformers([...performers, name])
      setPerformerInput('')
    }
  }

  function removePerformer(name: string) {
    setPerformers(performers.filter((p) => p !== name))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createEvent({
        title: fd.get('title') as string,
        description: fd.get('description') as string || undefined,
        venue: fd.get('venue') as string,
        city: fd.get('city') as string,
        country: fd.get('country') as string,
        startsAt: fd.get('startDate') as string,
        endsAt: fd.get('endDate') as string || undefined,
        ticketPrice: Number(fd.get('ticketPrice')),
        currency: fd.get('currency') as string,
        totalTickets: Number(fd.get('totalTickets')),
        performers: performers.length > 0 ? performers : undefined,
        genre: fd.get('genre') as string || undefined,
      })

      if (!res.success) {
        setError('Failed to create event. Please try again.')
        return
      }
      router.push(`../${res.eventId}`)
    })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">New Event</h1>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Event Title</label>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              placeholder="e.g. Afrobeats Live Lagos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent resize-none"
              placeholder="Describe the event…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
              <input
                name="venue"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="e.g. Eko Convention Centre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">City</label>
              <input
                name="city"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="e.g. Lagos"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Country</label>
              <select
                name="country"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              >
                <option value="">Select</option>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
              <input
                name="startDate"
                type="datetime-local"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">End Date (optional)</label>
              <input
                name="endDate"
                type="datetime-local"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Ticket Price</label>
              <input
                name="ticketPrice"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="e.g. 25.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
              <select
                name="currency"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Total Tickets</label>
              <input
                name="totalTickets"
                type="number"
                min="1"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="e.g. 500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Genre</label>
            <select
              name="genre"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
            >
              <option value="">Select genre</option>
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Performers */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Performers</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={performerInput}
                onChange={(e) => setPerformerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addPerformer() }
                }}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="Add performer name…"
              />
              <button
                type="button"
                onClick={addPerformer}
                className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Add
              </button>
            </div>
            {performers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {performers.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full bg-electric/10 px-3 py-1 text-xs font-medium text-electric"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => removePerformer(p)}
                      className="text-electric/60 hover:text-electric"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Create Event'}
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
