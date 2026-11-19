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
 * @invariant ZNG-ACT2-05: Domain table pattern (primary writes to domain tables; audit_log for tracing only)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA_ACTIONS = join(ROOT, 'apps', 'zonga', 'lib', 'actions')
const ZONGA_LIB = join(ROOT, 'apps', 'zonga', 'lib')
const read = (...parts: string[]) => readFileSync(join(...parts), 'utf-8')
const RESOLVE_ORG = () => read(ZONGA_LIB, 'resolve-org.ts')
const ACTION_CONTEXT = () => read(ROOT, 'apps', 'zonga', 'queries', 'action-context.ts')
const SERVICE = (name: string) => read(ZONGA_LIB, 'services', `${name}.ts`)

/** Map of exported async function name -> its source chunk (up to the next export). */
function exportedFunctions(content: string): Map<string, string> {
  const out = new Map<string, string>()
  const parts = content.split(/\nexport async function /)
  for (const part of parts.slice(1)) {
    const name = /^(\w+)/.exec(part)?.[1]
    if (name) out.set(name, part.split(/\nexport /)[0])
  }
  return out
}

/**
 * Scoped-callback actions: every exported function delegates to
 * resolveOrgContext('<purpose>', ...) — the scoped auth + transaction + log
 * choke point in lib/resolve-org.ts — instead of touching auth/db inline.
 */
function routesEveryExportThroughScopedContext(content: string): boolean {
  const fns = exportedFunctions(content)
  return (
    content.includes("from '@/lib/resolve-org'") &&
    fns.size > 0 &&
    [...fns.values()].every((body) =>
      /resolveOrgContext\(\s*'(personal|published|organization)'/.test(body),
    )
  )
}

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
  it('resolveOrgContext authenticates via auth() and validates the actor before any scoped work', () => {
    const content = RESOLVE_ORG()
    const impl = content.split('async function resolveScopedContext')[1] ?? ''
    expect(impl).toMatch(
      /^[\s\S]*?\{\s*const identity = await auth\(\)\s*actor\(identity\.userId\)/,
    )
    // Every callback purpose re-checks the live identity before running the operation.
    expect(impl.match(/\(await auth\(\)\)\.userId !== actorId/g)?.length).toBeGreaterThanOrEqual(2)
    // The exported entry point is a thin logging wrapper over the scoped implementation.
    expect(content).toContain('return await resolveScopedContext<T>(purpose, options, operation)')
  })

  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} authenticates via auth()`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      // Legacy files call auth()/resolveOrgContext() inline; refactored files must
      // route EVERY exported action through the scoped resolveOrgContext callback.
      expect(
        content.includes('auth()') ||
          content.includes('resolveOrgContext()') ||
          routesEveryExportThroughScopedContext(content),
        `${file} must call auth() directly or route every export via resolveOrgContext()`,
      ).toBe(true)
    })
  }
})

describe('ZNG-ACT2-02 — All actions use platformDb', () => {
  it('scoped actions reach platformDb only through withZongaTransaction (queries/action-context.ts)', () => {
    expect(ACTION_CONTEXT()).toContain("import { platformDb } from '@nzila/db/platform'")
    expect(ACTION_CONTEXT()).toContain('return platformDb.transaction(operation)')
    const resolver = RESOLVE_ORG()
    expect(resolver).toContain('withZongaTransaction')
    expect(resolver).not.toContain('@nzila/db/platform')
  })

  it('services behind scoped actions use only the scoped context.db, never platformDb directly', () => {
    for (const svc of [
      'listener-social',
      'published-catalog',
      'moderation-notifications',
      'listener-library',
    ]) {
      const content = SERVICE(svc)
      expect(content, svc).not.toContain('platformDb')
      expect(content, svc).not.toContain('@nzila/db/platform')
      expect(content, svc).toContain('context.db.execute')
    }
  })

  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} imports platformDb`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      // NO_RAW_DB_IN_ACTIONS_001: refactored files reach platformDb via the
      // scoped transaction asserted above instead of importing it.
      expect(
        content.includes('platformDb') || routesEveryExportThroughScopedContext(content),
        `${file} must use platformDb or route every export via scoped resolveOrgContext`,
      ).toBe(true)
    })
  }
})

