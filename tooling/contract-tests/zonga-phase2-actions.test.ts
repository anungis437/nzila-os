/**
 * Contract Test — Zonga Phase 2 Actions (Social, Notifications, Search, Events, Playlists)
 *
 * Structural invariants:
 *   1. Every action file uses 'use server' directive
 *   2. Every action calls auth() for authentication
 *   3. All actions use platformDb for data access
 *   4. All actions use structured logger
 *   5. Action files export the expected public API
 *
 * @invariant ZNG-ACT2-01: Server action auth guard
 * @invariant ZNG-ACT2-02: platformDb usage
 * @invariant ZNG-ACT2-03: Logger integration
 * @invariant ZNG-ACT2-04: Exported function signatures
 * @invariant ZNG-ACT2-05: Audit log pattern (INSERT INTO audit_log)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA_ACTIONS = join(ROOT, 'apps', 'zonga', 'lib', 'actions')

const PHASE2_ACTION_FILES = [
  'social-actions.ts',
  'notification-actions.ts',
  'search-actions.ts',
  'playlist-actions.ts',
  'event-actions.ts',
]

describe('ZNG-ACT2 — Phase 2 action files exist', () => {
  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(join(ZONGA_ACTIONS, file))).toBe(true)
    })
  }
})

describe('ZNG-ACT2-01 — Every action file uses "use server" directive', () => {
  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} has 'use server'`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain("'use server'")
    })
  }
})

describe('ZNG-ACT2-01 — Every action file calls auth()', () => {
  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} authenticates via auth()`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      // resolveOrgContext() wraps auth() — see lib/resolve-org.ts
      expect(
        content.includes('auth()') || content.includes('resolveOrgContext()'),
        `${file} must call auth() directly or via resolveOrgContext()`,
      ).toBe(true)
    })
  }
})

describe('ZNG-ACT2-02 — All actions use platformDb', () => {
  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} imports platformDb`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('platformDb')
    })
  }
})

describe('ZNG-ACT2-03 — All actions use structured logger', () => {
  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} imports logger`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('logger')
    })
  }
})

describe('ZNG-ACT2-05 — All actions use audit_log INSERT pattern', () => {
  const MUTATION_FILES = [
    'social-actions.ts',
    'notification-actions.ts',
    'playlist-actions.ts',
    'event-actions.ts',
  ]

  for (const file of MUTATION_FILES) {
    it(`${file} uses INSERT INTO audit_log`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('INSERT INTO audit_log')
    })
  }
})

/* ─── Social Actions Contract ─── */

describe('ZNG-ACT2-04 — Social actions exported functions', () => {
  it('exports followUser, unfollowUser, likeAsset, unlikeAsset, postComment, tipCreator', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function followUser')
    expect(content).toContain('export async function unfollowUser')
    expect(content).toContain('export async function likeAsset')
    expect(content).toContain('export async function unlikeAsset')
    expect(content).toContain('export async function postComment')
    expect(content).toContain('export async function tipCreator')
  })

  it('exports listing functions: listFollowers, listFollowing, listComments', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listFollowers')
    expect(content).toContain('export async function listFollowing')
    expect(content).toContain('export async function listComments')
  })

  it('exports stats: getSocialStats, getAssetLikeCount', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getSocialStats')
    expect(content).toContain('export async function getAssetLikeCount')
  })

  it('tipCreator records revenue.recorded for the creator', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'revenue.recorded'")
    // Revenue type must use enum (RevenueType.TIP), not hardcoded 'tip' string
    expect(content).toContain('RevenueType.TIP')
  })

  it('uses proper audit actions for social events', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'social.followed'")
    expect(content).toContain("'social.unfollowed'")
    expect(content).toContain("'social.liked'")
    expect(content).toContain("'social.unliked'")
    expect(content).toContain("'social.commented'")
    expect(content).toContain("'social.tipped'")
  })
})

/* ─── Notification Actions Contract ─── */

