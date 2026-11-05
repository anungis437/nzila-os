/**
 * F06 R7: the unclaimed workbook is reached by a capability, not by its identifier, and the path works under the real roles.
 * Source pins for the wiring that the route and native tests exercise.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const app = path.resolve(__dirname, '../../..')
const read = (rel: string) => fs.readFileSync(path.join(app, rel), 'utf8')

describe('F06 R7 workbook capability wiring', () => {
  it('issues a capability at start, stores only its hash, and returns the token once with a cookie', () => {
    const start = read('app/api/workbook/start/route.ts')
    expect(start).toContain('issueWorkbookCapability()')
    expect(start).toContain('capabilityTokenHash: capability.tokenHash')
    expect(start).not.toMatch(/capabilityTokenHash:\s*capability\.token\b/)
    expect(start).toContain('setWorkbookCapabilityCookie(response, wb.id, capability.token)')
  })

  it('clears the capability in the claim statement itself and removes the cookie', () => {
    const claim = read('app/api/workbook/[id]/claim/route.ts')
    expect(claim).toMatch(/\.set\(\{[\s\S]*capabilityTokenHash: null,[\s\S]*capabilityTokenExpiresAt: null,[\s\S]*\}\)\s*\.where\(/)
    expect(claim).toContain('clearWorkbookCapabilityCookie(response, workbookId)')
  })

  it('hands the presented capability to the authority boundary in every memory-holder handler', () => {
    for (const file of ['app/api/workbook/[id]/memory-holders/route.ts', 'app/api/workbook/[id]/memory-holders/[holderId]/route.ts']) {
      const source = read(file)
      const boundaries = source.match(/withClaimedWorkbookAccess\(/g) ?? []
      const presented = source.match(/capability: extractWorkbookCapability\(request, workbookId\)/g) ?? []
      expect(boundaries.length, file).toBe(2)
      expect(presented.length, file).toBe(boundaries.length)
    }
  })

  it('serves the memory-holder page through the same boundary with the cookie capability, and records the read', () => {
    const page = read('app/[locale]/workbook/[id]/memory-holders/page.tsx')
    expect(page).toContain('readWorkbookCapabilityCookie(id)')
    expect(page).toContain("withClaimedWorkbookAccess({ workbookId: id, operation: 'read', capability }")
    expect(page).toContain("action: 'workbook.memory_holder.read'")
    expect(page).not.toContain('verifyClaimedWorkbookAccess')
  })

  it('creates the workbook only through the guarded start API, never from a page render', () => {
    const page = read('app/[locale]/workbook/start/page.tsx')
    expect(page).not.toMatch(/\.insert\(|from '@\/db'|redirect\(/)
    const client = read('app/[locale]/workbook/start/WorkbookStartClient.tsx')
    expect(client).toContain("fetch('/api/workbook/start'")
    expect(client).toContain('TurnstileWidget')
    expect(client).toContain("credentials: 'same-origin'")
  })

  it('answers an unclaimed workbook without a valid capability as not found', () => {
    const access = read('lib/workbook/access-control.ts')
    expect(access).toContain('if (!workbookCapabilityHolds(capability, ownership))')
    expect(access).not.toContain('the workbookId itself is the bearer credential')
  })

  it('declares the privileges the unclaimed path needs under the system role, which natively held none of them', () => {
    const manifest = read('db/rls-storage-authority/reference-latent.ts')
    const entry = (table: string) => {
      const start = manifest.indexOf(`table: "${table}"`)
      return manifest.slice(start, manifest.indexOf('reviewPriority', start))
    }
    expect(entry('workbooks')).toContain('requiredSystemPrivileges: ["SELECT","INSERT","UPDATE"]')
    expect(entry('workbook_modules')).toContain('requiredSystemPrivileges: ["INSERT"]')
    expect(entry('workbook_memory_holders')).toContain('requiredSystemPrivileges: ["SELECT","INSERT","UPDATE","DELETE"]')
  })
})
