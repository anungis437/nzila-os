import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// SAGE must receive a complete server-verified actor scope from each server
// component. Reconstructing only {actorId, orgId, orgRole} silently drops the
// trusted authentication classification and is rejected by resolveSageActorKind.
//
// Runtime actor-kind allow/deny semantics are separately covered by runtime.test.ts.
// This guard pins the server-page composition boundary so the same integration
// defect cannot reappear while pages are modified.
const here = dirname(fileURLToPath(import.meta.url))
const sageApp = resolve(here, '../../../app/sage')

describe('SAGE server page identity propagation', () => {
  const pages = [
    'page.tsx',
    '[workspaceId]/page.tsx',
    '[workspaceId]/evidence/page.tsx',
    '[workspaceId]/governance/page.tsx',
    '[workspaceId]/exports/page.tsx',
    '[workspaceId]/delivery/page.tsx',
  ]

  for (const page of pages) {
    it(`passes trusted server context through ${page}`, () => {
      const source = readFileSync(resolve(sageApp, page), 'utf8')

      // The only authenticated context is the server-verified PageOrgContext,
      // whose authenticationType is derived by getPageOrgContext(), not supplied
      // by a browser field or tenant-provided role label.
      expect(source).toMatch(/getPageOrgContext\(sp\)/)
      expect(source).toMatch(/(?:const (?:scope|ctx) = result\.context|ForScope\(result\.context)/)

      // This exact previously-shipped composition was defective: missing
      // authenticationType and actorKind makes even legitimate views fail closed.
      expect(source).not.toMatch(
        /const (?:scope|ctx) = \{\s*actorId: result\.context\.actorId,\s*orgId: result\.context\.orgId,\s*orgRole: result\.context\.orgRole,\s*\}/,
      )
    })
  }
})
