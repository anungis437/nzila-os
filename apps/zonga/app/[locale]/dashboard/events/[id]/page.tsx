/**
 * Zonga — Event Detail Page (Server Component).
 *
 * Creators see full management view with ticket stats & purchase table.
 * Listeners see a polished read-only event page.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getEventDetail, getPublishedEventDetail } from '@/lib/actions/event-actions'
import { formatCurrencyAmount } from '@/lib/stripe'
import { Calendar, MapPin, Clock, Mic2, ArrowLeft } from 'lucide-react'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const isCreator = !!orgId

  if (isCreator) {
    const { event, tickets, ticketsSold, ticketRevenue } = await getEventDetail(id)
    if (!event) notFound()
    return (
      <CreatorEventDetail
        event={event}
        tickets={tickets}
        ticketsSold={ticketsSold}
        ticketRevenue={ticketRevenue}
        eventId={id}
      />
    )
  }

  const { event, creatorName } = await getPublishedEventDetail(id)
  if (!event) notFound()
  return <ListenerEventDetail event={event} creatorName={creatorName} />
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Listener View                                                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ListenerEventDetail({
  event,
  creatorName,
}: {
  event: {
    id: string; title: string; description?: string; venue: string;
    city: string; country: string; startsAt: string; endsAt?: string;
    status: string; imageUrl?: string;
  }
  creatorName: string | null
}) {
  const start = new Date(event.startsAt)
  const end = event.endsAt ? new Date(event.endsAt) : null
  const dateFull = start.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const timeStart = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const timeEnd = end?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="../events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft size={14} />
        All Events
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-navy via-navy/95 to-amber-600/70 p-8 sm:p-10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.12),transparent_50%)]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div>
            {event.status === 'sold_out' && (
              <span className="inline-flex rounded-full bg-red-500/20 border border-red-400/30 px-3 py-0.5 text-xs font-semibold text-red-200 mb-3">
                Sold Out
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{event.title}</h1>
            {creatorName && (
              <div className="flex items-center gap-2 mt-2">
                <Mic2 size={14} className="text-amber-300" />
                <span className="text-sm font-medium text-amber-200">{creatorName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} className="text-white/50" />
              {dateFull}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} className="text-white/50" />
              {timeStart}{timeEnd ? ` – ${timeEnd}` : ''}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-white/50" />
              {event.venue}, {event.city}, {event.country}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {event.description && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">About this event</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Event Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Venue</dt>
                <dd className="text-foreground font-medium text-right">{event.venue}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="text-foreground text-right">{event.city}, {event.country}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="text-foreground text-right">{start.toLocaleDateString('en-CA')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Time</dt>
                <dd className="text-foreground text-right">{timeStart}{timeEnd ? ` – ${timeEnd}` : ''}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Creator View (management)                                                  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CreatorEventDetail({
  event,
  tickets,
  ticketsSold,
  ticketRevenue,
  eventId,
}: {
  event: {
    id: string; title: string; description?: string; venue: string;
    city: string; country: string; startsAt: string; endsAt?: string;
    status: string; imageUrl?: string; totalTickets?: number;
    ticketPrice?: number; currency?: string; genre?: string;
    performers?: string[];
  }
  tickets: Array<{
    id: string; buyerName?: string; buyerEmail?: string;
    quantity?: number; totalPrice?: number; currency: string;
    status: string; createdAt?: Date;
  }>
  ticketsSold: number
  ticketRevenue: number
  eventId: string
}) {
  const statusColors: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    sold_out: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-muted text-muted-foreground',
  }

  const performers = Array.isArray(event.performers) ? event.performers : []

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link href="../events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
        ← All Events
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            statusColors[event.status] ?? statusColors.draft
          }`}>
            {event.status?.replace(/_/g, ' ')}
          </span>
          <span className="text-sm text-muted-foreground">
            {event.venue} · {event.city}, {event.country}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Tickets Sold</p>
            <p className="text-2xl font-bold text-foreground">{ticketsSold}/{event.totalTickets}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Ticket Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrencyAmount(Math.round(ticketRevenue * 100), event.currency ?? 'USD')}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Price / Ticket</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrencyAmount(Math.round(Number(event.ticketPrice) * 100), event.currency ?? 'USD')}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="text-lg font-bold text-foreground">
              {new Date(event.startsAt).toLocaleDateString('en-CA')}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          {event.description && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">📋 Description</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            </Card>
          )}

          {/* Performers */}
          {performers.length > 0 && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">🎤 Performer Lineup</h2>
                <div className="flex flex-wrap gap-2">
                  {performers.map((performer: string) => (
                    <span
                      key={performer}
                      className="inline-flex rounded-full bg-electric/10 px-3 py-1 text-xs font-medium text-electric"
                    >
                      {performer}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Tickets Table */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                🎟️ Ticket Purchases ({tickets.length})
              </h2>
              {tickets.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tickets purchased yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-2">Buyer</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Total</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tickets.slice(0, 25).map((t) => (
                        <tr key={t.id}>
                          <td className="py-2">
                            <p className="font-medium text-foreground">{t.buyerName ?? t.buyerEmail}</p>
                            {t.buyerName && (
                              <p className="text-xs text-muted-foreground/70">{t.buyerEmail}</p>
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground">{t.quantity}</td>
                          <td className="py-2 font-medium text-foreground">
                            {formatCurrencyAmount(Math.round(Number(t.totalPrice) * 100), t.currency ?? 'USD')}
                          </td>
                          <td className="py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              t.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600'
                              : t.status === 'used' ? 'bg-blue-500/10 text-blue-600'
                              : t.status === 'cancelled' ? 'bg-red-500/10 text-red-600'
                              : 'bg-amber-500/10 text-amber-600'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2 text-muted-foreground/70">
                            {t.createdAt
                              ? new Date(t.createdAt).toLocaleDateString('en-CA')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📋 Event Info</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Venue</dt>
                  <dd className="text-foreground font-medium">{event.venue}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="text-foreground">{event.city}, {event.country}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Start</dt>
                  <dd className="text-foreground">{new Date(event.startsAt).toLocaleDateString('en-CA')}</dd>
                </div>
                {event.endsAt && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">End</dt>
                    <dd className="text-foreground">{new Date(event.endsAt).toLocaleDateString('en-CA')}</dd>
                  </div>
                )}
                {event.genre && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Genre</dt>
                    <dd className="text-foreground">{event.genre.replace(/_/g, ' ')}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Event ID</dt>
                  <dd className="font-mono text-xs text-foreground">{eventId.slice(0, 12)}…</dd>
                </div>
              </dl>
            </div>
          </Card>

          {/* Capacity Gauge */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📊 Capacity</h2>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-electric transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (ticketsSold / Math.max(1, event.totalTickets ?? 0)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                {ticketsSold} / {event.totalTickets} tickets sold (
                {Math.round((ticketsSold / Math.max(1, event.totalTickets ?? 0)) * 100)}%)
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
