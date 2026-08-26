// @vitest-environment jsdom
//
// Proof-run 005 (G11) — automated accessibility checks for the SAGE operator UI
// surfaces that already exist in the merged repository. These run axe-core
// against rendered components and assert no serious/critical WCAG violations,
// plus SAGE locale-key parity across en / en-CA / fr / fr-CA.
//
// Scope note: this proves REPOSITORY-level accessibility of existing operator
// surfaces only. It does NOT prove deployed accessibility, and it does NOT
// replace the required manual keyboard + screen-reader pass by a named human.
// jsdom cannot evaluate colour-contrast, so that rule is reported by axe as
// "incomplete" (not a violation) and is explicitly out of scope here.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import axe from 'axe-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CreateExportRequestForm } from '../../../app/sage/components/exports/create-export-request-form'
import { ExportRequestList, type ExportRequestRow } from '../../../app/sage/components/exports/export-request-list'
import { ExportPackageList, type ExportPackageRow } from '../../../app/sage/components/exports/export-package-list'
import { RecordsLifecyclePanel } from '../../../app/sage/components/exports/records-lifecycle-panel'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const ORG = '00000000-0000-0000-0000-000000000001'
const WS = '11111111-1111-1111-1111-111111111111'
const ITEM = '22222222-2222-2222-2222-222222222222'

// Some panels fetch on mount (e.g. eligibility) and may schedule follow-up
// fetches asynchronously. Install a persistent resolving stub for the whole
// file so no mount effect ever reaches real undici with a relative URL.
globalThis.fetch = vi.fn(async () =>
  new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }),
) as unknown as typeof fetch

afterEach(() => {
  cleanup()
})

// Run axe against a container and return only serious/critical violations.
async function seriousViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    // Landmark/region rules require a full page shell; component fragments are
    // mounted into document.body, so we assess control-level rules that matter
    // for keyboard/AT users rather than page-structure rules.
    runOnly: {
      type: 'rule',
      values: [
        'button-name',
        'link-name',
        'label',
        'aria-required-attr',
        'aria-valid-attr',
        'aria-valid-attr-value',
        'aria-roles',
        'aria-allowed-attr',
        'aria-command-name',
        'aria-input-field-name',
        'aria-toggle-field-name',
        'duplicate-id-active',
        'form-field-multiple-labels',
        'select-name',
      ],
    },
  })
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)
}

describe('SAGE operator UI — automated accessibility (axe-core, existing surfaces)', () => {
  it('CreateExportRequestForm has no serious/critical violations and labelled controls', async () => {
    const { container } = render(
      <CreateExportRequestForm
        orgId={ORG}
        workspaceId={WS}
        requesterId="u-admin"
        packageTypes={['internal_review_bundle']}
        evidenceItems={[{ id: ITEM, label: 'Evidence 2222', authorizationLevel: 'accepted' }]}
        boundaryFlags={[]}
        reviewNotes={[]}
        decisionRecords={[]}
      />,
    )
    expect(await seriousViolations(container)).toEqual([])
  })

  it('ExportRequestList (approval controls) has no serious/critical violations', async () => {
    const row: ExportRequestRow = {
      id: 'req-other',
      requestedBy: 'u-other',
      purpose: 'theirs',
      packageType: 'internal_review_bundle',
      status: 'requested',
      requestedScopeHash: 'h',
      itemCount: 1,
      createdAt: 't',
    }
    const { container } = render(
      <ExportRequestList orgId={ORG} workspaceId={WS} currentActorId="u-admin" canApprove requests={[row]} />,
    )
    expect(await seriousViolations(container)).toEqual([])
  })

  it('ExportPackageList (hashes + internal download) has no serious/critical violations', async () => {
    const pkg: ExportPackageRow = {
      id: 'pkg-1',
      exportRequestId: 'req-1',
      status: 'generated',
      packageType: 'internal_review_bundle',
      manifestHash: 'm'.repeat(64),
      contentHash: 'c'.repeat(64),
      sizeBytes: 100,
      policyVersion: 'sage-export-v1',
      itemCount: 1,
      excludedCount: 0,
      generatedBy: 'u-approver',
      generatedAt: 't',
    }
    const { container } = render(
      <ExportPackageList orgId={ORG} workspaceId={WS} generatableRequestIds={['req-1']} packages={[pkg]} />,
    )
    expect(await seriousViolations(container)).toEqual([])
  })

  it('RecordsLifecyclePanel (retention/hold/destruction) has no serious/critical violations', async () => {
    const { container } = render(
      <RecordsLifecyclePanel
        workspaceId={WS}
        currentActorId="u-admin"
        packages={[]}
        destructionRequests={[
          {
            id: 'dr-1',
            exportPackageId: 'pkg-1',
            status: 'requested',
            reason: 'end of retention',
            retentionPolicyCode: 'standard',
            retentionPolicyVersion: 1,
            retainUntil: '2027-01-01',
            activeHoldCount: 0,
            isOwnRequest: false,
          },
        ]}
      />,
    )
    expect(await seriousViolations(container)).toEqual([])
  })
})

describe('SAGE UI — locale-key parity (EN / en-CA / fr / fr-CA)', () => {
  const dir = join(__dirname, '../../../messages')
  const locales = ['en', 'en-CA', 'fr', 'fr-CA'] as const
  const SAGE_NAMESPACES = ['sage', 'sageDelivery', 'sageRecords']

  function load(locale: string): Record<string, unknown> {
    return JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'))
  }

  function keyPaths(obj: unknown, prefix = ''): string[] {
    if (obj === null || typeof obj !== 'object') return [prefix]
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    )
  }

  const en = load('en')

  for (const ns of SAGE_NAMESPACES) {
    if (!(ns in en)) continue
    const enKeys = keyPaths(en[ns as keyof typeof en]).sort()
    for (const locale of locales) {
      if (locale === 'en') continue
      it(`${locale} has the same "${ns}" keys as en`, () => {
        const other = load(locale)
        expect(ns in other).toBe(true)
        const otherKeys = keyPaths((other as Record<string, unknown>)[ns]).sort()
        expect(otherKeys).toEqual(enKeys)
      })
    }
  }
})