describe('ZNG-ACT2-04 — Notification actions exported functions', () => {
  it('exports listNotifications, markAsRead, markAllRead, createNotification', () => {
    const path = join(ZONGA_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listNotifications')
    expect(content).toContain('export async function markAsRead')
    expect(content).toContain('export async function markAllRead')
    expect(content).toContain('export async function createNotification')
  })

  it('exports getUnreadCount', () => {
    const path = join(ZONGA_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getUnreadCount')
  })

  it('uses proper audit actions for notifications', () => {
    const path = join(ZONGA_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'notification.created'")
    expect(content).toContain("'notification.read'")
    expect(content).toContain("'notification.read_all'")
  })

  it('markAsRead and markAllRead call revalidatePath', () => {
    const path = join(ZONGA_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('revalidatePath')
  })
})

/* ─── Search Actions Contract ─── */

describe('ZNG-ACT2-04 — Search actions exported functions', () => {
  it('exports globalSearch, getTrending, getRecentlyPlayed', () => {
    const path = join(ZONGA_ACTIONS, 'search-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function globalSearch')
    expect(content).toContain('export async function getTrending')
    expect(content).toContain('export async function getRecentlyPlayed')
  })

  it('globalSearch queries across multiple entity types', () => {
    const path = join(ZONGA_ACTIONS, 'search-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'asset.created'")
    expect(content).toContain("'creator.registered'")
    expect(content).toContain("'event.created'")
    expect(content).toContain("'playlist.created'")
  })

  it('exports SearchResult and SearchResults types', () => {
    const path = join(ZONGA_ACTIONS, 'search-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export interface SearchResult')
    expect(content).toContain('export interface SearchResults')
  })
})

/* ─── Playlist Actions Contract ─── */

describe('ZNG-ACT2-04 — Playlist actions exported functions', () => {
  it('exports listPlaylists, getPlaylistDetail, createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist', () => {
    const path = join(ZONGA_ACTIONS, 'playlist-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listPlaylists')
    expect(content).toContain('export async function getPlaylistDetail')
    expect(content).toContain('export async function createPlaylist')
    expect(content).toContain('export async function addTrackToPlaylist')
    expect(content).toContain('export async function removeTrackFromPlaylist')
  })

  it('uses proper audit actions for playlists', () => {
    const path = join(ZONGA_ACTIONS, 'playlist-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'playlist.created'")
    expect(content).toContain("'playlist.track.added'")
    expect(content).toContain("'playlist.track.removed'")
  })
})

/* ─── Event Actions Contract ─── */

describe('ZNG-ACT2-04 — Event actions exported functions', () => {
  it('exports listEvents, getEventDetail, createEvent, publishEvent, purchaseTicket, listTickets', () => {
    const path = join(ZONGA_ACTIONS, 'event-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listEvents')
    expect(content).toContain('export async function getEventDetail')
    expect(content).toContain('export async function createEvent')
    expect(content).toContain('export async function publishEvent')
    expect(content).toContain('export async function purchaseTicket')
    expect(content).toContain('export async function listTickets')
  })

  it('purchaseTicket integrates Stripe checkout', () => {
    const path = join(ZONGA_ACTIONS, 'event-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('createCheckoutSession')
    expect(content).toContain("from '@/lib/stripe'")
  })

  it('purchaseTicket records revenue', () => {
    const path = join(ZONGA_ACTIONS, 'event-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'revenue.recorded'")
    expect(content).toContain("'ticket_sale'")
  })

  it('uses proper audit actions for events', () => {
    const path = join(ZONGA_ACTIONS, 'event-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'event.created'")
    expect(content).toContain("'event.published'")
    expect(content).toContain("'event.ticket.purchased'")
  })
})

/* ─── publishRelease addition to release-actions ─── */

describe('ZNG-ACT2 — publishRelease added to release-actions', () => {
  it('release-actions.ts exports publishRelease', () => {
    const path = join(ZONGA_ACTIONS, 'release-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function publishRelease')
  })

  it('publishRelease uses release.published audit action', () => {
    const path = join(ZONGA_ACTIONS, 'release-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("'release.published'")
  })
})
