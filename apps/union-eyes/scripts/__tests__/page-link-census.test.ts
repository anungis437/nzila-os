/**
 * The page-link census (UE-CONV-H-020): where the frontend sends the user is a page that exists.
 *
 * Two parts. The first pins how a link is read out of source and how a path is judged against the pages (lib/frontend-census/page-links.ts). The second runs the
 * census over the real tree and holds the count of paths no page serves at or below a ceiling that can only fall: a link to such a path is a button that ends
 * in a 404, and nothing but a person clicking it can tell. Closing findings means lowering the ceiling; a new dead link fails here.
 */
import { describe, expect, it } from 'vitest'
import { DYNAMIC } from '../lib/frontend-census/client-calls'
import { extractPageLinks, judgeLink, LOCALE, pageRouteOf, pageRoutesOf } from '../lib/frontend-census/page-links'
import { runCensus } from '../runtime/page-link-census'

const links = (source: string) => extractPageLinks('x.tsx', source).map(({ path, via }) => ({ path, via }))

describe('reading the links out of source', () => {
  it('reads a JSX href or to, a string or an expression, and every path a condition can give', () => {
    expect(links(`const a = <Link href="/dashboard/members">x</Link>; const b = <Link to={'/dashboard/cases'} />; const c = <a href={ok ? '/dashboard/a' : '/dashboard/b'} />`)).toEqual([
      { path: '/dashboard/members', via: 'jsx' },
      { path: '/dashboard/cases', via: 'jsx' },
      { path: '/dashboard/a', via: 'jsx' },
      { path: '/dashboard/b', via: 'jsx' },
    ])
  })

  it('marks what a template or a concatenation leaves unknown, and the locale apart from it', () => {
    expect(links('const a = <Link href={`/${locale}/dashboard/cases/${id}`} />; const b = router.push("/dashboard/cases/" + id); const c = <a href={`/${params.locale}/x`} />')).toEqual([
      { path: `/${LOCALE}/dashboard/cases/${DYNAMIC}`, via: 'jsx' },
      { path: `/dashboard/cases/${DYNAMIC}`, via: 'router.push' },
      { path: `/${LOCALE}/x`, via: 'jsx' },
    ])
  })

  it('reads redirects, router calls, location assignments and the properties a navigation entry is written with', () => {
    expect(links(`redirect('/a'); permanentRedirect('/b'); router.replace('/c'); navigation.push('/d'); window.location.href = '/e'; const items = [{ href: '/f', actionUrl: '/g' }]`)).toEqual([
      { path: '/a', via: 'redirect' },
      { path: '/b', via: 'permanentRedirect' },
      { path: '/c', via: 'router.replace' },
      { path: '/d', via: 'router.push' },
      { path: '/e', via: 'location.href' },
      { path: '/f', via: 'href' },
      { path: '/g', via: 'actionUrl' },
    ])
  })

  it('follows the helpers that put the locale in front of a path or add a query to it', () => {
    expect(links(`const a = <Link href={withLocale('/dashboard/x')} />; const b = <Link href={withInstitutionalContext('/dashboard/y', mode)} />`)).toEqual([
      { path: `/${LOCALE}/dashboard/x`, via: 'jsx' },
      { path: '/dashboard/y', via: 'jsx' },
    ])
  })

  it('does not read what is not an internal link', () => {
    expect(links(`const a = <a href="https://example.test/x" />; const b = <a href="#top" />; const c = <a href="mailto:a@b.test" />; const d = <a href="//cdn.test/x" />; items.push('/not-a-router'); const e = { path: '/name', op: 'replace' }; const f = <a href={href} />`)).toEqual([])
  })
})

