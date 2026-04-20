import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ScrollReveal from '@/components/public/scroll-reveal'
import { getZongaPilotMode } from '@/lib/pilot-mode'
import { getClientBrand } from '@/lib/branding/brand-config'
import { getPublicArtists, getPublicEvents } from '@/lib/public-data'

const CURATED_PLAYLISTS: Array<{ id: string; title: string; trackCount: number }> = [
  { id: 'ms-001', title: 'MS Celebrations Launch Set', trackCount: 24 },
  { id: 'ms-002', title: 'Diaspora Wedding Anthems', trackCount: 18 },
  { id: 'ms-003', title: 'Afro Soul Evening', trackCount: 20 },
  { id: 'ms-004', title: 'Founding Partner Spotlight', trackCount: 16 },
]

export const metadata: Metadata = {
  title: 'MS Celebrations x Zonga Pilot Preview',
  description: 'Founding partner preview experience for the MS Celebrations pilot tenant.',
}

export default async function MsCelebrationsPilotPage() {
  if (getZongaPilotMode() !== 'ms_celebrations') {
    notFound()
  }

  const brand = getClientBrand()
  const [artists, eventsData] = await Promise.all([
    getPublicArtists({ limit: 6 }),
    getPublicEvents({ upcoming: true, limit: 4 }),
  ])
  const playlists = CURATED_PLAYLISTS

  return (
    <main className="bg-navy text-white min-h-screen">
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="rounded-2xl border border-white/20 bg-white/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-electric-light">pilotMode = ms_celebrations</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Image src={brand.logoUrl ?? '/logo-zonga.svg'} alt={brand.name} width={64} height={64} className="rounded-lg bg-white object-cover" />
                <div>
                  <h1 className="text-3xl font-bold">{brand.name} Founding Partner Preview</h1>
                  <p className="text-sm text-gray-300 mt-1">Premium label landing page with artist, playlist, event, and analytics highlights.</p>
                </div>
              </div>
              <div className="mt-5 inline-flex items-center rounded-full bg-electric/20 px-3 py-1 text-xs font-semibold text-electric-light">
                Partnership banner: Founding launch partner for diaspora-first catalog growth
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <ScrollReveal>
            <h2 className="text-2xl font-semibold">Featured Artists</h2>
          </ScrollReveal>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {artists.slice(0, 6).map((artist) => (
              <div key={artist.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="truncate text-sm font-medium">{artist.name}</p>
                <p className="mt-1 text-xs text-gray-300 truncate">{artist.genre ?? 'Afro diaspora'}</p>
              </div>
            ))}
          </div>

          <ScrollReveal>
            <h2 className="text-2xl font-semibold">Curated Playlists</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium truncate">{playlist.title}</p>
                <p className="mt-1 text-xs text-gray-300">{playlist.trackCount} tracks</p>
              </div>
            ))}
          </div>

          <ScrollReveal>
            <h2 className="text-2xl font-semibold">Upcoming Events</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {eventsData.slice(0, 4).map((event) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium truncate">{event.title}</p>
                <p className="mt-1 text-xs text-gray-300">{event.city ?? 'City TBD'}, {event.country ?? 'Country TBD'}</p>
              </div>
            ))}
          </div>

          <ScrollReveal>
            <h2 className="text-2xl font-semibold">Analytics Snapshot</h2>
          </ScrollReveal>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Streams', value: '12.4K' },
              { label: 'Unique listeners', value: '4.1K' },
              { label: 'Top markets', value: 'CA / FR / CD' },
              { label: 'Completion', value: '61.8%' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-300">{card.label}</p>
                <p className="mt-1 text-lg font-semibold">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Link href="/for-labels" className="rounded-lg bg-electric px-4 py-2 text-sm font-semibold text-white hover:bg-electric/90">
              Back to Zonga for Labels & Creators
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
