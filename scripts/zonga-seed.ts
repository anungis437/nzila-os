/**
 * Zonga Seed Data — SQL generator for E2E testing and demos
 *
 * Generates deterministic seed data for ALL Zonga domain tables including
 * the delta-upgrade economics, rights, payments, and intelligence layers.
 *
 * Output: SQL file at scripts/zonga-seed-output.sql
 * Usage: npx tsx scripts/zonga-seed.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Config ──────────────────────────────────────────────────────────────

const ORG_ID = '22222222-2222-2222-2222-222222222222'
const CLERK_ORG_ID = 'org_3BEaESt8ZIC4XEdJ7hmmB6nu6pp'
const SEED_DATE = '2026-01-15T00:00:00Z'
const PAYOUT_PERIOD_START = '2026-01-01T00:00:00Z'
const PAYOUT_PERIOD_END = '2026-01-31T23:59:59Z'

function uuid(prefix: string, i: number): string {
  const hex = i.toString(16).padStart(8, '0')
  return `${prefix}0000-0000-0000-0000${hex}`
}

/** Deterministic revenue amounts per creator (avoids random in seed) */
const STREAM_RATES: Record<string, number> = {
  NGN: 0.0012, KES: 0.0008, GHS: 0.0010, ZAR: 0.0015,
  XOF: 0.0007, USD: 0.0040, GBP: 0.0050, EUR: 0.0045,
}

// ── Creators ────────────────────────────────────────────────────────────

const creators = [
  { id: uuid('c1', 1), userId: uuid('u1', 1), name: 'Amara Diallo', genre: 'Afrobeats', country: 'SN', city: 'Dakar', bio: 'Pioneering Afrobeats from Dakar — voice of the Sahel generation', payoutCurrency: 'XOF', verified: true },
  { id: uuid('c1', 2), userId: uuid('u1', 2), name: 'Kwame Asante', genre: 'Highlife', country: 'GH', city: 'Accra', bio: 'Modern highlife with traditional roots from the Gold Coast', payoutCurrency: 'GHS', verified: true },
  { id: uuid('c1', 3), userId: uuid('u1', 3), name: 'Zara Okafor', genre: 'Afropop', country: 'NG', city: 'Lagos', bio: 'Chart-topping Afropop artist, 2x Headies Award winner', payoutCurrency: 'NGN', verified: true },
  { id: uuid('c1', 4), userId: uuid('u1', 4), name: 'Tendai Moyo', genre: 'Amapiano', country: 'ZA', city: 'Johannesburg', bio: 'Amapiano producer and DJ redefining piano from Jozi', payoutCurrency: 'ZAR', verified: true },
  { id: uuid('c1', 5), userId: uuid('u1', 5), name: 'Fatou Cissé', genre: 'Mbalax', country: 'SN', city: 'Saint-Louis', bio: 'Contemporary Mbalax vocalist bridging griot tradition and pop', payoutCurrency: 'XOF', verified: false },
  { id: uuid('c1', 6), userId: uuid('u1', 6), name: 'Kofi Mensah', genre: 'Hiplife', country: 'GH', city: 'Kumasi', bio: 'Hiplife pioneer blending hip-hop with highlife in Twi', payoutCurrency: 'GHS', verified: true },
  { id: uuid('c1', 7), userId: uuid('u1', 7), name: 'Nia Kamara', genre: 'R&B', country: 'KE', city: 'Nairobi', bio: 'Soulful R&B from Nairobi with Swahili undertones', payoutCurrency: 'KES', verified: false },
  { id: uuid('c1', 8), userId: uuid('u1', 8), name: 'Jabari Nkomo', genre: 'Gqom', country: 'ZA', city: 'Durban', bio: 'Underground Gqom producer pushing Durban bass worldwide', payoutCurrency: 'ZAR', verified: true },
]

// ── Content Assets ──────────────────────────────────────────────────────

const assets = [
  { id: uuid('a1', 1), creatorIdx: 0, title: 'Sunrise in Dakar', type: 'track', genre: 'Afrobeats', duration: 234 },
  { id: uuid('a1', 2), creatorIdx: 0, title: 'Ocean Waves', type: 'track', genre: 'Afrobeats', duration: 198 },
  { id: uuid('a1', 3), creatorIdx: 1, title: 'Accra Nights', type: 'track', genre: 'Highlife', duration: 267 },
  { id: uuid('a1', 4), creatorIdx: 1, title: 'Golden Coast', type: 'track', genre: 'Highlife', duration: 312 },
  { id: uuid('a1', 5), creatorIdx: 2, title: 'Lagos Love', type: 'track', genre: 'Afropop', duration: 245 },
  { id: uuid('a1', 6), creatorIdx: 2, title: 'Victoria Island', type: 'track', genre: 'Afropop', duration: 189 },
  { id: uuid('a1', 7), creatorIdx: 3, title: 'Joburg Groove', type: 'track', genre: 'Amapiano', duration: 278 },
  { id: uuid('a1', 8), creatorIdx: 3, title: 'Township Beats', type: 'track', genre: 'Amapiano', duration: 356 },
  { id: uuid('a1', 9), creatorIdx: 4, title: 'Dakar Dawn', type: 'track', genre: 'Mbalax', duration: 223 },
  { id: uuid('a1', 10), creatorIdx: 5, title: 'Kumasi Flow', type: 'track', genre: 'Hiplife', duration: 201 },
  { id: uuid('a1', 11), creatorIdx: 6, title: 'Nairobi Nights', type: 'track', genre: 'R&B', duration: 289 },
  { id: uuid('a1', 12), creatorIdx: 7, title: 'Durban Bass', type: 'track', genre: 'Gqom', duration: 334 },
]

