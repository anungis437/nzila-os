/**
 * Contract Test — Console Workspace Sub-page Navigation (CONSOLE-NAV-02)
 *
 * Ensures workspace navigation is complete and robust:
 * - every workspace root page exists
 * - every declared sub-tab has a navigation surface:
 *   either a LegacyBridge panel or explicit page-level handling
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WORKSPACES, type WorkspaceKey } from '../../apps/console/app/(dashboard)/workspace/_lib/nav'
import { bridgeFor } from '../../apps/console/app/(dashboard)/workspace/_lib/legacy-map'

const ROOT = resolve(__dirname, '../..')

function pagePath(workspace: WorkspaceKey): string {
  return resolve(ROOT, `apps/console/app/(dashboard)/workspace/${workspace}/page.tsx`)
}

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

function hasExplicitTabHandling(pageSource: string, tab: string): boolean {
  return (
    pageSource.includes(`'${tab}'`) ||
    pageSource.includes(`\"${tab}\"`) ||
    pageSource.includes(`?tab=${tab}`)
  )
}

describe('Console workspace navigation (CONSOLE-NAV-02)', () => {
  it('every workspace declared in nav has a root page', () => {
    const missing = WORKSPACES
      .map((w) => ({ workspace: w.key, path: pagePath(w.key) }))
      .filter(({ path }) => !existsSync(path))

    expect(
      missing,
      `Missing workspace root pages: ${missing.map((m) => m.workspace).join(', ')}`,
    ).toEqual([])
  })

  it('every declared sub-tab is bridge-backed or explicitly handled by its page', () => {
    const missingNavSurface: string[] = []

    for (const workspace of WORKSPACES) {
      if (workspace.subTabs.length === 0) continue

      const source = read(pagePath(workspace.key))

      for (const tab of workspace.subTabs) {
        const panel = bridgeFor(workspace.key, tab.key)
        const sharedPanel = bridgeFor(workspace.key, '')
        const hasBridge = Boolean(
          (panel && panel.links.length > 0) ||
          (sharedPanel && sharedPanel.links.length > 0),
        )
        const hasExplicitHandling = hasExplicitTabHandling(source, tab.key)

        if (!hasBridge && !hasExplicitHandling) {
          missingNavSurface.push(`${workspace.key}:${tab.key}`)
        }
      }
    }

    expect(
      missingNavSurface,
      `Sub-tabs missing navigation surfaces: ${missingNavSurface.join(', ')}`,
    ).toEqual([])
  })
})
