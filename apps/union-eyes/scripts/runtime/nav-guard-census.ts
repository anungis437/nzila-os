/**
 * The navigation-guard census (UE-CONV-H-030): a destination the sidebar offers a role, and the landing page it sends a role to, are pages that role may open.
 *
 * The sidebar is built per role (lib/dashboard/role-experience.ts) and every non-member is sent from the dashboard root to its landing, so a destination whose page or layout
 * redirects the role it was offered to is a link that goes nowhere, and a landing that redirects its own role to the root is a loop that never ends. The roles a page refuses are read from
 * the guards in the page and in every layout above it (see lib/nav-census/page-guards.ts for which guards count), compared at the levels lib/auth/roles.ts gives the roles.
 * A finding is fixed in DESTINATION_MIN_ROLE (or the executive and platform tables) in lib/dashboard/role-experience.ts, so the menu and the guard say the same thing. Read-only: it reads source files and
 * needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/nav-guard-census.ts [--write=<json>] [--strict] [--quiet]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getDashboardExperience, getRoleLandingPath, getVisibleNavigationForExperience, type DashboardExperience } from '../../lib/dashboard/role-experience'
import { UserRole, getRoleLevel } from '../../lib/auth/roles'
import { redirectingGuards } from '../lib/nav-census/page-guards'
import { APP_ROOT } from './frontend-api-census'

export type NavGuardKind = 'NAV_PAGE_REFUSES_ROLE' | 'LANDING_REFUSES_ROLE' | 'NAV_PAGE_MISSING'

export interface NavGuardFinding {
  kind: NavGuardKind
  role: string
  /** The destination offered to the role, or the landing it is sent to. */
  href: string
  /** The page or layout whose guard refuses the role, and the role it asks for. */
  guardedBy: string
  roleLevel: number
  guardLevel: number
}

export interface NavGuardReport {
  roles: number
  /** (role, destination) pairs the menus offer, landings included. */
  offered: number
  /** Pages whose own or layout guards were read. */
  guardedPages: number
  findings: NavGuardFinding[]
}

/** What the census asks of the application's own navigation: swapped for a fake in the test that proves the census can fail. */
export interface NavOracle {
  roles: string[]
  levelOf(role: string): number
  experienceOf(role: string): DashboardExperience
  visible(experience: DashboardExperience, role: string): Array<{ href: string }>
  landing(role: string): string
}

export const applicationNavigation: NavOracle = {
  // A guest is not signed in to a dashboard: the dashboard layout sends it to the login before any destination is offered.
  roles: (Object.values(UserRole) as string[]).filter((role) => role !== UserRole.GUEST),
  levelOf: (role) => getRoleLevel(role as UserRole),
  experienceOf: (role) => getDashboardExperience(role),
  visible: (experience, role) => getVisibleNavigationForExperience(experience, false, role),
  landing: (role) => getRoleLandingPath(role),
}

const DASHBOARD = path.join('app', '[locale]', 'dashboard')

/** The page file behind a /dashboard href. */
export function pageFileOf(root: string, href: string): string | null {
  const relative = href.split('?')[0].replace(/^\/dashboard\/?/, '')
  const file = path.join(root, DASHBOARD, relative, 'page.tsx')
  return existsSync(file) ? file : null
}

/** Every file whose guard stands between a caller and the page: the page, and the layout of each directory from the page's up to the dashboard's. */
function guardingFiles(root: string, pageFile: string): string[] {
  const dashboard = path.join(root, DASHBOARD)
  const files = [pageFile]
  let directory = path.dirname(pageFile)
  while (directory.length >= dashboard.length) {
    const layout = path.join(directory, 'layout.tsx')
    if (existsSync(layout)) files.push(layout)
    if (directory === dashboard) break
    directory = path.dirname(directory)
  }
  return files
}

export function runCensus(root: string = APP_ROOT, navigation: NavOracle = applicationNavigation): NavGuardReport {
  const guardCache = new Map<string, string[]>()
  const guardsOf = (file: string): string[] => {
    if (!guardCache.has(file)) guardCache.set(file, redirectingGuards(readFileSync(file, 'utf8'), file))
    return guardCache.get(file)!
  }
  const strictest = (pageFile: string): { role: string; level: number; file: string } | null => {
    let best: { role: string; level: number; file: string } | null = null
    for (const file of guardingFiles(root, pageFile)) {
      for (const role of guardsOf(file)) {
        const level = getRoleLevel(role as UserRole)
        if (!best || level > best.level) best = { role, level, file }
      }
    }
    return best
  }

  const findings: NavGuardFinding[] = []
  const guarded = new Set<string>()
  let offered = 0
  const check = (kind: NavGuardKind, role: string, href: string): void => {
    offered += 1
    if (href.split('?')[0] === '/dashboard') return
    const page = pageFileOf(root, href)
    if (!page) {
      findings.push({ kind: 'NAV_PAGE_MISSING', role, href, guardedBy: '', roleLevel: navigation.levelOf(role), guardLevel: 0 })
      return
    }
    guarded.add(page)
    const guard = strictest(page)
    const level = navigation.levelOf(role)
    if (guard && guard.level > level) {
      findings.push({ kind, role, href, guardedBy: `${path.relative(root, guard.file).replace(/\\/g, '/')} requires ${guard.role}`, roleLevel: level, guardLevel: guard.level })
    }
  }

  for (const role of navigation.roles) {
    const experience = navigation.experienceOf(role)
    for (const item of navigation.visible(experience, role)) check('NAV_PAGE_REFUSES_ROLE', role, item.href)
    check('LANDING_REFUSES_ROLE', role, navigation.landing(role))
  }
  findings.sort((a, b) => a.kind.localeCompare(b.kind) || a.href.localeCompare(b.href) || a.role.localeCompare(b.role))
  return { roles: navigation.roles.length, offered, guardedPages: guarded.size, findings }
}

export function countByKind(findings: NavGuardFinding[]): Record<NavGuardKind, number> {
  const counts: Record<NavGuardKind, number> = { NAV_PAGE_REFUSES_ROLE: 0, LANDING_REFUSES_ROLE: 0, NAV_PAGE_MISSING: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}

function main(): void {
  const args = process.argv.slice(2)
  const report = runCensus()
  const write = args.find((arg) => arg.startsWith('--write='))?.slice('--write='.length)
  if (write) writeFileSync(write, JSON.stringify(report, null, 2))
  if (!args.includes('--quiet')) {
    console.log(`${report.roles} roles; ${report.offered} destinations offered (landings included), ${report.guardedPages} pages with their layouts' guards read; ${report.findings.length} findings`)
    for (const [kind, count] of Object.entries(countByKind(report.findings))) console.log(`  ${kind.padEnd(24)} ${String(count).padStart(4)}`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(22)} ${finding.role}(${finding.roleLevel})  ${finding.href}  ${finding.guardedBy}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
