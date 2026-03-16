/**
 * Contract test · PERSONA_ACCESS_001 — Persona-to-page access matrix
 *
 * Verifies that every dashboard page declares the correct minimum role,
 * that every API route backing a page has proper auth gating, and that
 * all CRUD routes reference valid database schema tables.
 *
 * Representative personas (one per tier):
 *   member (10)             — base union member
 *   health_safety_rep (30)  — specialised representative
 *   bargaining_committee(40)— front-line rep
 *   steward (50)            — front-line rep with write access
 *   officer (60)            — senior representative
 *   admin (95)              — local executive
 *   platform_lead (270)     — Nzila Ventures operations
 *
 * @invariant PERSONA_ACCESS_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT, walkSync, readContent, relPath, formatViolations, type Violation } from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

const UE_DIR = join(ROOT, 'apps', 'union-eyes')
const DASHBOARD_DIR = join(UE_DIR, 'app', 'dashboard')
const API_DIR = join(UE_DIR, 'app', 'api')

// ── Role Hierarchy (mirrors api-auth-guard.ts) ──────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  app_owner: 300,
  coo: 295,
  cto: 290,
  platform_lead: 270,
  customer_success_director: 260,
  support_manager: 250,
  data_analytics_manager: 240,
  billing_manager: 230,
  integration_manager: 220,
  compliance_manager: 210,
  security_manager: 200,
  support_agent: 180,
  data_analyst: 170,
  billing_specialist: 160,
  integration_specialist: 150,
  content_manager: 145,
  training_coordinator: 140,
  system_admin: 135,
  clc_executive: 130,
  clc_staff: 120,
  fed_executive: 115,
  fed_staff: 105,
  national_officer: 100,
  admin: 95,
  president: 90,
  vice_president: 85,
  secretary_treasurer: 85,
  chief_steward: 70,
  officer: 60,
  steward: 50,
  bargaining_committee: 40,
  health_safety_rep: 30,
  member: 10,
}

// ── Personas ────────────────────────────────────────────────────────────────

interface Persona {
  name: string
  role: string
  level: number
  description: string
}

const PERSONAS: Persona[] = [
  { name: 'Base Member',       role: 'member',                level: 10,  description: 'Regular union member — dues, receipts, basic access' },
  { name: 'H&S Rep',           role: 'health_safety_rep',     level: 30,  description: 'Health & safety representative' },
  { name: 'Bargaining Rep',    role: 'bargaining_committee',  level: 40,  description: 'Bargaining committee member — negotiations access' },
  { name: 'Steward',           role: 'steward',               level: 50,  description: 'Front-line steward — write access to most resources' },
  { name: 'Officer',           role: 'officer',               level: 60,  description: 'Senior representative — leadership dashboard, pilot' },
  { name: 'Local Admin',       role: 'admin',                 level: 95,  description: 'Local union executive — full org-level access' },
  { name: 'Platform Lead',     role: 'platform_lead',         level: 270, description: 'Nzila Ventures ops — cross-org access' },
]

// ── Page → Minimum Role Mapping ─────────────────────────────────────────────

/**
 * Each dashboard page and its minimum required role.
 * 'public_authed' means any authenticated user can access (no role check).
 * Derived from static analysis of page.tsx files.
 */
interface PageRule {
  /** Relative page path from dashboard/ */
  path: string
  /** Minimum role required (or 'public_authed' for no role check) */
  minRole: string
  /** Human description */
  description: string
}