describe('ZNG-ACT2-03 — All actions use structured logger', () => {
  it('resolveOrgContext logs every scoped-action failure with the structured logger and rethrows', () => {
    const content = RESOLVE_ORG()
    expect(content).toContain("import { logger } from '@/lib/logger'")
    const wrapper = content.split('async function resolveScopedContext')[0]
    const tryBlock = wrapper.slice(wrapper.lastIndexOf('export async function resolveOrgContext'))
    expect(tryBlock).toContain('try {')
    expect(tryBlock).toMatch(/logger\[status === 500 \? 'error' : 'warn'\]\('Zonga action failed'/)
    // Failures are surfaced, never swallowed into an empty/successful result.
    expect(tryBlock).toContain('throw error')
    expect(tryBlock).not.toMatch(/return\s*(\[\]|\{\s*success:\s*(false|true))/)
  })

  for (const file of PHASE2_ACTION_FILES) {
    it(`${file} imports logger`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(
        content.includes('logger') || routesEveryExportThroughScopedContext(content),
        `${file} must log directly or route every export via scoped resolveOrgContext (which logs)`,
      ).toBe(true)
    })
  }
})

describe('ZNG-ACT2-05 — Mutation actions write to domain tables', () => {
  it('social-actions writes to zonga_listener_follows and zonga_listener_favorites', () => {
    const content = readFileSync(join(ZONGA_ACTIONS, 'social-actions.ts'), 'utf-8')
    // Writes moved to lib/services/listener-social.ts; actions delegate to it.
    expect(content).toContain("from '@/lib/services/listener-social'")
    const fns = exportedFunctions(content)
    for (const name of ['followCreator', 'followUser'])
      expect(fns.get(name)).toContain('follow(context,')
    for (const name of ['favoriteEntity', 'likeAsset'])
      expect(fns.get(name)).toContain('favorite(context,')
    const svc = SERVICE('listener-social')
    expect(svc).toContain('INSERT INTO public.zonga_listener_follows')
    expect(svc).toContain('INSERT INTO public.zonga_listener_favorites')
  })

  it('notification-actions writes to zonga_notifications', () => {
    const content = readFileSync(join(ZONGA_ACTIONS, 'notification-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_notifications')
  })

  it('playlist-actions writes to zonga_playlists and zonga_playlist_items', () => {
    const content = readFileSync(join(ZONGA_ACTIONS, 'playlist-actions.ts'), 'utf-8')
    expect(content).toContain('zonga_playlists')
    expect(content).toContain('zonga_playlist_items')
  })

  it('event-actions uses INSERT INTO audit_log for tracing', () => {
    const content = readFileSync(join(ZONGA_ACTIONS, 'event-actions.ts'), 'utf-8')
    expect(content).toContain('INSERT INTO audit_log')
  })
})

/* ─── Social Actions Contract ─── */

describe('ZNG-ACT2-04 — Social actions exported functions', () => {
  it('exports followCreator, unfollowCreator, favoriteEntity, unfavoriteEntity, postComment, tipCreator', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function followCreator')
    expect(content).toContain('export async function unfollowCreator')
    expect(content).toContain('export async function favoriteEntity')
    expect(content).toContain('export async function unfavoriteEntity')
    expect(content).toContain('export async function postComment')
    expect(content).toContain('export async function tipCreator')
  })

  it('preserves deprecated wrappers/aliases: followUser, likeAsset, unlikeAsset', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('followUser')
    expect(content).toContain('likeAsset')
    expect(content).toContain('unlikeAsset')
  })

  it('exports listing functions: listFollowers, listFollowing, listComments', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listFollowers')
    expect(content).toContain('export async function listFollowing')
    expect(content).toContain('export async function listComments')
  })

  it('exports stats: getSocialStats, getEntityFavoriteCount (with getAssetLikeCount alias)', () => {
    const path = join(ZONGA_ACTIONS, 'social-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getSocialStats')
    expect(content).toContain('export async function getEntityFavoriteCount')
    // Alias may be a const re-export or a delegating async function ('use server'
    // files may only export async functions) — either way it counts 'asset' favorites.
    expect(content).toMatch(
      /export const getAssetLikeCount|export async function getAssetLikeCount[\s\S]*?favoriteCount\(context, assetId, 'asset'\)/,
    )
  })

  it('tipCreator is honestly unavailable (501) and records no revenue without a verified payment', () => {
    // Previously tipCreator INSERTed a RevenueType.TIP row into zonga_revenue_events
    // with no payment ever taken — fabricated creator revenue. That theatre was
    // removed: until a verified payment source exists, tipping validates input
    // and throws ZongaUnavailableError (HTTP 501), writing nothing.
    const content = readFileSync(join(ZONGA_ACTIONS, 'social-actions.ts'), 'utf-8')
    expect(exportedFunctions(content).get('tipCreator')).toMatch(
      /resolveOrgContext\('personal', \(context\) => tip\(context, data\)\)/,
    )
    const svc = SERVICE('listener-social')
    const tipBody = svc.split('export async function tip(')[1]?.split('\nexport ')[0] ?? ''
    expect(tipBody).toContain('throw new ZongaUnavailableError()')
    expect(tipBody).not.toMatch(/context\.db|INSERT/)
    expect(svc).not.toContain('zonga_revenue_events')
    expect(svc).not.toContain('RevenueType.TIP')
    expect(content).not.toContain('zonga_revenue_events')
    const resolver = RESOLVE_ORG()
    expect(resolver).toMatch(/class ZongaUnavailableError[\s\S]*?readonly status = 501/)
    expect(resolver).toContain("'VERIFIED_TIP_PAYMENT_SOURCE_UNAVAILABLE'")
  })

  it('uses domain tables plus audit_log for comments', () => {
    const content = readFileSync(join(ZONGA_ACTIONS, 'social-actions.ts'), 'utf-8')
    const fns = exportedFunctions(content)
    expect(fns.get('postComment')).toContain('comment(context, data)')
    expect(fns.get('listComments')).toContain('comments(context, assetId)')
    const svc = SERVICE('listener-social')
    // Follows/favorites go to domain tables (no audit_log for these). Tips record
    // nothing until a verified payment source exists (see test above).
    expect(svc).toContain('zonga_listener_follows')
    expect(svc).toContain('zonga_listener_favorites')
    const followBody = svc.split('export async function follow(')[1]?.split('\nexport ')[0] ?? ''
    expect(followBody).not.toContain('audit_log')
    // Comments still use audit_log (append-only pattern)
    expect(svc).toContain(
      "INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('social.commented'",
    )
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

  it('uses zonga_notifications domain table for reads and writes', () => {
    const path = join(ZONGA_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    const fns = exportedFunctions(content)
    expect(content).toContain('zonga_notifications')
    // Reads/updates are bound to the authenticated recipient.
    expect(content).toContain('UPDATE public.zonga_notifications')
    for (const name of ['listNotifications', 'getUnreadCount', 'markAsRead', 'markAllRead'])
      expect(fns.get(name), name).toContain('recipient_user_id=${context.actorId}')
    // The only insert path is the verified moderation-resolution service.
    expect(fns.get('createNotification')).toContain(
      'notifyModerationResolution(context, data.caseId, data)',
    )
    expect(content).not.toContain('INSERT INTO')
    const svc = SERVICE('moderation-notifications')
    expect(svc).toContain('INSERT INTO public.zonga_notifications')
    expect(svc).toContain('appendZongaAudit(context')
  })

  it('markAsRead and markAllRead call revalidatePath', () => {
    const path = join(ZONGA_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    const fns = exportedFunctions(content)
    expect(content).toContain("import { revalidatePath } from 'next/cache'")
    expect(fns.get('markAsRead')).toContain("revalidatePath('/dashboard/notifications')")
    expect(fns.get('markAllRead')).toContain("revalidatePath('/dashboard/notifications')")
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

  it('globalSearch queries domain tables for multiple entity types', () => {
    const path = join(ZONGA_ACTIONS, 'search-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain("from '@/lib/services/published-catalog'")
    expect(exportedFunctions(content).get('globalSearch')).toContain(
      "resolveOrgContext('published', (context) => search(context, query))",
    )
    const svc = SERVICE('published-catalog')
    const searchBody = svc.split('export async function search(')[1]?.split('\nexport ')[0] ?? ''
    expect(searchBody).toContain('FROM public.zonga_content_assets')
    expect(searchBody).toContain('FROM public.zonga_creators')
    expect(searchBody).toContain('FROM public.zonga_events')
    expect(searchBody).toContain('FROM public.zonga_playlists')
  })

  it('exports SearchResult and SearchResults types', () => {
    const path = join(ZONGA_ACTIONS, 'search-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain(
      "export type { SearchResults, SearchResult } from '@/lib/services/published-catalog'",
    )
    const svc = SERVICE('published-catalog')
    expect(svc).toContain('export interface SearchResult')
    expect(svc).toContain('export interface SearchResults')
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

  it('writes to zonga_playlists/zonga_playlist_items with audit trail for creation', () => {
    const path = join(ZONGA_ACTIONS, 'playlist-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('zonga_playlists')
    expect(content).toContain('zonga_playlist_items')
    expect(content).toContain("'playlist.created'")
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

  it('purchaseTicket writes to zonga_ticket_purchases with audit trail', () => {
    const path = join(ZONGA_ACTIONS, 'event-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('zonga_ticket_purchases')
    expect(content).toContain("'event.ticket.purchased'")
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

  it('publishRelease transitions status via transitionReleaseStatus', () => {
    const path = join(ZONGA_ACTIONS, 'release-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function publishRelease')
    // Uses release.status_changed audit action for all transitions
    expect(content).toContain("'release.status_changed'")
  })
})
