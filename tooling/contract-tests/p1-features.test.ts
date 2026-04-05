/**
 * Contract Test — P1 Feature Completeness (CFO + Zonga)
 *
 * Structural invariants for P1 features:
 *   1. CFO client components exist and use 'use client' + server action pattern
 *   2. CFO pages no longer POST to /api/* routes
 *   3. CFO create/new pages exist (clients/new, reports/new, tasks/new)
 *   4. CFO settings page wires editable SettingsForm
 *   5. Zonga detail pages exist (catalog/[id], releases/[id])
 *   6. Zonga integrity action returns IntegrityResult shape
 *   7. Zonga payout-actions support multi-currency and royalty splits
 *   8. Error/Loading boundaries exist for both apps
 *   9. CFO client detail uses financialSummary (not financials)
 *
 * @invariant P1-01: CFO client components pattern
 * @invariant P1-02: No /api/ form actions in CFO pages
 * @invariant P1-03: CFO create pages exist
 * @invariant P1-04: CFO settings wires SettingsForm
 * @invariant P1-05: Zonga detail pages exist
 * @invariant P1-06: IntegrityResult shape
 * @invariant P1-07: Multi-currency payouts + royalty splits
 * @invariant P1-08: Error/Loading boundaries
 * @invariant P1-09: CFO client detail financialSummary
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const CFO_APP = join(ROOT, 'apps', 'cfo')
const CFO_LIB = join(CFO_APP, 'lib')
const CFO_COMPONENTS = join(CFO_APP, 'components')
const CFO_PAGES = join(CFO_APP, 'app', '[locale]', 'dashboard')
const ZONGA_APP = join(ROOT, 'apps', 'zonga')
const ZONGA_LIB = join(ZONGA_APP, 'lib')
const ZONGA_PAGES = join(ZONGA_APP, 'app', '[locale]', 'dashboard')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── P1-01: CFO Client Components Pattern ────────────────────────────────────

describe('P1-01 — CFO client components use correct pattern', () => {
  const components = [
    'advisory-chat-form.tsx',
    'action-buttons.tsx',
    'create-client-form.tsx',
    'settings-form.tsx',
    'generate-report-form.tsx',
    'create-task-form.tsx',
  ]

  for (const comp of components) {
    const src = readSafe(join(CFO_COMPONENTS, comp))

    it(`${comp} exists`, () => {
      expect(src.length).toBeGreaterThan(0)
    })

    it(`${comp} has 'use client' directive`, () => {
      expect(src).toContain("'use client'")
    })

    it(`${comp} uses useTransition for loading states`, () => {
      expect(src).toContain('useTransition')
    })
  }
})

// ── P1-02: No /api/ Form Actions in CFO Pages ──────────────────────────────

describe('P1-02 — No /api/ form actions in CFO pages', () => {
  const pagesToCheck = [
    'advisory-ai/page.tsx',
    'ledger/page.tsx',
    'integrations/page.tsx',
  ]

  for (const page of pagesToCheck) {
    const src = readSafe(join(CFO_PAGES, page))

    it(`${page} does not POST to /api/*`, () => {
      expect(src).not.toMatch(/action=["']\/api\//)
    })

    it(`${page} uses client component instead`, () => {
      // Should import from a components directory
      expect(src).toMatch(/@\/components\//)
    })
  }
})

// ── P1-03: CFO Create Pages Exist ───────────────────────────────────────────

describe('P1-03 — CFO create pages exist', () => {
  const createPages = [
    { path: 'clients/new/page.tsx', label: 'Create Client' },
    { path: 'reports/new/page.tsx', label: 'Generate Report' },
    { path: 'tasks/new/page.tsx', label: 'New Task' },
  ]

  for (const { path, label } of createPages) {
    const fullPath = join(CFO_PAGES, path)

    it(`${label} page exists at ${path}`, () => {
      expect(existsSync(fullPath)).toBe(true)
    })

    it(`${label} page is auth-gated`, () => {
      const src = readSafe(fullPath)
      expect(src).toContain("from '@nzila/platform-auth/entra/server'")
      expect(src).toContain('redirect')
    })

    it(`${label} page imports a form component`, () => {
      const src = readSafe(fullPath)
      expect(src).toMatch(/@\/components\//)
    })
  }
})

// ── P1-04: CFO Settings Wires Editable SettingsForm ─────────────────────────

describe('P1-04 — CFO settings uses SettingsForm', () => {
  const settingsPage = readSafe(join(CFO_PAGES, 'settings/page.tsx'))
  const settingsForm = readSafe(join(CFO_COMPONENTS, 'settings-form.tsx'))

  it('settings page imports SettingsForm', () => {
    expect(settingsPage).toContain('SettingsForm')
  })

  it('settings page passes initial settings prop', () => {
    expect(settingsPage).toContain('initial={settings}')
  })

  it('SettingsForm component exists', () => {
    expect(settingsForm.length).toBeGreaterThan(0)
  })

  it('SettingsForm calls updateSettings action', () => {
    expect(settingsForm).toContain('updateSettings')
  })

  it('SettingsForm has save button', () => {
    expect(settingsForm).toContain('Save')
  })

  it('SettingsForm renders all 6 settings', () => {
    expect(settingsForm).toContain('Currency')
    expect(settingsForm).toContain('Fiscal Year Start')
    expect(settingsForm).toContain('Timezone')
    expect(settingsForm).toContain('Report Schedule')
    expect(settingsForm).toContain('AI Advisory')
    expect(settingsForm).toContain('Auto Reconcile')
  })
})

// ── P1-05: Zonga Detail Pages Exist ─────────────────────────────────────────

describe('P1-05 — Zonga detail pages exist', () => {
  const detailPages = [
    { path: 'catalog/[id]/page.tsx', label: 'Asset Detail' },
    { path: 'releases/[id]/page.tsx', label: 'Release Detail' },
  ]

  for (const { path, label } of detailPages) {
    const fullPath = join(ZONGA_PAGES, path)
    const src = readSafe(fullPath)

    it(`${label} page exists`, () => {
      expect(existsSync(fullPath)).toBe(true)
    })

    it(`${label} page is auth-gated`, () => {
      expect(src).toContain("from '@nzila/platform-auth/entra/server'")
    })

    it(`${label} page reads params.id`, () => {
      expect(src).toMatch(/params/)
    })
  }

  it('asset detail page shows metadata, collaborators, revenue', () => {
    const src = readSafe(join(ZONGA_PAGES, 'catalog/[id]/page.tsx'))
    expect(src).toContain('collaborator')
    expect(src).toContain('revenue')
  })

  it('release detail page shows tracks, royalty splits', () => {
    const src = readSafe(join(ZONGA_PAGES, 'releases/[id]/page.tsx'))
    expect(src).toContain('track')
    expect(src).toContain('split')
  })
})

// ── P1-06: IntegrityResult Shape ────────────────────────────────────────────

describe('P1-06 — IntegrityResult returns checks + summary', () => {
  const releaseActions = readSafe(join(ZONGA_LIB, 'actions', 'release-actions.ts'))

  it('exports IntegrityResult type', () => {
    expect(releaseActions).toContain('IntegrityResult')
  })

  it('IntegrityResult has checks array', () => {
    expect(releaseActions).toMatch(/checks:\s*IntegrityCheck\[\]/)
  })

  it('IntegrityResult has summary', () => {
    expect(releaseActions).toMatch(/summary:\s*IntegritySummary/)
  })

  it('IntegritySummary has total, passed, flagged, critical', () => {
    expect(releaseActions).toContain('total: number')
    expect(releaseActions).toContain('passed: number')
    expect(releaseActions).toContain('flagged: number')
    expect(releaseActions).toContain('critical: number')
  })

  it('getIntegrityChecks returns IntegrityResult (not flat array)', () => {
    expect(releaseActions).toMatch(/getIntegrityChecks.*:\s*Promise<IntegrityResult>/)
  })

  it('computes summary from checks', () => {
    expect(releaseActions).toContain('checks.filter')
  })
})

// ── P1-07: Multi-Currency Payouts + Royalty Splits ──────────────────────────

describe('P1-07 — Multi-currency payouts + royalty splits', () => {
  const payoutActions = readSafe(join(ZONGA_LIB, 'actions', 'payout-actions.ts'))

  it('previewPayout looks up creator payoutCurrency', () => {
    expect(payoutActions).toContain("'creator.registered'")
    expect(payoutActions).toContain("payoutCurrency")
  })

  it('previewPayout defaults to USD not CAD', () => {
    expect(payoutActions).toContain("'USD'")
  })

  it('executePayout accepts currency param', () => {
    expect(payoutActions).toContain('currency?:')
  })

  it('executePayout accepts payoutRail param', () => {
    expect(payoutActions).toContain('payoutRail?:')
  })

  it('exports getWalletBalance', () => {
    expect(payoutActions).toContain('getWalletBalance')
  })

  it('WalletBalance has pendingBalance and currency', () => {
    expect(payoutActions).toContain('pendingBalance:')
    expect(payoutActions).toContain('currency:')
  })

  it('exports computeRoyaltySplits', () => {
    expect(payoutActions).toContain('computeRoyaltySplits')
  })

  it('exports executeRoyaltySplitPayout', () => {
    expect(payoutActions).toContain('executeRoyaltySplitPayout')
  })

  it('royalty splits compute per-creator amounts from percentage', () => {
    expect(payoutActions).toContain('sharePercent')
    expect(payoutActions).toContain('totalRevenue * (s.sharePercent / 100)')
  })

  it('no hardcoded CAD anywhere', () => {
    // Allow 'CAD' only in string arrays or comments, not in function logic
    const lines = payoutActions.split('\n')
    const logicLines = lines.filter(
      (l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'),
    )
    const logicSrc = logicLines.join('\n')
    // Should not have currency: 'CAD' or 'cad' hardcoded in execute/preview
    expect(logicSrc).not.toMatch(/currency:\s*['"]CAD['"]/)
    expect(logicSrc).not.toMatch(/currency:\s*['"]cad['"]/)
  })
})

// ── P1-08: Error/Loading Boundaries ─────────────────────────────────────────

describe('P1-08 — Error/Loading boundaries', () => {
  const boundaries = [
    { app: 'CFO', base: CFO_PAGES },
    { app: 'Zonga', base: ZONGA_PAGES },
  ]

  for (const { app, base } of boundaries) {
    it(`${app} has loading.tsx boundary`, () => {
      expect(existsSync(join(base, 'loading.tsx'))).toBe(true)
    })

    it(`${app} loading.tsx shows skeleton/pulse animation`, () => {
      const src = readSafe(join(base, 'loading.tsx'))
      expect(src).toContain('animate-pulse')
    })

    it(`${app} has error.tsx boundary`, () => {
      expect(existsSync(join(base, 'error.tsx'))).toBe(true)
    })

    it(`${app} error.tsx is a client component`, () => {
      const src = readSafe(join(base, 'error.tsx'))
      expect(src).toContain("'use client'")
    })

    it(`${app} error.tsx has reset button`, () => {
      const src = readSafe(join(base, 'error.tsx'))
      expect(src).toContain('reset')
      expect(src).toContain('Try Again')
    })
  }
})

// ── P1-09: CFO Client Detail — financialSummary ────────────────────────────

describe('P1-09 — CFO client detail uses financialSummary', () => {
  const clientActions = readSafe(join(CFO_LIB, 'actions', 'client-actions.ts'))

  it('getClientDetail returns financialSummary', () => {
    expect(clientActions).toContain('financialSummary')
  })

  it('financialSummary has totalRevenue', () => {
    expect(clientActions).toContain('totalRevenue')
  })

  it('financialSummary has documentCount', () => {
    expect(clientActions).toContain('documentCount')
  })

  it('financialSummary has recentActivity', () => {
    expect(clientActions).toContain('recentActivity')
  })
})