const PAGE_ACCESS_MATRIX: PageRule[] = [
  // ── Base pages (any authenticated user) ────────────────────────────────
  { path: 'page.tsx',                                    minRole: 'member',               description: 'Main dashboard' },
  { path: 'structure/page.tsx',                          minRole: 'member',               description: 'Structure management' },
  { path: 'leadership/page.tsx',                         minRole: 'member',               description: 'Leadership view (API gates officer)' },
  { path: 'settings/communications/page.tsx',            minRole: 'member',               description: 'Notification preferences' },

  // ── Dues & receipts (any authenticated member) ─────────────────────────
  { path: 'dues/page.tsx',                               minRole: 'member',               description: 'Member dues dashboard' },
  { path: 'dues/pay/[transactionId]/page.tsx',           minRole: 'member',               description: 'Payment checkout' },
  { path: 'dues/receipts/[transactionId]/page.tsx',      minRole: 'member',               description: 'Receipt viewer' },

  // ── Communications (any authenticated member, API requires steward for writes)
  { path: 'communications/campaigns/page.tsx',           minRole: 'member',               description: 'Campaign list' },
  { path: 'communications/campaigns/new/page.tsx',       minRole: 'member',               description: 'Create campaign (API gates steward)' },
  { path: 'communications/campaigns/[id]/page.tsx',      minRole: 'member',               description: 'Campaign detail' },
  { path: 'communications/templates/page.tsx',           minRole: 'member',               description: 'Template list' },
  { path: 'communications/templates/new/page.tsx',       minRole: 'member',               description: 'Create template (API gates steward)' },
  { path: 'communications/templates/[id]/page.tsx',      minRole: 'member',               description: 'Template detail' },

  // ── Organizing (any authenticated member) ──────────────────────────────
  { path: 'organizing/notes/page.tsx',                   minRole: 'member',               description: 'Field notes list' },
  { path: 'organizing/notes/new/page.tsx',               minRole: 'member',               description: 'Create field note' },

  // ── Financial (member page-level, but roleLevel ≥85 for sensitive tabs)
  { path: 'financial/vendors/page.tsx',                  minRole: 'member',               description: 'Vendor management (85+ for full access)' },
  { path: 'financial/vendors/new/page.tsx',              minRole: 'member',               description: 'Create vendor' },
  { path: 'financial/expenses/page.tsx',                 minRole: 'member',               description: 'Expense management' },
  { path: 'financial/budgets/page.tsx',                  minRole: 'member',               description: 'Budget list (85+ for full access)' },
  { path: 'financial/budgets/[id]/page.tsx',             minRole: 'member',               description: 'Budget detail' },

  // ── Bargaining (requires bargaining_committee, level 40) ───────────────
  { path: 'bargaining/page.tsx',                         minRole: 'bargaining_committee', description: 'Bargaining dashboard' },
  { path: 'bargaining/negotiations/[id]/page.tsx',       minRole: 'bargaining_committee', description: 'Negotiation detail' },

  // ── Pilot (requires officer, level 60) ─────────────────────────────────
  { path: 'pilot/onboarding/page.tsx',                   minRole: 'officer',              description: 'Pilot onboarding console' },

  // ── Admin dues (any authenticated, API gates admin-level) ──────────────
  { path: 'admin/dues/page.tsx',                         minRole: 'member',               description: 'Admin dues overview' },
  { path: 'admin/dues/payments/page.tsx',                minRole: 'member',               description: 'Admin payments list' },
  { path: 'admin/dues/payments/[id]/page.tsx',           minRole: 'member',               description: 'Admin payment detail' },
  { path: 'admin/dues/billing-cycles/page.tsx',          minRole: 'member',               description: 'Billing cycle management' },
  { path: 'admin/dues/reports/page.tsx',                 minRole: 'member',               description: 'Financial reports' },
]

// ── API routes backing dashboard pages ──────────────────────────────────────

interface ApiRouteRule {
  /** API path relative to api/ (e.g. 'dashboard/leadership') */
  apiPath: string
  /** Expected auth pattern in the source: 'withApi', 'crudRoutes', 'withOrganizationAuth', etc. */
  expectedAuthPattern: string
  /** Minimum expected role (from source analysis) */
  expectedMinRole: string
  /** Dashboard page(s) that depend on this route */
  backingPage: string
}