describe('the pages a file name stands for', () => {
  it('drops route groups, reads the locale, and reads dynamic and catch-all segments', () => {
    expect(pageRouteOf('[locale]/dashboard/members/page.tsx')).toMatchObject({ localized: true, segments: [{ kind: 'literal', value: 'dashboard' }, { kind: 'literal', value: 'members' }] })
    expect(pageRouteOf('(marketing)/contact/page.tsx')).toMatchObject({ localized: false, segments: [{ kind: 'literal', value: 'contact' }] })
    expect(pageRouteOf('[locale]/(auth)/sign-in/[[...sign-in]]/page.tsx')).toMatchObject({ localized: true, segments: [{ kind: 'literal', value: 'sign-in' }, { kind: 'catchall', optional: true }] })
    expect(pageRouteOf('[locale]/dashboard/members/[id]/page.tsx')?.segments[2]).toEqual({ kind: 'param' })
  })

  it('counts a route handler outside the API, and not an API route, a parallel slot, a private folder or an intercepting route', () => {
    expect(pageRouteOf('auth/callback/route.ts')).toMatchObject({ segments: [{ kind: 'literal', value: 'auth' }, { kind: 'literal', value: 'callback' }] })
    for (const file of ['api/members/route.ts', '@modal/photo/page.tsx', '_components/x/page.tsx', '(.)photo/page.tsx', '[locale]/dashboard/layout.tsx']) expect(pageRouteOf(file), file).toBeNull()
  })

  it('does not count a catch-all with nothing literal before it: it matches every path', () => {
    expect(pageRoutesOf(['(marketing)/[...slug]/page.tsx', '[locale]/login/[[...login]]/page.tsx']).map((route) => route.file)).toEqual(['[locale]/login/[[...login]]/page.tsx'])
  })
})

describe('judging a path against the pages', () => {
  const pages = pageRoutesOf([
    '[locale]/page.tsx',
    '[locale]/dashboard/page.tsx',
    '[locale]/dashboard/members/page.tsx',
    '[locale]/dashboard/members/[id]/page.tsx',
    '[locale]/dashboard/finance/invoices/[id]/page.tsx',
    '(marketing)/contact/page.tsx',
    '(marketing)/[...slug]/page.tsx',
    '[locale]/(auth)/sign-in/[[...sign-in]]/page.tsx',
    'auth/callback/route.ts',
  ])
  const locales = ['en-CA', 'fr-CA']
  const judge = (path: string) => judgeLink(path, pages, locales)

  it('finds a page for a path with or without its locale, with a dynamic segment, a query or a fragment', () => {
    for (const path of ['/en-CA/dashboard/members', '/dashboard/members', `/${LOCALE}/dashboard/members/${DYNAMIC}`, '/dashboard/members/42?tab=a#top', '/dashboard/members/', '/', '/en-CA']) expect(judge(path), path).toBe('OK')
  })

  it('finds a root page only without a locale, and a route handler outside the API', () => {
    expect(judge('/contact')).toBe('OK')
    expect(judge('/en-CA/contact')).toBe('PAGE_MISSING')
    expect(judge('/auth/callback')).toBe('OK')
  })

  it('finds no page for a path that none serves, including the missing /dashboard prefix, and does not let a redirecting catch-all serve it', () => {
    for (const path of ['/dashboard/members/42/edit', '/finance/invoices/1', '/random/unknown', '/en-CA/dashboard/nowhere', `/${LOCALE}/dashboard/members/${DYNAMIC}/edit`]) expect(judge(path), path).toBe('PAGE_MISSING')
  })

  it('reads a partly computed segment, an optional catch-all and a wholly computed first segment', () => {
    expect(judge(`/${LOCALE}/sign-in${DYNAMIC}`)).toBe('OK')
    expect(judge('/en-CA/sign-in/factor-two')).toBe('OK')
    expect(judge(`/${DYNAMIC}/members`)).toBe('OK')
    // The optional catch-all of the sign-in page would take anything after a computed first segment; against a plainer set it is a path no page serves.
    expect(judgeLink(`/${DYNAMIC}/nowhere`, pageRoutesOf(['[locale]/dashboard/members/page.tsx']), locales)).toBe('PAGE_MISSING')
  })

  it('does not judge a path made only of unknown parts, or an endpoint, an asset or a file', () => {
    expect(judge(`/${DYNAMIC}`)).toBe('UNANALYZED')
    expect(judge(`/${LOCALE}${DYNAMIC}`)).toBe('UNANALYZED')
    for (const path of ['/api/members', '/_next/static/chunk.js', '/images/logo.png', '/robots.txt']) expect(judge(path), path).toBe('OK')
  })
})

// Paths in the frontend that no page serves: each is a link that ends in a 404. The ceiling can only fall; the end is zero.
const CEILING = 0

describe('the frontend against the pages that exist', () => {
  it('holds the paths no page serves at or below the ceiling', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(1000)
    expect(report.pages).toBeGreaterThan(300)
    expect(report.links).toBeGreaterThan(500)
    const over = report.findings.length > CEILING ? report.findings.map((finding) => `${finding.target}  ${finding.sites[0].file}:${finding.sites[0].line}`) : []
    expect(over).toEqual([])
  }, 120_000)
})