// ── Releases ────────────────────────────────────────────────────────────

const releases = [
  { id: uuid('r1', 1), creatorIdx: 0, title: 'Sahel Sounds', type: 'album', status: 'published' },
  { id: uuid('r1', 2), creatorIdx: 1, title: 'Gold Coast Chronicles', type: 'ep', status: 'published' },
  { id: uuid('r1', 3), creatorIdx: 2, title: 'Lagos Diaries', type: 'album', status: 'published' },
  { id: uuid('r1', 4), creatorIdx: 3, title: 'Piano Stories', type: 'ep', status: 'published' },
  { id: uuid('r1', 5), creatorIdx: 4, title: 'Mbalax Rising', type: 'single', status: 'draft' },
  { id: uuid('r1', 6), creatorIdx: 5, title: 'Hiplife Heritage', type: 'album', status: 'published' },
]

const assetPairs = [
  [0, 1],  // release 0 — Sahel Sounds
  [2, 3],  // release 1 — Gold Coast Chronicles
  [4, 5],  // release 2 — Lagos Diaries
  [6, 7],  // release 3 — Piano Stories
  [8],     // release 4 — Mbalax Rising
  [9],     // release 5 — Hiplife Heritage
]

// ── Events ──────────────────────────────────────────────────────────────

const events = [
  { id: uuid('e1', 1), creatorIdx: 0, title: 'Dakar Music Festival 2026', venue: 'Place du Souvenir Africain', city: 'Dakar', country: 'Senegal', currency: 'XOF', gaPrice: 5000, vipPrice: 15000, daysFromSeed: 30 },
  { id: uuid('e1', 2), creatorIdx: 2, title: 'Lagos Live Sessions', venue: 'Eko Hotel & Suites', city: 'Lagos', country: 'Nigeria', currency: 'NGN', gaPrice: 10000, vipPrice: 50000, daysFromSeed: 45 },
  { id: uuid('e1', 3), creatorIdx: 3, title: 'Amapiano Nights Jozi', venue: 'Constitution Hill', city: 'Johannesburg', country: 'ZA', currency: 'ZAR', gaPrice: 250, vipPrice: 750, daysFromSeed: 60 },
  { id: uuid('e1', 4), creatorIdx: 6, title: 'Nairobi Soundscapes', venue: 'KICC Amphitheatre', city: 'Nairobi', country: 'Kenya', currency: 'KES', gaPrice: 2000, vipPrice: 8000, daysFromSeed: 75 },
  { id: uuid('e1', 5), creatorIdx: 7, title: 'Durban Bass Carnival', venue: 'Moses Mabhida Stadium', city: 'Durban', country: 'ZA', currency: 'ZAR', gaPrice: 200, vipPrice: 600, daysFromSeed: 90 },
]

// ── Listeners ───────────────────────────────────────────────────────────

const listeners = [
  { id: uuid('l1', 1), displayName: 'Adama Traoré', email: 'adama@example.com', city: 'Dakar', country: 'Senegal' },
  { id: uuid('l1', 2), displayName: 'Chioma Eze', email: 'chioma@example.com', city: 'Lagos', country: 'Nigeria' },
  { id: uuid('l1', 3), displayName: 'Thabo Molefe', email: 'thabo@example.com', city: 'Johannesburg', country: 'ZA' },
  { id: uuid('l1', 4), displayName: 'Wanjiku Mwangi', email: 'wanjiku@example.com', city: 'Nairobi', country: 'Kenya' },
  { id: uuid('l1', 5), displayName: 'Yaa Mensah', email: 'yaa@example.com', city: 'Accra', country: 'Ghana' },
  { id: uuid('l1', 6), displayName: 'Ibrahim Diop', email: 'ibrahim@example.com', city: 'Abidjan', country: 'Côte d\'Ivoire' },
]

// ── SQL Generation ──────────────────────────────────────────────────────

function esc(val: string | number | boolean | null | undefined): string {
  if (val == null) return 'NULL'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  return `'${String(val).replace(/'/g, "''")}'`
}

function jsonEsc(obj: Record<string, unknown>): string {
  return esc(JSON.stringify(obj))
}

