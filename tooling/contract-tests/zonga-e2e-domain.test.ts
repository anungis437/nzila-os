/**
 * Contract Test — Zonga E2E Domain Table Migration
 *
 * Validates that ALL action files now use domain tables (not audit_log)
 * as their primary data store, and that new capabilities exist.
 *
 * @invariant ZNG-E2E-01: Domain table pattern (no audit_log SELECT/UPDATE for operational data)
 * @invariant ZNG-E2E-02: New action files exist (listener, moderation)
 * @invariant ZNG-E2E-03: Public marketing routes exist
 * @invariant ZNG-E2E-04: Upload actions use domain tables
 * @invariant ZNG-E2E-05: Analytics includes engagement metrics
 * @invariant ZNG-E2E-06: Release state machine integration
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA = join(ROOT, 'apps', 'zonga')
const ACTIONS = join(ZONGA, 'lib', 'actions')
const MARKETING = join(ZONGA, 'app', '(marketing)')

// ── ZNG-E2E-01: Domain table pattern ──────────────────────────────────────

describe('ZNG-E2E-01 — Action files use domain tables, not audit_log for reads', () => {
  const actionFiles = [
    'creator-actions.ts',
    'release-actions.ts',
    'catalog-actions.ts',
    'playlist-actions.ts',
    'search-actions.ts',
    // social-actions.ts excluded: comments intentionally remain in audit_log (append-only reads)
    'notification-actions.ts',
    'upload-actions.ts',
  ]

  for (const file of actionFiles) {
    it(`${file} does not SELECT FROM audit_log for operational data`, () => {
      const path = join(ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      // audit_log INSERT is fine (supplementary tracing), but no SELECT FROM or UPDATE audit_log
      const selectPattern = /SELECT[\s\S]*?FROM\s+audit_log/i
      const updatePattern = /UPDATE\s+audit_log/i
      expect(selectPattern.test(content)).toBe(false)
      expect(updatePattern.test(content)).toBe(false)
    })
  }

  it('catalog-actions uses zonga_content_assets table', () => {
    const content = readFileSync(join(ACTIONS, 'catalog-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_content_assets')
  })

  it('playlist-actions uses zonga_playlists and zonga_playlist_items', () => {
    const content = readFileSync(join(ACTIONS, 'playlist-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_playlists')
    expect(content).toContain('zonga_playlist_items')
  })

  it('social-actions uses zonga_listener_follows and zonga_listener_favorites', () => {
    const content = readFileSync(join(ACTIONS, 'social-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_listener_follows')
    expect(content).toContain('zonga_listener_favorites')
  })

  it('notification-actions uses zonga_notifications', () => {
    const content = readFileSync(join(ACTIONS, 'notification-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_notifications')
  })

  it('search-actions queries domain tables for global search', () => {
    const content = readFileSync(join(ACTIONS, 'search-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_content_assets')
    expect(content).toContain('zonga_creators')
    expect(content).toContain('zonga_events')
    expect(content).toContain('zonga_playlists')
  })
})

// ── ZNG-E2E-02: New action files ────────────────────────────────────────

describe('ZNG-E2E-02 — New action files exist with expected exports', () => {
  it('listener-actions.ts exists with expected functions', () => {
    const path = join(ACTIONS, 'listener-actions.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'use server'")
    expect(content).toContain('export async function getListenerProfile')
    expect(content).toContain('export async function ensureListenerProfile')
    expect(content).toContain('export async function getListenerFeed')
    expect(content).toContain('export async function recordActivity')
    expect(content).toContain('export async function savePlaylist')
    expect(content).toContain('export async function unsavePlaylist')
    expect(content).toContain('export async function discoverArtists')
    expect(content).toContain('export async function discoverReleases')
  })

  it('moderation-actions.ts exists with expected functions', () => {
    const path = join(ACTIONS, 'moderation-actions.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'use server'")
    expect(content).toContain('export async function listModerationCases')
    expect(content).toContain('export async function getModerationCase')
    expect(content).toContain('export async function createModerationCase')
    expect(content).toContain('export async function resolveModerationCase')
    expect(content).toContain('export async function recordIntegritySignal')
    expect(content).toContain('export async function getModerationStats')
  })

  it('moderation-actions uses zonga_moderation_cases and zonga_integrity_signals', () => {
    const content = readFileSync(join(ACTIONS, 'moderation-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_moderation_cases')
    expect(content).toContain('zonga_integrity_signals')
  })

  it('listener-actions uses zonga_listeners domain table', () => {
    const content = readFileSync(join(ACTIONS, 'listener-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_listeners')
    expect(content).toContain('zonga_listener_activity')
    expect(content).toContain('zonga_listener_playlist_saves')
  })
})

// ── ZNG-E2E-03: Public marketing routes ─────────────────────────────────

describe('ZNG-E2E-03 — Public marketing routes exist', () => {
  it('artists listing page exists', () => {
    expect(existsSync(join(MARKETING, 'artists', 'page.tsx'))).toBe(true)
  })

  it('artist profile page exists with [id] segment', () => {
    expect(existsSync(join(MARKETING, 'artists', '[id]', 'page.tsx'))).toBe(true)
  })

  it('events listing page exists', () => {
    expect(existsSync(join(MARKETING, 'events', 'page.tsx'))).toBe(true)
  })

  it('public-data.ts exists with public query functions', () => {
    const path = join(ZONGA, 'lib', 'public-data.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getPublicArtists')
    expect(content).toContain('export async function getPublicArtistProfile')
    expect(content).toContain('export async function getPublicEvents')
    expect(content).toContain('export async function getArtistFacets')
    // Must NOT use resolveOrgContext (public — no auth required)
    expect(content).not.toContain('resolveOrgContext')
  })

it('proxy allows /events as public route', () => {
    const content = readFileSync(join(ZONGA, 'proxy.ts'), 'utf-8')
    expect(content).toContain("'/events(.*)'")
  })

  it('site navigation includes Events link', () => {
    const content = readFileSync(
      join(ZONGA, 'components', 'public', 'site-navigation.tsx'),
      'utf-8',
    )
    expect(content).toContain("href: '/events'")
  })
})

// ── ZNG-E2E-04: Upload actions use domain tables ────────────────────────

describe('ZNG-E2E-04 — Upload actions use domain tables', () => {
  it('upload-actions updates zonga_content_assets not audit_log', () => {
    const content = readFileSync(join(ACTIONS, 'upload-actions.ts'), 'utf-8')
    expect(content).toContain('UPDATE zonga_content_assets')
    expect(content).toContain('storage_url')
    expect(content).toContain('cover_art_url')
    expect(content).not.toContain('UPDATE audit_log')
    expect(content).not.toContain('jsonb_set')
  })
})

// ── ZNG-E2E-05: Analytics includes engagement metrics ───────────────────

describe('ZNG-E2E-05 — Analytics includes engagement metrics', () => {
  it('AnalyticsOverview type includes social fields', () => {
    const content = readFileSync(join(ACTIONS, 'release-actions.ts'), 'utf-8')
    expect(content).toContain('totalFollowers: number')
    expect(content).toContain('totalFavorites: number')
    expect(content).toContain('totalCreators: number')
    expect(content).toContain('totalReleases: number')
    expect(content).toContain('topCreators:')
  })

  it('analytics page displays engagement section', () => {
    const content = readFileSync(
      join(ZONGA, 'app', '[locale]', 'dashboard', 'analytics', 'page.tsx'),
      'utf-8',
    )
    expect(content).toContain('Active Creators')
    expect(content).toContain('Published Releases')
    expect(content).toContain('Total Favorites')
    expect(content).toContain('Artist Follows')
    expect(content).toContain('Top Creators')
  })
})

// ── ZNG-E2E-06: Release state machine ───────────────────────────────────

describe('ZNG-E2E-06 — Release state machine integration', () => {
  it('release-state-machine.ts exists', () => {
    expect(existsSync(join(ZONGA, 'lib', 'workflows', 'release-state-machine.ts'))).toBe(true)
  })

  it('release-actions exports transitionReleaseStatus', () => {
    const content = readFileSync(join(ACTIONS, 'release-actions.ts'), 'utf-8')
    expect(content).toContain('export async function transitionReleaseStatus')
  })

  it('release-actions exports createTicketType (via event-actions)', () => {
    const content = readFileSync(join(ACTIONS, 'event-actions.ts'), 'utf-8')
    expect(content).toContain('export async function createTicketType')
  })
})

// ── Dashboard pages ─────────────────────────────────────────────────────

describe('ZNG-E2E — Dashboard pages exist', () => {
  const dashboardPages = [
    ['listener', 'page.tsx'],
    ['moderation', 'page.tsx'],
    ['analytics', 'page.tsx'],
    ['catalog', 'page.tsx'],
    ['releases', 'page.tsx'],
    ['events', 'page.tsx'],
  ]

  for (const [dir, file] of dashboardPages) {
    it(`dashboard/${dir}/${file} exists`, () => {
      expect(
        existsSync(join(ZONGA, 'app', '[locale]', 'dashboard', dir, file)),
      ).toBe(true)
    })
  }

  it('layout.tsx has Listener and Moderation sidebar links', () => {
    const content = readFileSync(
      join(ZONGA, 'app', '[locale]', 'dashboard', 'layout.tsx'),
      'utf-8',
    )
    expect(content).toContain('My Music')
    expect(content).toContain('Moderation')
  })
})