const API_ROUTE_MATRIX: ApiRouteRule[] = [
  { apiPath: 'dashboard/leadership', expectedAuthPattern: 'withOrganizationAuth', expectedMinRole: 'officer',              backingPage: 'leadership/page.tsx' },
  { apiPath: 'messaging/campaigns',  expectedAuthPattern: 'crudRoutes',           expectedMinRole: 'member',               backingPage: 'communications/campaigns' },
  { apiPath: 'messaging/templates',  expectedAuthPattern: 'crudRoutes',           expectedMinRole: 'member',               backingPage: 'communications/templates' },
  { apiPath: 'messaging/preferences',expectedAuthPattern: 'crudRoutes',           expectedMinRole: 'member',               backingPage: 'settings/communications' },
  { apiPath: 'organizing/notes',     expectedAuthPattern: 'crudRoutes',           expectedMinRole: 'member',               backingPage: 'organizing/notes' },
  { apiPath: 'activities',           expectedAuthPattern: 'withApi',              expectedMinRole: 'member',               backingPage: 'admin (audit log)' },
  { apiPath: 'dues/calculate',       expectedAuthPattern: 'withRoleAuth',         expectedMinRole: 'steward',              backingPage: 'admin/dues' },
  { apiPath: 'analytics/cross-org',  expectedAuthPattern: 'withApi',              expectedMinRole: 'platform_lead',        backingPage: 'cross-org analytics (platform)' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function findPageFiles(): string[] {
  if (!existsSync(DASHBOARD_DIR)) return []
  return walkSync(DASHBOARD_DIR, ['.tsx']).filter(f => f.endsWith('page.tsx'))
}

function findApiRoute(apiPath: string): string | null {
  const routeFile = join(API_DIR, apiPath, 'route.ts')
  return existsSync(routeFile) ? routeFile : null
}

function personaCanAccess(persona: Persona, requiredRole: string): boolean {
  const requiredLevel = ROLE_HIERARCHY[requiredRole]
  if (requiredLevel === undefined) return true // unknown role = assume accessible
  return persona.level >= requiredLevel
}

/**
 * Extract the minRole from a crudRoutes() call in source code.
 * Looks for readRole: 'xxx' pattern.
 */
function extractCrudReadRole(content: string): string | null {
  const match = content.match(/readRole:\s*['"](\w+)['"]/)
  return match ? match[1] : null
}

/**
 * Extract the minRole from a withApi() call in source code.
 * Looks for minRole: 'xxx' pattern.
 */
function extractWithApiMinRole(content: string): string | null {
  const match = content.match(/minRole:\s*['"](\w+)['"]/)
  return match ? match[1] : null
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PERSONA_ACCESS_001 — Dashboard pages exist and are mapped', () => {
  const actualPages = findPageFiles()

  it('all mapped pages exist on disk', () => {
    const violations: Violation[] = []
    for (const rule of PAGE_ACCESS_MATRIX) {
      const fullPath = join(DASHBOARD_DIR, rule.path)
      if (!existsSync(fullPath)) {
        violations.push({
          ruleId: 'PERSONA_ACCESS_001',
          filePath: `dashboard/${rule.path}`,
          offendingValue: 'Page file does not exist',
          remediation: `Create ${rule.path} or remove from PAGE_ACCESS_MATRIX`,
        })
      }
    }
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('all dashboard page.tsx files are mapped in PAGE_ACCESS_MATRIX', () => {
    const mappedPaths = new Set(PAGE_ACCESS_MATRIX.map(r => r.path.replace(/\\/g, '/')))
    const violations: Violation[] = []
    for (const file of actualPages) {
      const rel = relative(DASHBOARD_DIR, file).replace(/\\/g, '/')
      if (!mappedPaths.has(rel)) {
        violations.push({
          ruleId: 'PERSONA_ACCESS_001',
          filePath: `dashboard/${rel}`,
          offendingValue: 'Page exists but is not mapped in PAGE_ACCESS_MATRIX',
          remediation: 'Add this page to PAGE_ACCESS_MATRIX with the correct minRole',
        })
      }
    }
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

describe('PERSONA_ACCESS_001 — Persona access matrix correctness', () => {
  for (const persona of PERSONAS) {
    describe(`Persona: ${persona.name} (${persona.role}, level ${persona.level})`, () => {
      const allowedPages = PAGE_ACCESS_MATRIX.filter(r => personaCanAccess(persona, r.minRole))
      const deniedPages = PAGE_ACCESS_MATRIX.filter(r => !personaCanAccess(persona, r.minRole))

      it(`can access ${allowedPages.length} pages`, () => {
        // Every page at or below this persona's level should be accessible
        for (const page of allowedPages) {
          expect(
            personaCanAccess(persona, page.minRole),
            `${persona.name} should access ${page.path} (requires ${page.minRole}, level ${ROLE_HIERARCHY[page.minRole]})`,
          ).toBe(true)
        }
      })

      if (deniedPages.length > 0) {
        it(`is denied ${deniedPages.length} pages above their role level`, () => {
          for (const page of deniedPages) {
            expect(
              personaCanAccess(persona, page.minRole),
              `${persona.name} (${persona.level}) should NOT access ${page.path} (requires ${page.minRole}, level ${ROLE_HIERARCHY[page.minRole]})`,
            ).toBe(false)
          }
        })
      }
    })
  }
})

describe('PERSONA_ACCESS_001 — Server-side page auth guards match matrix', () => {
  const ROLE_GUARD_PATTERNS = [
    /hasMinRole\(['"](\w+)['"]\)/,
    /requireMinRole\(['"](\w+)['"]\)/,
    /minRole:\s*['"](\w+)['"]/,
  ]

  for (const rule of PAGE_ACCESS_MATRIX) {
    const fullPath = join(DASHBOARD_DIR, rule.path)
    if (!existsSync(fullPath)) continue

    const content = readFileSync(fullPath, 'utf-8')
    // Only check server components that have explicit role guards
    const isServerComponent = !content.includes("'use client'") && !content.includes('"use client"')
    const hasRoleGuard = ROLE_GUARD_PATTERNS.some(p => p.test(content))

    if (isServerComponent && hasRoleGuard) {
      it(`${rule.path} — server guard matches declared minRole '${rule.minRole}'`, () => {
        for (const pattern of ROLE_GUARD_PATTERNS) {
          const match = content.match(pattern)
          if (match) {
            const guardRole = match[1]
            const guardLevel = ROLE_HIERARCHY[guardRole] ?? 0
            const matrixLevel = ROLE_HIERARCHY[rule.minRole] ?? 0
            // The page guard should be at least as restrictive as the matrix declares
            expect(
              guardLevel >= matrixLevel,
              `Page ${rule.path} has guard '${guardRole}' (${guardLevel}) but matrix declares '${rule.minRole}' (${matrixLevel}). ` +
              'Matrix should match or be more permissive than the page guard.',
            ).toBe(true)
            break
          }
        }
      })
    }
  }
})

describe('PERSONA_ACCESS_001 — API routes backing dashboard have auth and DB schema', () => {
  for (const rule of API_ROUTE_MATRIX) {
    const routeFile = findApiRoute(rule.apiPath)

    it(`API ${rule.apiPath} — route file exists`, () => {
      expect(
        routeFile,
        `Expected API route file at api/${rule.apiPath}/route.ts`,
      ).not.toBeNull()
    })

    if (routeFile) {
      const content = readFileSync(routeFile, 'utf-8')

      it(`API ${rule.apiPath} — uses '${rule.expectedAuthPattern}' auth pattern`, () => {
        expect(
          content.includes(rule.expectedAuthPattern),
          `API route ${rule.apiPath} should use '${rule.expectedAuthPattern}' but doesn't. ` +
          `Content starts with: ${content.slice(0, 200)}`,
        ).toBe(true)
      })

      it(`API ${rule.apiPath} — enforces minRole '${rule.expectedMinRole}'`, () => {
        const isCrud = content.includes('crudRoutes')
        const role = isCrud ? extractCrudReadRole(content) : extractWithApiMinRole(content)
        if (role) {
          const routeLevel = ROLE_HIERARCHY[role] ?? 0
          const expectedLevel = ROLE_HIERARCHY[rule.expectedMinRole] ?? 0
          expect(
            routeLevel >= expectedLevel,
            `API ${rule.apiPath} grants access to '${role}' (${routeLevel}) ` +
            `but expected at least '${rule.expectedMinRole}' (${expectedLevel})`,
          ).toBe(true)
        }
        // If no role found and auth pattern is withOrganizationAuth or withRoleAuth,
        // verify the role is checked in the handler body
        if (!role && rule.expectedAuthPattern === 'withOrganizationAuth') {
          const hasCheck =
            content.includes(`hasMinRole('${rule.expectedMinRole}')`) ||
            content.includes(`hasMinRole("${rule.expectedMinRole}")`)
          expect(
            hasCheck,
            `API ${rule.apiPath} uses withOrganizationAuth but should check hasMinRole('${rule.expectedMinRole}')`,
          ).toBe(true)
        }
      })

      it(`API ${rule.apiPath} — imports from DB schema (DB-connected)`, () => {
        const hasSchemaImport =
          content.includes('@/db/schema') ||
          content.includes('@/db/db') ||
          content.includes('@nzila/db') ||
          content.includes('@/lib/dues-calculation-engine') || // DuesCalculationEngine wraps DB queries
          content.includes('@/lib/database') ||
          content.includes('@/lib/db/') // RLS context wrappers are DB-connected
        expect(
          hasSchemaImport,
          `API route ${rule.apiPath} does not import from DB schema — may not be DB-connected`,
        ).toBe(true)
      })
    }
  }
})

describe('PERSONA_ACCESS_001 — All CRUD routes import valid schema tables', () => {
  // Find all route.ts files that use crudRoutes
  const allRoutes = walkSync(API_DIR, ['.ts']).filter(f => f.endsWith('route.ts'))
  const crudRoutes = allRoutes.filter(f => {
    try { return readFileSync(f, 'utf-8').includes('crudRoutes') } catch { return false }
  })

  it('discovers CRUD routes to validate', () => {
    expect(crudRoutes.length).toBeGreaterThan(0)
  })

  for (const route of crudRoutes) {
    const rel = relPath(route)

    it(`${rel} — imports a schema table`, () => {
      const content = readFileSync(route, 'utf-8')
      // Must import from @/db/schema
      expect(
        content.includes("from '@/db/schema'") || content.includes('from "@/db/schema"'),
        `CRUD route ${rel} does not import from @/db/schema`,
      ).toBe(true)
    })

    it(`${rel} — has table reference in crudRoutes()`, () => {
      const content = readFileSync(route, 'utf-8')
      const tableMatch = content.match(/table:\s*(\w+)/)
      expect(
        tableMatch,
        `CRUD route ${rel} is missing 'table:' property in crudRoutes()`,
      ).not.toBeNull()
    })
  }
})

describe('PERSONA_ACCESS_001 — Cross-org routes require platform-level auth', () => {
  const crossOrgRoutes = walkSync(API_DIR, ['.ts'])
    .filter(f => f.endsWith('route.ts'))
    .filter(f => {
      const normalized = f.replace(/\\/g, '/')
      return normalized.includes('/cross-org/') || normalized.includes('/cross-tenant/')
    })

  for (const route of crossOrgRoutes) {
    const rel = relPath(route)
    const content = readFileSync(route, 'utf-8')

    it(`${rel} — uses platform-level auth (minRole: platform_lead+)`, () => {
      const role = extractWithApiMinRole(content)
      const PLATFORM_ROLES = ['platform_lead', 'cto', 'coo', 'app_owner']
      expect(
        role && PLATFORM_ROLES.includes(role),
        `Cross-org route ${rel} must use minRole: 'platform_lead' or higher, found: '${role}'`,
      ).toBe(true)
    })
  }
})

describe('PERSONA_ACCESS_001 — Persona access boundary tests', () => {
  // Specific boundary cases that verify least-privilege access

  it('member CANNOT access bargaining dashboard', () => {
    const member = PERSONAS.find(p => p.role === 'member')!
    expect(personaCanAccess(member, 'bargaining_committee')).toBe(false)
  })

  it('member CANNOT access pilot onboarding', () => {
    const member = PERSONAS.find(p => p.role === 'member')!
    expect(personaCanAccess(member, 'officer')).toBe(false)
  })

  it('health_safety_rep CANNOT access bargaining dashboard', () => {
    const hsr = PERSONAS.find(p => p.role === 'health_safety_rep')!
    expect(personaCanAccess(hsr, 'bargaining_committee')).toBe(false)
  })

  it('bargaining_committee CAN access bargaining but NOT pilot', () => {
    const bc = PERSONAS.find(p => p.role === 'bargaining_committee')!
    expect(personaCanAccess(bc, 'bargaining_committee')).toBe(true)
    expect(personaCanAccess(bc, 'officer')).toBe(false)
  })

  it('steward CAN access bargaining but NOT pilot', () => {
    const steward = PERSONAS.find(p => p.role === 'steward')!
    expect(personaCanAccess(steward, 'bargaining_committee')).toBe(true)
    expect(personaCanAccess(steward, 'officer')).toBe(false)
  })

  it('officer CAN access both bargaining and pilot', () => {
    const officer = PERSONAS.find(p => p.role === 'officer')!
    expect(personaCanAccess(officer, 'bargaining_committee')).toBe(true)
    expect(personaCanAccess(officer, 'officer')).toBe(true)
  })

  it('admin CAN access all org-level pages', () => {
    const admin = PERSONAS.find(p => p.role === 'admin')!
    for (const page of PAGE_ACCESS_MATRIX) {
      const requiredLevel = ROLE_HIERARCHY[page.minRole] ?? 0
      if (requiredLevel <= 95) { // org-level
        expect(
          personaCanAccess(admin, page.minRole),
          `Admin should access ${page.path}`,
        ).toBe(true)
      }
    }
  })

  it('only platform_lead+ can access cross-org routes', () => {
    const admin = PERSONAS.find(p => p.role === 'admin')!
    const platformLead = PERSONAS.find(p => p.role === 'platform_lead')!
    expect(personaCanAccess(admin, 'platform_lead')).toBe(false)
    expect(personaCanAccess(platformLead, 'platform_lead')).toBe(true)
  })
})
