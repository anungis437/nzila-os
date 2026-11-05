/**
 * Every module a route requires is a module the platform can grant.
 *
 * A route that asks for an entitlement nobody can hold answers 403 to every organization, and nothing but a person opening the screen can tell: the unit test
 * mocks the guard, and the guard reads `org_entitlements`, which only a contract line item (whose feature key is a platform module) fills. The chatbot routes asked for
 * `ai_chatbot`, which is no module and no pricing template names; the whole assistant was refused for everyone. The canonical set is PLATFORM_MODULES
 * (services/platform-economics/entitlement-guard.ts): this test reads every `entitlement: '…'` option and every `requireEntitlement(…, '…')` call in production code
 * and holds each key to it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = path.resolve(__dirname, '..', '..')

/** PLATFORM_MODULES, read from its source: importing the guard would open a database connection. */
function platformModules(): Record<string, string> {
  const source = readFileSync(path.join(APP_ROOT, 'services', 'platform-economics', 'entitlement-guard.ts'), 'utf8')
  const block = /export const PLATFORM_MODULES = \{([\s\S]*?)\} as const/.exec(source)?.[1] ?? ''
  return Object.fromEntries([...block.matchAll(/([A-Z_]+):\s*'([a-z_]+)'/g)].map((match) => [match[1], match[2]]))
}
const PLATFORM_MODULES = platformModules()
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '__mocks__', 'e2e', 'tests', 'backend', 'mobile', 'archive', 'backups', 'scripts', 'docs', 'public', 'messages', '.git'])

function productionFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) productionFiles(full, found)
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\.|\.d\.ts$/.test(entry.name)) found.push(full)
  }
  return found
}

const OPTION = /\bentitlement\s*:\s*['"]([a-z][a-z0-9_]*)['"]/g
const CALL = /\b(?:requireEntitlement|checkModuleEntitlement)\s*\(\s*[^,()]+,\s*['"]([a-z][a-z0-9_]*)['"]/g

describe('the modules routes require', () => {
  it('read the canonical module list from the guard', () => {
    expect(Object.keys(PLATFORM_MODULES).length).toBeGreaterThanOrEqual(18)
    expect(PLATFORM_MODULES.AI_ADVANCED_INSIGHTS).toBe('ai_advanced_insights')
  })

  it('are all platform modules, so an organization can be granted what the route asks for', () => {
    const modules = new Set<string>(Object.values(PLATFORM_MODULES))
    const unknown: string[] = []
    let required = 0
    for (const file of productionFiles(APP_ROOT)) {
      const text = readFileSync(file, 'utf8')
      for (const pattern of [OPTION, CALL]) {
        pattern.lastIndex = 0
        for (const match of text.matchAll(pattern)) {
          required += 1
          if (!modules.has(match[1])) unknown.push(`${path.relative(APP_ROOT, file).replace(/\\/g, '/')}: ${match[1]}`)
        }
      }
    }
    expect(required).toBeGreaterThan(150)
    expect(unknown).toEqual([])
  })

  it('include a module a pricing template can grant, for the assistant routes that were refused for everyone', () => {
    const template = readFileSync(path.join(APP_ROOT, 'services', 'platform-economics', 'pricing-template-service.ts'), 'utf8')
    expect(template).toContain(`moduleKey: '${PLATFORM_MODULES.AI_ADVANCED_INSIGHTS}'`)
    for (const route of ['app/api/chatbot/sessions/route.ts', 'app/api/chatbot/messages/route.ts', 'app/api/chatbot/sessions/[sessionId]/messages/route.ts', 'app/api/chatbot/sessions/[sessionId]/archive/route.ts']) {
      expect(readFileSync(path.join(APP_ROOT, route), 'utf8'), route).toContain(`entitlement: '${PLATFORM_MODULES.AI_ADVANCED_INSIGHTS}'`)
    }
  })
})