function seedDate(offsetDays: number): string {
  const d = new Date(SEED_DATE)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

function generateSQL(): string {
  const lines: string[] = [
    '-- ═══════════════════════════════════════════════════════════════════════',
    '-- Zonga Platform Seed Data (Delta Upgrade Edition)',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Org: ${ORG_ID} (Clerk: ${CLERK_ORG_ID})`,
    '-- Covers: creators, assets, releases, events, tickets, listeners,',
    '-- economics (ledger, splits, payouts), rights, moderation, integrity',
    '-- ═══════════════════════════════════════════════════════════════════════',
    '',
    'BEGIN;',
    '',
    '-- ── Cleanup (reverse FK order) ──',
    `DELETE FROM zonga_outbox WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_integrity_signals WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_moderation_cases WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_notifications WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_listener_activity WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_listener_playlist_saves WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_listener_favorites WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_listener_follows WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_playlist_items WHERE playlist_id IN (SELECT id FROM zonga_playlists WHERE org_id = ${esc(ORG_ID)});`,
    `DELETE FROM zonga_playlists WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_ticket_purchases WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_ticket_types WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_events WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_wallet_ledger WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_payout_previews WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_payouts WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_royalty_splits WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_revenue_events WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_release_tracks WHERE release_id IN (SELECT id FROM zonga_releases WHERE org_id = ${esc(ORG_ID)});`,
    `DELETE FROM zonga_releases WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_content_assets WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_creator_accounts WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_listeners WHERE org_id = ${esc(ORG_ID)};`,
    `DELETE FROM zonga_creators WHERE org_id = ${esc(ORG_ID)};`,
    '',
    '-- ═══ Org ═══',
    `INSERT INTO orgs (id, clerk_org_id, legal_name, jurisdiction, fiscal_year_end, policy_config, status)`,
    `VALUES (${esc(ORG_ID)}, ${esc(CLERK_ORG_ID)}, 'Zonga Music Platform', 'CA-QC', '12-31', '{"tier":"PREMIUM"}', 'active')`,
    `ON CONFLICT (id) DO UPDATE SET clerk_org_id = EXCLUDED.clerk_org_id;`,
    '',
  ]

  // ── Creators ──────────────────────────────────────────────────────────
  lines.push('-- ═══ Creators ═══')
  for (const c of creators) {
    lines.push(
      `INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)`,
      `VALUES (${esc(c.id)}, ${esc(ORG_ID)}, ${esc(c.userId)}, ${esc(c.name)}, ${esc(c.bio)}, 'active', ${esc(c.genre)}, ${esc(c.country)}, ${esc(c.city)}, ${esc(c.payoutCurrency)}, ${esc(c.verified)}, ${esc(SEED_DATE)});`,
    )
  }

  // ── Creator Accounts ──────────────────────────────────────────────────
  lines.push('', '-- ═══ Creator Accounts ═══')
  for (let i = 0; i < creators.length; i++) {
    const c = creators[i]
    const email = `${c.name.toLowerCase().replace(/\s+/g, '.').replace(/['']/g, '')}@zonga.example.com`
    const onboarding = c.verified ? 'active' : 'payout_ready'
    lines.push(
      `INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)`,
      `VALUES (${esc(uuid('ca', i + 1))}, ${esc(ORG_ID)}, ${esc(c.id)}, ${esc(email)}, ${esc(onboarding)}, ${c.verified ? "'approved'" : "'pending'"}, ${esc(SEED_DATE)});`,
    )
  }

  // ── Content Assets ────────────────────────────────────────────────────
  lines.push('', '-- ═══ Content Assets ═══')
  for (const a of assets) {
    lines.push(
      `INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)`,
      `VALUES (${esc(a.id)}, ${esc(ORG_ID)}, ${esc(creators[a.creatorIdx].id)}, ${esc(a.title)}, ${esc(a.type)}, 'published', ${esc(a.genre)}, ${a.duration}, ${jsonEsc({ isrc: `NGZON26${String(assets.indexOf(a) + 1).padStart(5, '0')}` })}, ${esc(SEED_DATE)}, ${esc(SEED_DATE)});`,
    )
  }

  // ── Releases ──────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Releases ═══')
  for (const r of releases) {
    const pubDate = r.status === 'published' ? esc('2026-02-01T00:00:00Z') : 'NULL'
    lines.push(
      `INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)`,
      `VALUES (${esc(r.id)}, ${esc(ORG_ID)}, ${esc(creators[r.creatorIdx].id)}, ${esc(r.title)}, ${esc(r.type)}, ${esc(r.status)}, ${pubDate}, ${pubDate}, ${esc(SEED_DATE)});`,
    )
  }

  // ── Release Tracks ────────────────────────────────────────────────────
  lines.push('', '-- ═══ Release Tracks ═══')
  let trackIdx = 0
  for (let ri = 0; ri < releases.length; ri++) {
    for (let ti = 0; ti < (assetPairs[ri]?.length ?? 0); ti++) {
      const assetIdx = assetPairs[ri][ti]
      trackIdx++
      lines.push(
        `INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)`,
        `VALUES (${esc(uuid('rt', trackIdx))}, ${esc(releases[ri].id)}, ${esc(assets[assetIdx].id)}, ${ti + 1}, ${esc(SEED_DATE)});`,
      )
    }
  }

  // ── Royalty Splits ────────────────────────────────────────────────────
  lines.push('', '-- ═══ Royalty Splits (revenue sharing) ═══')
  const publishedReleases = releases.filter(r => r.status === 'published')
  let splitIdx = 0
  for (const r of publishedReleases) {
    const primary = creators[r.creatorIdx]
    // Primary artist gets 80%, platform gets 20% (represented by a "platform" creator row)
    splitIdx++
    lines.push(
      `INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)`,
      `VALUES (${esc(uuid('rs', splitIdx))}, ${esc(ORG_ID)}, ${esc(r.id)}, ${esc(primary.id)}, ${esc(primary.name)}, 80.00, ${esc(SEED_DATE)});`,
    )
    // Featured artist on first 2 releases (collaboration)
    if (releases.indexOf(r) < 2) {
      const featured = creators[(r.creatorIdx + 1) % creators.length]
      splitIdx++
      lines.push(
        `INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)`,
        `VALUES (${esc(uuid('rs', splitIdx))}, ${esc(ORG_ID)}, ${esc(r.id)}, ${esc(featured.id)}, ${esc(featured.name)}, 20.00, ${esc(SEED_DATE)});`,
      )
    }
  }

  // ── Events ────────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Events ═══')
  for (const ev of events) {
    const startsAt = seedDate(ev.daysFromSeed)
    const endsAt = seedDate(ev.daysFromSeed + 0.167) // +4 hours
    lines.push(
      `INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status, ticketing_status, metadata, created_at)`,
      `VALUES (${esc(ev.id)}, ${esc(ORG_ID)}, ${esc(creators[ev.creatorIdx].id)}, ${esc(ev.title)}, ${esc(`Live music experience in ${ev.city}`)}, ${esc(ev.venue)}, ${esc(ev.city)}, ${esc(ev.country)}, ${esc(startsAt)}, ${esc(endsAt)}, 'published', 'on_sale', '{}', ${esc(SEED_DATE)});`,
    )
  }

  // ── Ticket Types ──────────────────────────────────────────────────────
  lines.push('', '-- ═══ Ticket Types ═══')
  const ticketTypes: Array<{ id: string; eventIdx: number; tier: string; price: number; currency: string; qty: number }> = []
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    const gaId = uuid('tt', i * 3 + 1)
    const vipId = uuid('tt', i * 3 + 2)
    const earlyId = uuid('tt', i * 3 + 3)
    ticketTypes.push(
      { id: gaId, eventIdx: i, tier: 'General Admission', price: ev.gaPrice, currency: ev.currency, qty: 500 },
      { id: vipId, eventIdx: i, tier: 'VIP', price: ev.vipPrice, currency: ev.currency, qty: 50 },
      { id: earlyId, eventIdx: i, tier: 'Early Bird', price: Math.round(ev.gaPrice * 0.7), currency: ev.currency, qty: 100 },
    )
    lines.push(
      `INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)`,
      `VALUES (${esc(gaId)}, ${esc(ORG_ID)}, ${esc(ev.id)}, 'General Admission', ${ev.gaPrice}, ${esc(ev.currency)}, 500, ${esc(SEED_DATE)});`,
      `INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)`,
      `VALUES (${esc(vipId)}, ${esc(ORG_ID)}, ${esc(ev.id)}, 'VIP', ${ev.vipPrice}, ${esc(ev.currency)}, 50, ${esc(SEED_DATE)});`,
      `INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)`,
      `VALUES (${esc(earlyId)}, ${esc(ORG_ID)}, ${esc(ev.id)}, 'Early Bird', ${Math.round(ev.gaPrice * 0.7)}, ${esc(ev.currency)}, 100, ${esc(SEED_DATE)});`,
    )
  }

  // ── Listeners ─────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Listeners ═══')
  for (const l of listeners) {
    lines.push(
      `INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)`,
      `VALUES (${esc(l.id)}, ${esc(ORG_ID)}, ${esc(l.displayName)}, ${esc(l.email)}, ${esc(l.city)}, ${esc(l.country)}, ${esc(SEED_DATE)});`,
    )
  }

  // ── Follows ───────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Follows ═══')
  const followPairs = [
    [0, 0], [0, 2], [0, 4],    // Adama → Amara, Zara, Fatou (Senegal/West Africa)
    [1, 2], [1, 5], [1, 0],    // Chioma → Zara, Kofi, Amara (Nigeria/Ghana)
    [2, 3], [2, 7], [2, 1],    // Thabo → Tendai, Jabari, Kwame (SA listeners)
    [3, 6], [3, 2], [3, 0],    // Wanjiku → Nia, Zara, Amara (Kenya/pan-African)
    [4, 1], [4, 5], [4, 2],    // Yaa → Kwame, Kofi, Zara (Ghana locals)
    [5, 0], [5, 4], [5, 1],    // Ibrahim → Amara, Fatou, Kwame (Francophone)
  ]
  for (let i = 0; i < followPairs.length; i++) {
    const [li, ci] = followPairs[i]
    lines.push(
      `INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)`,
      `VALUES (${esc(uuid('fl', i + 1))}, ${esc(ORG_ID)}, ${esc(listeners[li].id)}, ${esc(creators[ci].id)}, ${esc(seedDate(i))});`,
    )
  }

  // ── Favorites ─────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Favorites ═══')
  const favPairs = [
    [0, 0], [0, 8],              // Adama → Sunrise in Dakar, Dakar Dawn
    [1, 4], [1, 5], [1, 9],     // Chioma → Lagos Love, Victoria Island, Kumasi Flow
    [2, 6], [2, 7], [2, 11],    // Thabo → Joburg Groove, Township Beats, Durban Bass
    [3, 10], [3, 2],             // Wanjiku → Nairobi Nights, Accra Nights
    [4, 2], [4, 3], [4, 9],     // Yaa → Accra Nights, Golden Coast, Kumasi Flow
    [5, 0], [5, 1], [5, 8],     // Ibrahim → Sunrise, Ocean Waves, Dakar Dawn
  ]
  for (let i = 0; i < favPairs.length; i++) {
    const [li, ai] = favPairs[i]
    lines.push(
      `INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)`,
      `VALUES (${esc(uuid('fv', i + 1))}, ${esc(ORG_ID)}, ${esc(listeners[li].id)}, 'asset', ${esc(assets[ai].id)}, ${esc(seedDate(i))});`,
    )
  }

  // ── Playlists ─────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Playlists ═══')
  const playlists = [
    { id: uuid('pl', 1), listenerIdx: 0, title: 'Sahel Vibes', visibility: 'public' },
    { id: uuid('pl', 2), listenerIdx: 1, title: 'Naija to the World', visibility: 'public' },
    { id: uuid('pl', 3), listenerIdx: 2, title: 'Amapiano Essentials', visibility: 'public' },
    { id: uuid('pl', 4), listenerIdx: 4, title: 'Ghana Highlife Gold', visibility: 'public' },
    { id: uuid('pl', 5), listenerIdx: 3, title: 'My Late Night Mix', visibility: 'private' },
  ]
  for (const pl of playlists) {
    lines.push(
      `INSERT INTO zonga_playlists (id, org_id, owner_type, owner_id, title, visibility, created_at)`,
      `VALUES (${esc(pl.id)}, ${esc(ORG_ID)}, 'listener', ${esc(listeners[pl.listenerIdx].id)}, ${esc(pl.title)}, ${esc(pl.visibility)}, ${esc(SEED_DATE)});`,
    )
  }

  lines.push('', '-- ═══ Playlist Items ═══')
  const playlistItems = [
    [0, 0, 1], [0, 1, 2], [0, 8, 3],        // Sahel Vibes: Dakar tracks
    [1, 4, 1], [1, 5, 2], [1, 9, 3],        // Naija: Lagos tracks + Kumasi
    [2, 6, 1], [2, 7, 2], [2, 11, 3],       // Amapiano: Jozi + Durban
    [3, 2, 1], [3, 3, 2], [3, 9, 3],        // Ghana Gold: Accra + Kumasi
    [4, 10, 1], [4, 0, 2], [4, 6, 3],       // Late Night: Nairobi + Dakar + Jozi
  ]
  for (let i = 0; i < playlistItems.length; i++) {
    const [pli, ai, pos] = playlistItems[i]
    lines.push(
      `INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)`,
      `VALUES (${esc(uuid('pi', i + 1))}, ${esc(playlists[pli].id)}, 'asset', ${esc(assets[ai].id)}, ${pos}, ${esc(SEED_DATE)});`,
    )
  }

  // ── Playlist Saves ────────────────────────────────────────────────────
  lines.push('', '-- ═══ Playlist Saves ═══')
  const playlistSaves = [
    [1, 0], [2, 0],   // Chioma and Thabo save Sahel Vibes
    [0, 1], [3, 1],   // Adama and Wanjiku save Naija to the World
    [4, 3],            // Yaa saves Ghana Gold
  ]
  for (let i = 0; i < playlistSaves.length; i++) {
    const [li, pli] = playlistSaves[i]
    lines.push(
      `INSERT INTO zonga_listener_playlist_saves (id, org_id, listener_id, playlist_id, created_at)`,
      `VALUES (${esc(uuid('ps', i + 1))}, ${esc(ORG_ID)}, ${esc(listeners[li].id)}, ${esc(playlists[pli].id)}, ${esc(seedDate(i + 5))});`,
    )
  }

  // ── Revenue Events (deterministic streams & ticket sales) ──────────
  lines.push('', '-- ═══ Revenue Events ═══')
  const revenueEvents: Array<{ id: string; creatorIdx: number; assetIdx: number | null; type: string; amount: number; currency: string; day: number }> = []

  // 30 stream revenue events across all creators (spread over Jan 2026)
  for (let i = 0; i < 36; i++) {
    const assetIdx = i % assets.length
    const creatorIdx = assets[assetIdx].creatorIdx
    const currency = creators[creatorIdx].payoutCurrency
    const rate = STREAM_RATES[currency] ?? 0.003
    const streams = 500 + (i * 137) % 4500 // deterministic pseudo-random 500-5000
    const amount = Number((streams * rate).toFixed(6))
    const rv = { id: uuid('rv', i + 1), creatorIdx, assetIdx, type: 'stream', amount, currency, day: (i % 30) + 1 }
    revenueEvents.push(rv)
    lines.push(
      `INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)`,
      `VALUES (${esc(rv.id)}, ${esc(ORG_ID)}, ${esc(creators[creatorIdx].id)}, ${esc(assets[assetIdx].id)}, 'stream', ${amount}, ${esc(currency)}, ${esc(assets[assetIdx].title)}, 'zonga', ${esc(`${streams} streams`)}, ${esc(seedDate(rv.day))}, ${esc(seedDate(rv.day))});`,
    )
  }

  // Ticket sale revenue events for first 3 events
  for (let i = 0; i < 3; i++) {
    const ev = events[i]
    const creatorIdx = ev.creatorIdx
    const rvId = uuid('rv', 37 + i)
    const amount = ev.gaPrice * 120 + ev.vipPrice * 15 // 120 GA + 15 VIP tickets
    revenueEvents.push({ id: rvId, creatorIdx, assetIdx: null, type: 'ticket_sale', amount, currency: ev.currency, day: ev.daysFromSeed - 5 })
    lines.push(
      `INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)`,
      `VALUES (${esc(rvId)}, ${esc(ORG_ID)}, ${esc(creators[creatorIdx].id)}, 'ticket_sale', ${amount}, ${esc(ev.currency)}, ${esc(`Ticket revenue: ${ev.title}`)}, ${esc(seedDate(ev.daysFromSeed - 5))}, ${esc(seedDate(ev.daysFromSeed - 5))});`,
    )
  }

  // Tip revenue events
  for (let i = 0; i < 6; i++) {
    const creatorIdx = i % creators.length
    const currency = creators[creatorIdx].payoutCurrency
    const tipAmounts: Record<string, number> = { XOF: 1000, NGN: 2000, GHS: 20, ZAR: 50, KES: 500, USD: 5 }
    const amount = tipAmounts[currency] ?? 5
    const rvId = uuid('rv', 40 + i)
    revenueEvents.push({ id: rvId, creatorIdx, assetIdx: null, type: 'tip', amount, currency, day: 10 + i })
    lines.push(
      `INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)`,
      `VALUES (${esc(rvId)}, ${esc(ORG_ID)}, ${esc(creators[creatorIdx].id)}, 'tip', ${amount}, ${esc(currency)}, 'Fan tip', ${esc(seedDate(10 + i))}, ${esc(seedDate(10 + i))});`,
    )
  }

  // ── Wallet Ledger (double-entry credits for revenue) ──────────────
  lines.push('', '-- ═══ Wallet Ledger ═══')
  // Aggregate revenue per creator, then write credit entries
  const creatorBalances = new Map<number, number>()
  let ledgerIdx = 0
  for (const rv of revenueEvents) {
    const prev = creatorBalances.get(rv.creatorIdx) ?? 0
    const newBal = Number((prev + rv.amount).toFixed(6))
    creatorBalances.set(rv.creatorIdx, newBal)
    ledgerIdx++
    lines.push(
      `INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)`,
      `VALUES (${esc(uuid('wl', ledgerIdx))}, ${esc(ORG_ID)}, ${esc(creators[rv.creatorIdx].id)}, 'credit', ${rv.amount}, ${esc(rv.currency)}, ${esc(`Revenue: ${rv.type}`)}, ${esc(rv.id)}, ${newBal}, ${esc(seedDate(rv.day))});`,
    )
  }

  // ── Payouts ───────────────────────────────────────────────────────────
  lines.push('', '-- ═══ Payouts ═══')
  const payoutRails: Record<string, string> = {
    XOF: 'orange_money', NGN: 'flutterwave', GHS: 'mtn_momo',
    ZAR: 'bank_transfer', KES: 'mpesa',
  }
  // 3 completed payouts for top earners
  const payoutCreators = [0, 2, 3] // Amara (XOF), Zara (NGN), Tendai (ZAR)
  for (let i = 0; i < payoutCreators.length; i++) {
    const ci = payoutCreators[i]
    const c = creators[ci]
    const bal = creatorBalances.get(ci) ?? 0
    const payoutAmt = Number((bal * 0.8).toFixed(2)) // pay 80% of balance
    const newBal = Number((bal - payoutAmt).toFixed(6))
    creatorBalances.set(ci, newBal)
    const payoutId = uuid('po', i + 1)

    lines.push(
      `INSERT INTO zonga_payouts (id, org_id, creator_id, creator_name, amount, currency, status, payout_rail, period_start, period_end, revenue_event_count, previewed_at, approved_at, completed_at, created_at)`,
      `VALUES (${esc(payoutId)}, ${esc(ORG_ID)}, ${esc(c.id)}, ${esc(c.name)}, ${payoutAmt}, ${esc(c.payoutCurrency)}, 'completed', ${esc(payoutRails[c.payoutCurrency] ?? 'bank_transfer')}, ${esc(PAYOUT_PERIOD_START)}, ${esc(PAYOUT_PERIOD_END)}, 10, ${esc(seedDate(28))}, ${esc(seedDate(29))}, ${esc(seedDate(30))}, ${esc(seedDate(28))});`,
    )

    // Debit entry for the payout
    ledgerIdx++
    lines.push(
      `INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, payout_id, balance_after, created_at)`,
      `VALUES (${esc(uuid('wl', ledgerIdx))}, ${esc(ORG_ID)}, ${esc(c.id)}, 'debit', ${payoutAmt}, ${esc(c.payoutCurrency)}, 'Payout completed', ${esc(payoutId)}, ${newBal}, ${esc(seedDate(30))});`,
    )
  }

  // 1 pending payout
  const pendingCI = 1 // Kwame
  const pendingC = creators[pendingCI]
  const pendingBal = creatorBalances.get(pendingCI) ?? 0
  lines.push(
    `INSERT INTO zonga_payouts (id, org_id, creator_id, creator_name, amount, currency, status, payout_rail, period_start, period_end, revenue_event_count, created_at)`,
    `VALUES (${esc(uuid('po', 4))}, ${esc(ORG_ID)}, ${esc(pendingC.id)}, ${esc(pendingC.name)}, ${Number((pendingBal * 0.8).toFixed(2))}, ${esc(pendingC.payoutCurrency)}, 'pending', 'mtn_momo', ${esc(PAYOUT_PERIOD_START)}, ${esc(PAYOUT_PERIOD_END)}, 6, ${esc(seedDate(30))});`,
  )

  // ── Payout Previews ───────────────────────────────────────────────────
  lines.push('', '-- ═══ Payout Previews ═══')
  for (let i = 0; i < 4; i++) {
    const ci = [0, 2, 3, 1][i]
    const c = creators[ci]
    const bal = creatorBalances.get(ci) ?? 0
    const previewStatus = i < 3 ? 'locked' : 'draft'
    lines.push(
      `INSERT INTO zonga_payout_previews (id, org_id, creator_id, period_start, period_end, total_amount, currency, status, created_at)`,
      `VALUES (${esc(uuid('pp', i + 1))}, ${esc(ORG_ID)}, ${esc(c.id)}, ${esc(PAYOUT_PERIOD_START)}, ${esc(PAYOUT_PERIOD_END)}, ${Number(bal.toFixed(2))}, ${esc(c.payoutCurrency)}, ${esc(previewStatus)}, ${esc(seedDate(27))});`,
    )
  }

  // ── Ticket Purchases ──────────────────────────────────────────────────
  lines.push('', '-- ═══ Ticket Purchases ═══')
  const purchases = [
    { listenerIdx: 0, eventIdx: 0, ttOffset: 0, status: 'confirmed' }, // Adama → Dakar GA
    { listenerIdx: 0, eventIdx: 0, ttOffset: 1, status: 'confirmed' }, // Adama → Dakar VIP
    { listenerIdx: 1, eventIdx: 1, ttOffset: 0, status: 'confirmed' }, // Chioma → Lagos GA
    { listenerIdx: 2, eventIdx: 2, ttOffset: 1, status: 'confirmed' }, // Thabo → Jozi VIP
    { listenerIdx: 3, eventIdx: 3, ttOffset: 0, status: 'confirmed' }, // Wanjiku → Nairobi GA
    { listenerIdx: 4, eventIdx: 1, ttOffset: 2, status: 'confirmed' }, // Yaa → Lagos Early Bird
    { listenerIdx: 5, eventIdx: 0, ttOffset: 0, status: 'pending' },   // Ibrahim → Dakar GA (pending)
    { listenerIdx: 2, eventIdx: 4, ttOffset: 0, status: 'confirmed' }, // Thabo → Durban GA
    { listenerIdx: 3, eventIdx: 1, ttOffset: 1, status: 'refunded' },  // Wanjiku → Lagos VIP (refunded)
  ]
  for (let i = 0; i < purchases.length; i++) {
    const p = purchases[i]
    const ev = events[p.eventIdx]
    const tt = ticketTypes.find(t => t.eventIdx === p.eventIdx && ticketTypes.indexOf(t) % 3 === p.ttOffset)!
    const confirmedAt = p.status === 'confirmed' ? esc(seedDate(ev.daysFromSeed - 10)) : 'NULL'
    lines.push(
      `INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)`,
      `VALUES (${esc(uuid('tp', i + 1))}, ${esc(ORG_ID)}, ${esc(ev.id)}, ${esc(tt.id)}, ${esc(listeners[p.listenerIdx].id)}, ${esc(p.status)}, ${tt.price}, ${esc(tt.currency)}, ${confirmedAt}, ${esc(seedDate(ev.daysFromSeed - 12))});`,
    )
  }

  // ── Listener Activity (streaming sessions) ───────────────────────────
  lines.push('', '-- ═══ Listener Activity ═══')
  const activityTypes = ['play', 'play', 'play', 'follow', 'favorite', 'share', 'buy_ticket']
  let actIdx = 0
  for (let li = 0; li < listeners.length; li++) {
    for (let day = 1; day <= 5; day++) {
      const ai = (li * 3 + day) % assets.length
      const actType = activityTypes[(li + day) % activityTypes.length]
      actIdx++
      lines.push(
        `INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)`,
        `VALUES (${esc(uuid('la', actIdx))}, ${esc(ORG_ID)}, ${esc(listeners[li].id)}, ${esc(actType)}, 'asset', ${esc(assets[ai].id)}, ${jsonEsc({ duration: 120 + day * 30, quality: 'medium', country: listeners[li].country })}, ${esc(seedDate(day))});`,
      )
    }
  }

  // ── Moderation Cases ──────────────────────────────────────────────────
  lines.push('', '-- ═══ Moderation Cases ═══')
  const modCases = [
    { entityType: 'asset', entityIdx: 11, caseType: 'copyright', status: 'resolved', severity: 'high', notes: 'Sample clearance verified — original production confirmed via beat license', dayOffset: 5 },
    { entityType: 'asset', entityIdx: 5, caseType: 'quality', status: 'dismissed', severity: 'low', notes: 'Audio quality meets minimum 128kbps AAC threshold', dayOffset: 8 },
    { entityType: 'creator', entityIdx: 6, caseType: 'policy', status: 'in_review', severity: 'medium', notes: 'Bio text flagged for review — pending manual check', dayOffset: 12 },
    { entityType: 'asset', entityIdx: 7, caseType: 'copyright', status: 'open', severity: 'high', notes: 'DMCA-style claim filed by third party — investigating ownership', dayOffset: 15 },
    { entityType: 'release', entityIdx: 2, caseType: 'quality', status: 'resolved', severity: 'low', notes: 'Cover art resolution upgraded to meet 3000x3000px minimum', dayOffset: 3 },
  ]
  for (let i = 0; i < modCases.length; i++) {
    const mc = modCases[i]
    const entityId = mc.entityType === 'asset' ? assets[mc.entityIdx].id
      : mc.entityType === 'creator' ? creators[mc.entityIdx].id
      : releases[mc.entityIdx].id
    const resolvedAt = mc.status === 'resolved' || mc.status === 'dismissed' ? esc(seedDate(mc.dayOffset + 3)) : 'NULL'
    lines.push(
      `INSERT INTO zonga_moderation_cases (id, org_id, entity_type, entity_id, case_type, status, severity, notes, resolved_at, created_at)`,
      `VALUES (${esc(uuid('mc', i + 1))}, ${esc(ORG_ID)}, ${esc(mc.entityType)}, ${esc(entityId)}, ${esc(mc.caseType)}, ${esc(mc.status)}, ${esc(mc.severity)}, ${esc(mc.notes)}, ${resolvedAt}, ${esc(seedDate(mc.dayOffset))});`,
    )
  }

  // ── Integrity Signals ─────────────────────────────────────────────────
  lines.push('', '-- ═══ Integrity Signals ═══')
  const signals = [
    { entityType: 'asset', entityIdx: 0, signalType: 'stream_spike', severity: 'warning', explanation: '312% stream increase in 24h from Dakar region — likely organic (festival promo)', day: 20 },
    { entityType: 'asset', entityIdx: 6, signalType: 'bot_pattern', severity: 'critical', explanation: 'Repeated 31-second plays from same /24 subnet — 89% bot probability', day: 22 },
    { entityType: 'creator', entityIdx: 7, signalType: 'geo_anomaly', severity: 'info', explanation: '95% of streams from single city (Durban) — consistent with local artist profile', day: 18 },
    { entityType: 'asset', entityIdx: 4, signalType: 'duplicate_content', severity: 'warning', explanation: 'Audio fingerprint 94% match with existing track — may be remix/sample', day: 10 },
    { entityType: 'creator', entityIdx: 2, signalType: 'payout_anomaly', severity: 'info', explanation: 'Revenue spike correlates with verified Nigeria Independence Day streaming event', day: 25 },
  ]
  for (let i = 0; i < signals.length; i++) {
    const s = signals[i]
    const entityId = s.entityType === 'asset' ? assets[s.entityIdx].id : creators[s.entityIdx].id
    lines.push(
      `INSERT INTO zonga_integrity_signals (id, org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json, created_at)`,
      `VALUES (${esc(uuid('is', i + 1))}, ${esc(ORG_ID)}, ${esc(s.entityType)}, ${esc(entityId)}, ${esc(s.signalType)}, ${esc(s.severity)}, ${esc(s.explanation)}, '{}', ${esc(seedDate(s.day))});`,
    )
  }

  // ── Notifications ─────────────────────────────────────────────────────
  lines.push('', '-- ═══ Notifications ═══')
  const notifications = [
    { creatorIdx: 0, type: 'payout_completed', title: 'Payout Sent', body: 'XOF payout via Orange Money has been completed', read: true },
    { creatorIdx: 2, type: 'payout_completed', title: 'Payout Sent', body: 'NGN payout via Flutterwave has been completed', read: true },
    { creatorIdx: 3, type: 'payout_completed', title: 'Payout Sent', body: 'ZAR payout via bank transfer has been completed', read: false },
    { creatorIdx: 1, type: 'new_release', title: 'Release Published', body: 'Gold Coast Chronicles is now live on Zonga', read: true },
    { creatorIdx: 5, type: 'new_release', title: 'Release Published', body: 'Hiplife Heritage is now live on Zonga', read: false },
    { creatorIdx: 7, type: 'moderation_action', title: 'Copyright Review', body: 'A copyright claim has been filed on Township Beats — please provide evidence', read: false },
    { creatorIdx: 6, type: 'event_reminder', title: 'Event Coming Up', body: 'Nairobi Soundscapes is 10 days away — check ticket sales', read: false },
    { creatorIdx: 0, type: 'system', title: 'Welcome to Zonga', body: 'Your creator profile is verified — you can now receive payouts', read: true },
  ]
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i]
    lines.push(
      `INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)`,
      `VALUES (${esc(uuid('nt', i + 1))}, ${esc(ORG_ID)}, ${esc(creators[n.creatorIdx].userId)}, ${esc(n.type)}, ${esc(n.title)}, ${esc(n.body)}, ${esc(n.read)}, ${esc(seedDate(i + 1))});`,
    )
  }

  // ── Outbox Events ─────────────────────────────────────────────────────
  lines.push('', '-- ═══ Outbox Events ═══')
  const outboxEvents = [
    { eventType: 'payout.completed', payload: { payoutId: uuid('po', 1), creatorId: creators[0].id, amount: 'see payout table', currency: 'XOF' }, status: 'dispatched' },
    { eventType: 'payout.completed', payload: { payoutId: uuid('po', 2), creatorId: creators[2].id, amount: 'see payout table', currency: 'NGN' }, status: 'dispatched' },
    { eventType: 'release.published', payload: { releaseId: releases[1].id, creatorId: creators[1].id, title: 'Gold Coast Chronicles' }, status: 'dispatched' },
    { eventType: 'moderation.case_opened', payload: { caseId: uuid('mc', 4), entityType: 'asset', entityId: assets[7].id }, status: 'pending' },
    { eventType: 'integrity.signal_detected', payload: { signalId: uuid('is', 2), signalType: 'bot_pattern', severity: 'critical' }, status: 'pending' },
  ]
  for (let i = 0; i < outboxEvents.length; i++) {
    const oe = outboxEvents[i]
    const dispatchedAt = oe.status === 'dispatched' ? esc(seedDate(29)) : 'NULL'
    lines.push(
      `INSERT INTO zonga_outbox (id, org_id, event_type, payload, status, dispatched_at, created_at)`,
      `VALUES (${esc(uuid('ob', i + 1))}, ${esc(ORG_ID)}, ${esc(oe.eventType)}, ${jsonEsc(oe.payload as Record<string, unknown>)}, ${esc(oe.status)}, ${dispatchedAt}, ${esc(seedDate(28))});`,
    )
  }

  lines.push('', 'COMMIT;', '', '-- ═══ Seed complete ═══')
  return lines.join('\n')
}

// ── Main ────────────────────────────────────────────────────────────────

const output = generateSQL()
const outputPath = path.join(__dirname, 'zonga-seed-output.sql')
fs.writeFileSync(outputPath, output, 'utf-8')
console.log('✓ Zonga platform seed SQL written to', outputPath)
console.log('  ─────────────────────────────────────')
console.log(`  Creators:          ${creators.length}`)
console.log(`  Creator Accounts:  ${creators.length}`)
console.log(`  Content Assets:    ${assets.length}`)
console.log(`  Releases:          ${releases.length}`)
console.log(`  Release Tracks:    ${assetPairs.flat().length}`)
console.log(`  Royalty Splits:    ${releases.filter(r => r.status === 'published').length + 2}`)
console.log(`  Events:            ${events.length}`)
console.log(`  Ticket Types:      ${events.length * 3}`)
console.log(`  Ticket Purchases:  9`)
console.log(`  Listeners:         ${listeners.length}`)
console.log(`  Follows:           18`)
console.log(`  Favorites:         16`)
console.log(`  Playlists:         5`)
console.log(`  Playlist Items:    15`)
console.log(`  Revenue Events:    45`)
console.log(`  Wallet Ledger:     48`)
console.log(`  Payouts:           4`)
console.log(`  Payout Previews:   4`)
console.log(`  Moderation Cases:  5`)
console.log(`  Integrity Signals: 5`)
console.log(`  Notifications:     8`)
console.log(`  Outbox Events:     5`)
console.log('  ─────────────────────────────────────')
