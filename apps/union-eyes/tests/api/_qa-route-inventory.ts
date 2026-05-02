import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type RouteEntry = {
  filePath: string
  methods: string[]
  minRoles: string[]
  hasAuthWrapper: boolean
  hasOrgScoped: boolean
  hasDecisionEvidenceHook: boolean
  hasNarEvidenceHook: boolean
  source: string
}

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const API_DIR = path.join(APP_ROOT, 'app', 'api')

const CRITICAL_ROUTE_PATTERNS = [
  '/api/cases/[caseId]/transition/route.ts',
  '/api/claims/[id]/workflow/route.ts',
  '/api/claims/[id]/status/route.ts',
  '/api/admin/update-role/route.ts',
  '/api/organizations/switch/route.ts',
  '/api/analytics/executive/route.ts',
  '/api/analytics/dashboard/route.ts',
  '/api/cognition/route.ts',
] as const

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) out.push(...walk(full))
    else if (item.isFile() && item.name === 'route.ts') out.push(full)
  }
  return out
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function parseRoleList(raw: string): string[] {
  if (!raw) return []
  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((v) => v.replace(/[\[\]'"\s]/g, ''))
      .filter(Boolean)
  }
  return [raw.replace(/[\[\]'"\s]/g, '')].filter(Boolean)
}

export function collectRouteInventory(): RouteEntry[] {
  const routeFiles = walk(API_DIR)
  return routeFiles.map((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    const methods = uniq([...source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g)].map((m) => m[1]))
    const minRoles = uniq([
      ...source.matchAll(/minRole\s*:\s*['\"]([^'\"]+)['\"]/g),
      ...source.matchAll(/hasMinRole\(\s*['\"]([^'\"]+)['\"]/g),
      ...source.matchAll(/roles\s*:\s*\[([^\]]+)\]/g),
      ...source.matchAll(/readRole\s*:\s*['\"]([^'\"]+)['\"]/g),
      ...source.matchAll(/writeRole\s*:\s*['\"]([^'\"]+)['\"]/g),
    ]
      .map((m) => m[1])
      .flatMap((value) => parseRoleList(value)))

    const hasAuthWrapper =
      source.includes('withApi(') ||
      source.includes('withApiAuth(') ||
      source.includes('withOrganizationAuth(') ||
      source.includes('requireApiAuth(') ||
      source.includes('hasMinRole(') ||
      source.includes('crudRoutes(') ||
      source.includes('await auth()')

    const hasOrgScoped =
      source.includes('orgScoped: true') ||
      source.includes('requireOrg: true') ||
      (source.includes('withApi(') && !source.includes('required: false'))

    const hasDecisionEvidenceHook =
      /@nzila\/decision-core|enforceDecision|DecisionRecord|recordDecision/i.test(source)

    const hasNarEvidenceHook =
      /@nzila\/nar|nar|verify-?nar|appendNar|record.*nar/i.test(source)

    return {
      filePath,
      methods,
      minRoles,
      hasAuthWrapper,
      hasOrgScoped,
      hasDecisionEvidenceHook,
      hasNarEvidenceHook,
      source,
    }
  })
}

export function isMutationRoute(entry: RouteEntry): boolean {
  return entry.methods.some((method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
}

export function rel(filePath: string): string {
  return path.relative(APP_ROOT, filePath).replace(/\\/g, '/')
}

export function isCriticalQaRoute(filePath: string): boolean {
  const routePath = `/${rel(filePath)}`
  return CRITICAL_ROUTE_PATTERNS.some((pattern) => routePath.endsWith(pattern))
}

export function collectCriticalRouteInventory(): RouteEntry[] {
  return collectRouteInventory().filter((entry) => isCriticalQaRoute(entry.filePath))
}
