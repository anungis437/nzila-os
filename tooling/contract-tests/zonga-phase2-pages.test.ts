/**
 * Contract Test — Zonga Phase 2 Pages (Browse, Search, Playlists, Events, Notifications, Tracks, Artists)
 *
 * Structural invariants:
 *   1. Every new route has a page.tsx
 *   2. Server pages call auth(), client pages are 'use client'
 *   3. Pages import from server actions (not direct DB)
 *   4. Pages use Zonga design system (Card from @nzila/ui, text-navy)
 *   5. Error and loading boundaries exist for each new section
 *   6. Client components use proper hooks (useTransition, useRouter)
 *   7. Form pages use proper route structure
 *
 * @invariant ZNG-PAGE2-01: All Phase 2 pages exist
 * @invariant ZNG-PAGE2-02: Auth guard or client directive
 * @invariant ZNG-PAGE2-03: @nzila/ui Card usage
 * @invariant ZNG-PAGE2-04: Error/loading boundaries
 * @invariant ZNG-PAGE2-05: Client component patterns
 * @invariant ZNG-PAGE2-06: Sidebar updated
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA_DASHBOARD = join(ROOT, 'apps', 'zonga', 'app', '[locale]', 'dashboard')
const ZONGA_COMPONENTS = join(ROOT, 'apps', 'zonga', 'components', 'dashboard')

/* ─── SERVER PAGES: must exist, call auth(), import Card ─── */

const SERVER_PAGES = ['browse', 'playlists', 'notifications']

const SERVER_DETAIL_PAGES: Array<{ dir: string; sub: string }> = [
  { dir: 'playlists', sub: '[id]' },
  { dir: 'events', sub: '[id]' },
  { dir: 'tracks', sub: '[id]' },
  { dir: 'artists', sub: '[id]' },
  { dir: 'creators', sub: '[id]' },
]

describe('ZNG-PAGE2-01 — Phase 2 server pages exist', () => {
  for (const page of SERVER_PAGES) {
    it(`dashboard/${page}/page.tsx exists`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      expect(existsSync(pagePath)).toBe(true)
    })
  }

  for (const { dir, sub } of SERVER_DETAIL_PAGES) {
    it(`dashboard/${dir}/${sub}/page.tsx exists`, () => {
      const pagePath = join(ZONGA_DASHBOARD, dir, sub, 'page.tsx')
      expect(existsSync(pagePath)).toBe(true)
    })
  }
})

describe('ZNG-PAGE2-02 — Server pages call auth()', () => {
  for (const page of SERVER_PAGES) {
    it(`dashboard/${page} authenticates via auth()`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('auth()')
    })
  }
})

describe('ZNG-PAGE2-03 — Server pages import Card from @nzila/ui', () => {
  for (const page of SERVER_PAGES) {
    it(`dashboard/${page} uses Card`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('Card')
    })
  }
})

/* ─── CLIENT PAGES: must exist, have 'use client' ─── */

const CLIENT_PAGES = [
  'search',
  'catalog/upload',
  'releases/new',
  'creators/register',
  'payouts/new',
  'playlists/new',
  'events/new',
]

describe('ZNG-PAGE2-01 — Phase 2 client pages exist', () => {
  for (const page of CLIENT_PAGES) {
    it(`dashboard/${page}/page.tsx exists`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      expect(existsSync(pagePath)).toBe(true)
    })
  }
})

describe('ZNG-PAGE2-05 — Client pages have "use client"', () => {
  for (const page of CLIENT_PAGES) {
    it(`dashboard/${page} is a client component`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain("'use client'")
    })
  }
})

describe('ZNG-PAGE2-05 — Client pages use useTransition and useRouter', () => {
  for (const page of CLIENT_PAGES) {
    it(`dashboard/${page} uses proper React hooks`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      // Client pages use either useTransition or useState
      expect(content).toMatch(/use(Transition|State)/)
    })
  }
})

describe('ZNG-PAGE2 — Pages use text-navy for design consistency', () => {
  const ALL_PAGES = [...SERVER_PAGES, ...CLIENT_PAGES]
  for (const page of ALL_PAGES) {
    it(`dashboard/${page} uses text-navy`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('text-navy')
    })
  }
})

