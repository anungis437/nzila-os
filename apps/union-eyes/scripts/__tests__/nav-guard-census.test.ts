/**
 * The navigation-guard census (UE-CONV-H-030): a destination the sidebar offers a role, and the landing page it sends a role to, are pages that role may open.
 *
 * Found by it: a steward-guarded workbench offered, and landed on, by the two staff roles below steward (the dashboard root and the workbench then redirected each other for ever), and
 * a security destination offered to three roles the page refuses.
 */
import { describe, expect, it } from 'vitest'
import { redirectingGuards } from '../lib/nav-census/page-guards'
import { applicationNavigation, countByKind, runCensus, type NavOracle } from '../runtime/nav-guard-census'

describe('the guards a page redirects a caller for', () => {
  it('reads a guard decided inline and through a variable', () => {
    expect(redirectingGuards(`export default async function P() { if (!(await hasMinRole('steward'))) redirect('/dashboard'); return null }`)).toEqual(['steward'])
    expect(redirectingGuards(`export default async function P() { const hasAccess = await hasMinRole("admin"); if (!hasAccess) { redirect('/dashboard') } return null }`)).toEqual(['admin'])
    expect(redirectingGuards(`export default async function P() { if (!ok || !(await hasMinRole('officer'))) return notFound(); return null }`)).toEqual(['officer'])
  })

  it('does not read a role check that only decides what the page shows', () => {
    const page = `export default async function P() {
      if (!(await hasMinRole('steward'))) redirect('/dashboard')
      const canSign = await hasMinRole('officer')
      return <Dashboard canSign={canSign} canSeeFinance={await hasMinRole('secretary_treasurer')} />
    }`
    expect(redirectingGuards(page)).toEqual(['steward'])
  })

  it('does not read a denial that redirects nowhere, or a grant', () => {
    expect(redirectingGuards(`export default async function P() { if (!(await hasMinRole('steward'))) { log() } return null }`)).toEqual([])
    expect(redirectingGuards(`export default async function P() { if (await hasMinRole('steward')) redirect('/dashboard/workbench'); return null }`)).toEqual([])
  })

  it('reads a call that refuses by itself', () => {
    expect(redirectingGuards(`export default async function P() { await requireMinRole('admin'); return null }`)).toEqual(['admin'])
  })
})

describe('the navigation against the guards of the pages it offers', () => {
  const report = runCensus()

  it('reads the whole application: every assignable role, and the guards of the pages it is offered', () => {
    expect(report.roles).toBeGreaterThan(30)
    expect(report.offered).toBeGreaterThan(150)
    expect(report.guardedPages).toBeGreaterThan(15)
  })

  it('offers no destination, and lands no role, on a page that redirects it', () => {
    expect(report.findings.map((finding) => `${finding.kind} ${finding.role} ${finding.href} ${finding.guardedBy}`)).toEqual([])
    expect(countByKind(report.findings)).toEqual({ NAV_PAGE_REFUSES_ROLE: 0, LANDING_REFUSES_ROLE: 0, NAV_PAGE_MISSING: 0 })
  })

  it('can fail: a workbench offered to a role below steward, and landed on, is found', () => {
    const careless: NavOracle = {
      ...applicationNavigation,
      roles: ['health_safety_rep', 'steward'],
      visible: (_experience, _role) => [{ href: '/dashboard/inbox' }, { href: '/dashboard/workbench' }],
      landing: () => '/dashboard/workbench',
    }
    const found = runCensus(undefined, careless).findings
    expect(found.map((finding) => `${finding.kind} ${finding.role} ${finding.href}`).sort()).toEqual([
      'LANDING_REFUSES_ROLE health_safety_rep /dashboard/workbench',
      'NAV_PAGE_REFUSES_ROLE health_safety_rep /dashboard/workbench',
    ])
    expect(found[0].guardedBy).toContain('workbench/page.tsx requires steward')
  })

  it('can fail: a destination with no page is found', () => {
    const dangling: NavOracle = { ...applicationNavigation, roles: ['steward'], visible: () => [{ href: '/dashboard/does-not-exist' }], landing: () => '/dashboard' }
    expect(runCensus(undefined, dangling).findings.map((finding) => finding.kind)).toEqual(['NAV_PAGE_MISSING'])
  })

  it('takes the layouts above a page into account', () => {
    const finance: NavOracle = { ...applicationNavigation, roles: ['steward'], visible: () => [{ href: '/dashboard/finance' }], landing: () => '/dashboard' }
    const [finding] = runCensus(undefined, finance).findings
    expect(finding.guardedBy).toContain('finance/layout.tsx requires secretary_treasurer')
  })
})
