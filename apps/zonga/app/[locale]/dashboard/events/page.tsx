/**
 * Zonga — Events Page (Server Component).
 *
 * All users see a polished discovery view of published events.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { browsePublishedEvents } from '@/lib/actions/browse-actions'
import type { EventListResult } from '@/lib/actions/event-actions'
import { Calendar, MapPin, Clock, Mic2 } from 'lucide-react'

/* ── Helpers ── */

function formatEventDate(iso: string) {
  const d = new Date(iso)
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: d.getDate(),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    full: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const page = Number(params.page ?? '1')

  // Events is a discovery page — all users browse published events
  const { events, total } = await browsePublishedEvents({ page })

  return <ListenerEventsView events={events} total={total} />
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Listener View                                                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ListenerEventsView({
  events,
  total,
}: {
  events: EventListResult['events']
  total: number
}) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-navy via-navy/95 to-amber-600/70 p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.12),transparent_50%)]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <Calendar size={22} />
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Live Events</h1>
          </div>
          <p className="text-white/70 text-sm max-w-lg">
            Concerts, festivals, and live sessions from your favorite Afrobeats artists.
            {total > 0 && ` ${total} upcoming event${total !== 1 ? 's' : ''} available.`}
          </p>
        </div>
      </div>

      {/* Event Cards */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/50 p-14 text-center">
          <Calendar size={36} className="mx-auto text-muted-foreground/50 mb-4" />
          <p className="font-semibold text-foreground text-lg">No upcoming events</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
            We&apos;re working on bringing amazing live experiences to you. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(events as Array<{
            id: string; title: string; description?: string; venue: string;
            city: string; country: string; startsAt: string; endsAt?: string;
            status: string; imageUrl?: string; creatorName?: string;
          }>).map((event) => {
            const dt = formatEventDate(event.startsAt)
            const endDt = event.endsAt ? formatEventDate(event.endsAt) : null

            return (
              <Link key={event.id} href={`events/${event.id}`} className="block group">
                <div className="relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg hover:shadow-electric/5 hover:border-electric/20">
                  <div className="flex">
                    {/* Date Column */}
                    <div className="hidden sm:flex flex-col items-center justify-center w-24 shrink-0 bg-linear-to-b from-amber-500/10 to-amber-600/5 border-r border-border px-3 py-5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">{dt.month}</span>
                      <span className="text-3xl font-black text-foreground leading-none mt-1">{dt.day}</span>
                      <span className="text-[11px] font-medium text-muted-foreground mt-1">{dt.weekday}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground text-base group-hover:text-electric transition-colors truncate">
                            {event.title}
                          </h3>
                          {event.creatorName && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Mic2 size={12} className="text-electric shrink-0" />
                              <span className="text-xs font-medium text-electric">{event.creatorName}</span>
                            </div>
                          )}
                        </div>
                        {event.status === 'sold_out' && (
                          <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 shrink-0">
                            Sold Out
                          </span>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-rose-500 shrink-0" />
                          {event.venue}{event.city ? `, ${event.city}` : ''}{event.country ? ` · ${event.country}` : ''}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-amber-500 shrink-0" />
                          {dt.time}{endDt ? ` – ${endDt.time}` : ''}
                        </span>
                        {/* Mobile date (hidden on sm+) */}
                        <span className="inline-flex items-center gap-1.5 sm:hidden">
                          <Calendar size={13} className="text-electric shrink-0" />
                          {dt.full}
                        </span>
                      </div>
                    </div>

                    {/* Hover arrow */}
                    <div className="hidden sm:flex items-center pr-5 text-muted-foreground/30 group-hover:text-electric transition-colors">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

