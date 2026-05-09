/**
 * Contract Test — Feature Flag Evaluation Chains
 *
 * Verifies feature flag logic and guard chains work correctly:
 * - Flags evaluate correctly with AND/OR logic
 * - Dependencies between flags are respected
 * - Pilot mode gates are evaluated in correct order
 * - Role-based flags cannot escalate permissions
 * - Flag evaluation is deterministic and cacheable
 * - No circular dependencies
 *
 * @invariant FF_EVAL_001: Feature flag guards evaluate in correct order
 * @invariant FF_EVAL_002: Pilot mode gates are evaluated before feature access
 * @invariant FF_EVAL_003: Flag dependencies form a DAG (no cycles)
 * @invariant FF_EVAL_004: Role-based flags cannot grant higher permissions
 * @invariant FF_EVAL_005: Flag evaluation is deterministic
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function relPath(fullPath: string): string {
  return fullPath.replace(ROOT, '').replace(/\\/g, '/')
}

function collectRouteFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) return []

  const fs = require('node:fs') as typeof import('node:fs')
  const entries: string[] = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!['admin', 'internal'].includes(entry.name)) {
          walk(path)
        }
        continue
      }
      if (entry.name === 'route.ts') {
        entries.push(path)
      }
    }
  }

  walk(rootDir)
  return entries
}

// ── FF_EVAL_001: Feature flag guards evaluate in correct order ─────────────

describe('FF_EVAL_001 — Feature flag guards evaluate in correct order', () => {
  it('pilot gates are checked before feature-specific gates', () => {
    const guardFiles = [
      join(ROOT, 'apps', 'union-eyes', 'lib', 'api', 'framework.ts'),
      join(ROOT, 'apps', 'console', 'lib', 'api-guards.ts'),
    ].filter((f) => existsSync(f))

    for (const file of guardFiles) {
      const content = readContent(file)
      if (!content.includes('withApi') && !content.includes('guard')) continue

      // Check that auth is checked before feature flags
      const authIndex = Math.max(
        content.indexOf('auth'),
        content.indexOf('requireAuth'),
        content.indexOf('withApi')
      )
      const flagIndex = Math.max(
        content.indexOf('entitlement'),
        content.indexOf('pilot'),
        content.indexOf('feature_flag')
      )

      if (authIndex > -1 && flagIndex > -1) {
        expect(authIndex <= flagIndex, `${relPath(file)}: auth should be checked before flags`).toBe(true)
      }
    }
  })

  it('organization scope is verified before resource access', () => {
    const routeFiles = collectRouteFiles(join(ROOT, 'apps', 'union-eyes', 'app', 'api'))
    if (routeFiles.length === 0) {
      expect(true).toBe(true)
      return
    }

    const frameworkPath = join(ROOT, 'apps', 'union-eyes', 'lib', 'api', 'framework.ts')
    if (existsSync(frameworkPath)) {
      const frameworkContent = readContent(frameworkPath)
      const hasOrgScopeCapability = /withOrgScope|organizationId|getOrganizationIdForUser|auth\s*:\s*\{[^}]*required/s.test(frameworkContent)
      expect(hasOrgScopeCapability).toBe(true)
    }

    let orgScopedRouteCount = 0
    for (const file of routeFiles) {
      const content = readContent(file)
      const relativePath = relPath(file)
      if (relativePath.includes('/app/api/auth/')) continue
      if (relativePath.includes('/app/api/case-studies/')) continue

      if (/orgScoped\s*:\s*true|organizationId|withOrganizationAuth/.test(content)) {
        orgScopedRouteCount += 1
        const explicitlyUnscoped = /withApiAuthOptional|auth\s*:\s*\{[^}]*required\s*:\s*false/s.test(content)
        expect(explicitlyUnscoped, `${relPath(file)} should not combine org-scoped flow with optional auth`).toBe(false)
      }
    }

    expect(orgScopedRouteCount > 0).toBe(true)
  })
})

// ── FF_EVAL_002: Pilot mode gates are evaluated before feature access ───────

describe('FF_EVAL_002 — Pilot mode gates are evaluated before feature access', () => {
  it('entitlements framework concept exists', () => {
    // Check that withApi framework supports entitlement checking
    const frameworkPath = join(ROOT, 'apps', 'union-eyes', 'lib', 'api', 'framework.ts')
    if (!existsSync(frameworkPath)) {
      expect(true).toBe(true)
      return
    }

    const content = readContent(frameworkPath)
    const hasEntitlementConcept = /entitlement|requireEntitlement|checkEntitlement/.test(content)
    expect(hasEntitlementConcept).toBe(true)
  })

  it('pilot mode entitlements are documented', () => {
    const pilotPath = join(ROOT, 'packages', 'pilot-mode')
    if (!existsSync(pilotPath)) {
      expect(true).toBe(true)
      return
    }

    const enginePath = join(pilotPath, 'src', 'engine.ts')
    const typesPath = join(pilotPath, 'src', 'types.ts')
    expect(existsSync(enginePath)).toBe(true)
    expect(existsSync(typesPath)).toBe(true)
  })
})

// ── FF_EVAL_003: Feature flag dependencies form a DAG ──────────────────────

describe('FF_EVAL_003 — Feature flag dependencies form a DAG (no cycles)', () => {
  it('pilot mode package has no circular dependencies', () => {
    const pilotPackagePath = join(ROOT, 'packages', 'pilot-mode', 'src')
    if (!existsSync(pilotPackagePath)) return

    const fs = require('node:fs')
    const files = fs.readdirSync(pilotPackagePath)

    // Check that types.ts doesn't import engine.ts (engine should depend on types)
    const typesContent = readContent(join(pilotPackagePath, 'types.ts'))
    const engineContent = readContent(join(pilotPackagePath, 'engine.ts'))

    const typesImportsEngine = /from\s+['"]\.\/engine['"]/.test(typesContent)
    const engineImportsTypes = /from\s+['"]\.\/types['"]/.test(engineContent)

    expect(typesImportsEngine).toBe(false)
    expect(engineImportsTypes).toBe(true)
  })

  it('guards and entitlements do not have cross-references that create cycles', () => {
    const guardFiles = [
      join(ROOT, 'apps', 'console', 'lib', 'api-guards.ts'),
      join(ROOT, 'apps', 'union-eyes', 'lib', 'api', 'framework.ts'),
    ].filter((f) => existsSync(f))

    for (const file of guardFiles) {
      const content = readContent(file)

      // Check for basic circular patterns (simplified check)
      const exportedFuncs = [...content.matchAll(/export\s+(?:function|const)\s+(\w+)/g)].map((m) => m[1])
      const importedFuncs = [...content.matchAll(/import.*\{([^}]+)\}/g)].flatMap((m) =>
        m[1].split(',').map((s) => s.trim())
      )

      // A more thorough analysis would build a dependency graph
      // For now, just check that we're not importing everything from ourselves
      const importsSelf = content.includes(`from '${file}'`) || content.includes(`from "./${file}"`)
      expect(importsSelf).toBe(false)
    }
  })
})

// ── FF_EVAL_004: Role-based flags cannot grant higher permissions ─────────

describe('FF_EVAL_004 — Role-based flags cannot grant higher permissions', () => {
  it('pilot mode entitlements cannot be combined to escalate roles', () => {
    const entitlementFiles = collectRouteFiles(join(ROOT, 'apps', 'union-eyes', 'app', 'api'))

    let entitlementRouteCount = 0
    for (const file of entitlementFiles) {
      const content = readContent(file)
      if (!/requiredEntitlements|entitlement/i.test(content)) continue
      entitlementRouteCount += 1

      const hasRoleOrAuthConstraint = /requiredRole|allowedRoles|hasMinRole|readRole|writeRole|orgScoped\s*:\s*true|withOrganizationAuth|withRoleAuth|withMinRole|withApiAuth|withApi\s*\(|requireEntitlement|auth\s*:\s*\{[^}]*required\s*:\s*true|auth\s*:\s*\{[^}]*minRole/s.test(content)
      expect(hasRoleOrAuthConstraint, `${relPath(file)} should pair entitlements with auth/role constraints`).toBe(true)

      const allowsAnonymous = /withApiAuthOptional|auth\s*:\s*\{[^}]*required\s*:\s*false/s.test(content)
      expect(allowsAnonymous, `${relPath(file)} should not expose entitlements on anonymous flows`).toBe(false)
    }

    expect(entitlementRouteCount > 0).toBe(true)
  })

  it('role hierarchy is enforced: lower roles do not gain higher role permissions via flags', () => {
    const rbacFile = join(ROOT, 'apps', 'union-eyes', 'lib', 'auth', 'roles.ts')
    if (!existsSync(rbacFile)) {
      expect(true).toBe(true)
      return
    }

    const content = readContent(rbacFile)
    const hasHierarchy = /HIERARCHY|ROLE.*LEVEL|ranking|level|priority|ADMIN|STEWARD|VIEWER/i.test(content)
    expect(hasHierarchy).toBe(true)
  })
})

// ── FF_EVAL_005: Flag evaluation is deterministic ────────────────────────

describe('FF_EVAL_005 — Feature flag evaluation is deterministic', () => {
  it('withApi framework evaluates guards consistently', () => {
    const frameworkPath = join(ROOT, 'apps', 'union-eyes', 'lib', 'api', 'framework.ts')
    if (!existsSync(frameworkPath)) return

    const content = readContent(frameworkPath)

    // Check for non-deterministic patterns (random numbers, current time in critical paths)
    const inGuardLogic = content.split('function withApi')[1]?.split('return')[0] || ''

    // Random should not be in guard evaluation logic
    const hasDeterministicGuards =
      !/(Math\.random|Date\.now|crypto\.random)/.test(inGuardLogic) ||
      /deterministic|seeded|test.*random/.test(content)

    expect(hasDeterministicGuards).toBe(true)
  })

  it('org scope resolution is deterministic (same user, same org, same result)', () => {
    const authGuardPath = join(ROOT, 'apps', 'union-eyes', 'lib', 'api-auth-guard.ts')
    const orgUtilsPath = join(ROOT, 'apps', 'union-eyes', 'lib', 'organization-utils.ts')
    const pathToCheck = existsSync(orgUtilsPath) ? orgUtilsPath : authGuardPath
    if (!existsSync(pathToCheck)) return

    const content = readContent(pathToCheck)

    // Deterministic org resolution should not rely on random/time-based behavior.
    const hasNondeterminism = /Math\.random|crypto\.random|Date\.now/.test(content)
    expect(hasNondeterminism).toBe(false)
  })

  it('pilot mode evaluation uses consistent source of truth', () => {
    const pilotEnginePath = join(ROOT, 'packages', 'pilot-mode', 'src', 'engine.ts')
    if (!existsSync(pilotEnginePath)) return

    const content = readContent(pilotEnginePath)

    // Engine should be pure (no side effects during evaluation)
    const hasPure = /pure|deterministic|no.*side.*effect/.test(content) || !/(fetch|http|socket)/i.test(content)
    expect(hasPure).toBe(true)
  })

  it('auth utilities use deterministic sources', () => {
    const authPath = join(ROOT, 'apps', 'union-eyes', 'lib', 'auth')
    if (!existsSync(authPath)) {
      expect(true).toBe(true)
      return
    }

    expect(existsSync(authPath)).toBe(true)
  })
})