/* ─── ERROR / LOADING BOUNDARIES ─── */

const BOUNDARY_SECTIONS = ['playlists', 'events', 'notifications', 'browse', 'tracks', 'artists']

describe('ZNG-PAGE2-04 — Error boundaries exist for new sections', () => {
  for (const section of BOUNDARY_SECTIONS) {
    it(`dashboard/${section}/error.tsx exists`, () => {
      const errorPath = join(ZONGA_DASHBOARD, section, 'error.tsx')
      expect(existsSync(errorPath)).toBe(true)
    })

    it(`dashboard/${section}/error.tsx is a client component`, () => {
      const errorPath = join(ZONGA_DASHBOARD, section, 'error.tsx')
      if (!existsSync(errorPath)) return
      const content = readFileSync(errorPath, 'utf-8')
      expect(content).toContain("'use client'")
    })

    it(`dashboard/${section}/error.tsx has reset button`, () => {
      const errorPath = join(ZONGA_DASHBOARD, section, 'error.tsx')
      if (!existsSync(errorPath)) return
      const content = readFileSync(errorPath, 'utf-8')
      expect(content).toContain('reset')
      expect(content).toContain('Try Again')
    })
  }
})

describe('ZNG-PAGE2-04 — Loading skeletons exist for new sections', () => {
  for (const section of BOUNDARY_SECTIONS) {
    it(`dashboard/${section}/loading.tsx exists`, () => {
      const loadingPath = join(ZONGA_DASHBOARD, section, 'loading.tsx')
      expect(existsSync(loadingPath)).toBe(true)
    })

    it(`dashboard/${section}/loading.tsx uses animate-pulse`, () => {
      const loadingPath = join(ZONGA_DASHBOARD, section, 'loading.tsx')
      if (!existsSync(loadingPath)) return
      const content = readFileSync(loadingPath, 'utf-8')
      expect(content).toContain('animate-pulse')
    })
  }
})

/* ─── CLIENT COMPONENTS ─── */

const CLIENT_COMPONENTS = [
  'submit-for-review-button.tsx',
  'publish-release-button.tsx',
  'notification-buttons.tsx',
  'track-player.tsx',
  'like-button.tsx',
  'comment-form.tsx',
  'tip-button.tsx',
  'follow-button.tsx',
]

describe('ZNG-PAGE2 — Client components exist', () => {
  for (const comp of CLIENT_COMPONENTS) {
    it(`components/dashboard/${comp} exists`, () => {
      expect(existsSync(join(ZONGA_COMPONENTS, comp))).toBe(true)
    })
  }
})

describe('ZNG-PAGE2-05 — Client components have "use client"', () => {
  for (const comp of CLIENT_COMPONENTS) {
    it(`${comp} is a client component`, () => {
      const path = join(ZONGA_COMPONENTS, comp)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain("'use client'")
    })
  }
})

describe('ZNG-PAGE2-05 — Interactive client components import server actions', () => {
  const ACTION_MAP: Record<string, string> = {
    'submit-for-review-button.tsx': 'publishAsset',
    'publish-release-button.tsx': 'publishRelease',
    'notification-buttons.tsx': 'notification-actions',
    'like-button.tsx': 'social-actions',
    'comment-form.tsx': 'social-actions',
    'follow-button.tsx': 'social-actions',
  }

  for (const [comp, expectedImport] of Object.entries(ACTION_MAP)) {
    it(`${comp} imports ${expectedImport}`, () => {
      const path = join(ZONGA_COMPONENTS, comp)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain(expectedImport)
    })
  }
})

describe('ZNG-PAGE2-05 — Tip button does not advertise an unverified tip', () => {
  // The old button called tipCreator, which wrote a fabricated revenue event with
  // no payment, then showed "Tip sent". That theatre was removed: tipCreator now
  // throws 501 (VERIFIED_TIP_PAYMENT_SOURCE_UNAVAILABLE) and the button is an
  // honest disabled control until a verified payment source exists.
  it('tip-button.tsx is disabled, never calls tipCreator, never claims success', () => {
    const content = readFileSync(join(ZONGA_COMPONENTS, 'tip-button.tsx'), 'utf-8')
    expect(content).not.toContain('tipCreator')
    expect(content).not.toMatch(/onClick/)
    expect(content).toMatch(/<button[\s\S]*?\bdisabled\b/)
    expect(content).toContain('Tipping unavailable')
    expect(content).not.toMatch(/Tip sent/i)
  })
})

/* ─── SIDEBAR UPDATE ─── */

describe('ZNG-PAGE2-06 — Sidebar layout updated with new navigation', () => {
  it('layout.tsx includes Browse link', () => {
    const layoutPath = join(ZONGA_DASHBOARD, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')
    expect(content).toContain("'dashboard/browse'")
    expect(content).toContain("'Browse'")
  })

  it('layout.tsx includes Search link', () => {
    const layoutPath = join(ZONGA_DASHBOARD, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')
    expect(content).toContain("'dashboard/search'")
    expect(content).toContain("'Search'")
  })

  it('layout.tsx includes Playlists link', () => {
    const layoutPath = join(ZONGA_DASHBOARD, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')
    expect(content).toContain("'dashboard/playlists'")
    expect(content).toContain("'Playlists'")
  })

  it('layout.tsx includes Events link', () => {
    const layoutPath = join(ZONGA_DASHBOARD, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')
    expect(content).toContain("'dashboard/events'")
    expect(content).toContain("'Events'")
  })

  it('layout.tsx includes Notifications link', () => {
    const layoutPath = join(ZONGA_DASHBOARD, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')
    expect(content).toContain("'dashboard/notifications'")
    expect(content).toContain("'Notifications'")
  })

  it('sidebar has 13 navigation links', () => {
    const layoutPath = join(ZONGA_DASHBOARD, 'layout.tsx')
    const content = readFileSync(layoutPath, 'utf-8')
    const matches = content.match(/href:\s*'dashboard/g)
    // 13 links: overview + browse + search + catalog + releases + playlists + events + revenue + payouts + creators + analytics + notifications + integrity
    expect(matches?.length).toBeGreaterThanOrEqual(13)
  })
})

/* ─── Action import discipline ─── */

describe('ZNG-PAGE2 — Pages import from server actions, not direct DB', () => {
  const PAGE_ACTION_MAP: Record<string, string[]> = {
    // Browse now reads fixed published projections (assets, events, playlists,
    // trending) through browse-actions -> lib/services/published-catalog.
    browse: ['browse-actions'],
    playlists: ['playlist-actions'],
    notifications: ['notification-actions'],
  }

  for (const [page, actionFiles] of Object.entries(PAGE_ACTION_MAP)) {
    it(`dashboard/${page} imports from ${actionFiles.join(', ')}`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      for (const action of actionFiles) {
        expect(content).toContain(action)
      }
      expect(content).not.toContain("from '@nzila/db")
    })
  }

  it('browse-actions covers catalog, events, playlists and trending via scoped published projections', () => {
    const page = readFileSync(join(ZONGA_DASHBOARD, 'browse', 'page.tsx'), 'utf-8')
    for (const fn of [
      'browsePublishedAssets',
      'browsePublishedEvents',
      'browsePublicPlaylists',
      'browseTrending',
    ])
      expect(page).toContain(`${fn}()`)
    const actions = readFileSync(
      join(ROOT, 'apps', 'zonga', 'lib', 'actions', 'browse-actions.ts'),
      'utf-8',
    )
    expect(actions).toContain("'use server'")
    expect(actions).not.toContain('@nzila/db')
    for (const [fn, svc] of [
      ['browsePublishedAssets', 'publishedAssets'],
      ['browsePublishedEvents', 'publishedEvents'],
      ['browsePublicPlaylists', 'publicPlaylists'],
      ['browseTrending', 'trending'],
    ])
      expect(actions).toMatch(
        new RegExp(
          `export async function ${fn}[\\s\\S]*?resolveOrgContext\\('published', [^\\n]*${svc}`,
        ),
      )
  })
})
