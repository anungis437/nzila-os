import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { OperatorWorkflow } from './operator-workflow'
import { SyntheticWorkflowGallery } from './synthetic-workflow-gallery'
import {
  buildSyntheticOperatorCollection,
  type SyntheticOperatorJourney,
} from '../../lib/operator-workflow/synthetic-journeys'
import type { OperatorWorkflowAvailableView } from '../../lib/operator-workflow/view'

let journeys: SyntheticOperatorJourney[]
beforeAll(async () => {
  journeys = await buildSyntheticOperatorCollection()
}, 30_000)
function find(name: string): OperatorWorkflowAvailableView {
  const found = journeys.find((journey) => journey.name === name)?.view
  if (!found || found.access !== 'ALLOWED')
    throw new Error(`Missing authorized synthetic view: ${name}`)
  return found
}
function render(view: OperatorWorkflowAvailableView) {
  return renderToStaticMarkup(createElement(OperatorWorkflow, { view }))
}
describe('governed operator reference surface', () => {
  it('renders MATCHED as technical evidence comparison, never an approval or certification', () => {
    const view = find('Technical match without recipient decision')
    const html = render(view)
    expect(view.technical.state).toBe('MATCHED')
    expect(html).toContain('This is not institutional approval')
    expect(html).toContain('No recipient decision reference is recorded')
    expect(html).not.toMatch(
      /you are approved|operator is certified|approved for funding|verified by Cora/i,
    )
    expect(html).toContain('Cora can interpret; authorized institutions determine.')
  })
  it('shows PARTIAL and the actual missing criterion', () => {
    const view = find('Additional evidence needed with governed reuse')
    expect(view.technical.state).toBe('PARTIAL')
    expect(render(view)).toContain('supplemental-review: Additional evidence needed')
    expect(render(view)).toContain('additional information is needed')
  })
  it('renders bounded denial with no evidence, requirement, issuer, metrics or run data', () => {
    const view = journeys.find((journey) => journey.name === 'Access unavailable')!.view
    expect(view.access).toBe('DENIED')
    const html = renderToStaticMarkup(createElement(OperatorWorkflow, { view }))
    expect(html).toContain('Workflow unavailable')
    expect(html).toContain('role="alert"')
    expect(html).not.toMatch(
      /synthetic-organic-evidence|synthetic-requirement|synthetic-certifier|EvidenceReuse|run:/,
    )
    expect(Object.keys(view).sort()).toEqual(['access', 'message'])
  })
  it('shows both conflicting claims/issuers and no selected winner or success styling', () => {
    const view = find('Conflicting assertions')
    expect(view.technical.state).toBe('CONFLICT')
    expect(view.technical.conflicts[0]!.assertions).toHaveLength(2)
    const html = render(view)
    expect(html).toContain('synthetic-second-issuer')
    expect(html).toContain('synthetic-certifier-001')
    expect(html).toContain('NOT_CERTIFIED')
    expect(html).toContain('CERTIFIED')
    expect(html).toContain('Cora has not selected a winner')
    expect(html).toContain('authorized review process')
    expect(html).not.toMatch(/bg-green|text-green|success/i)
  })
  it('preserves revoked MATCHED as historical, not currently actionable', () => {
    const view = find('Revoked historical result')
    expect(view).toMatchObject({
      lifecycle: 'REVOKED',
      status: 'HISTORICAL_ONLY',
      actionable: false,
    })
    expect(view.technical.state).toBe('MATCHED')
    expect(view.permissions.status).toBe('NOT_AUTHORIZED')
    const html = render(view)
    expect(html).toContain('Historical technical result')
    expect(html).toContain('not currently actionable')
    expect(html).toContain('At the recorded check')
    expect(html).toContain('Use is not currently authorized')
  })
  it('links a permitted successor present in the gallery, without duplicate anchor IDs', () => {
    const old = find('Superseded historical workflow')
    const next = find('Successor workflow')
    expect(old.successorRunIds).toContain(next.runId)
    const html = renderToStaticMarkup(createElement(SyntheticWorkflowGallery, { journeys }))
    const target = `run-${encodeURIComponent(next.runId)}`
    expect(html).toContain(`href="#${target}"`)
    expect(html).toContain(`id="run-${next.runId}"`)
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)
    expect(render(old)).not.toContain(`href="#${target}"`)
  })
  it('shows stale, not-verified and expired current validity distinctly', () => {
    expect(render(find('Stale evidence'))).toContain('evidence is stale')
    expect(render(find('Technical match without recipient decision'))).toContain(
      'currentness has not been verified',
    )
    const expired = find('Expired historical context')
    expect(expired.currentCheckState).toBe('EXPIRED')
    expect(render(expired)).toContain('Current validity: <strong>EXPIRED</strong>')
    expect(expired.technical.state).toBe('MATCHED')
  })
  it('visually separates source, issuer, processing, requirement owner and decision authority', () => {
    const html = render(find('Technical match without recipient decision'))
    for (const label of [
      'Source system / provider',
      'Issuer / source authority',
      'Cora processing',
      'Requirement owner',
      'Recipient decision authority',
      'Cora technical check',
      'Recipient-owned decision',
    ]) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Cora does not own the institutional decision')
  })
  it('describes qualified reuse practically and keeps raw metrics in a closed disclosure', () => {
    const html = render(find('Additional evidence needed with governed reuse'))
    expect(html).toContain('reused from an earlier governed context')
    expect(html).toContain('No new source retrieval was required')
    expect(html).toContain('Additional institutional verification is still required')
    expect(html).toMatch(/<details><summary>Technical reuse and friction details<\/summary>/)
    const visible = html.replace(/<details>[\s\S]*?<\/details>/g, '')
    expect(visible).not.toMatch(/numerator|denominator|ratio|frictionDelta/)
  })
  it('does not describe a reconstructed attempt as successful reuse', () => {
    const view = find('Reconstruction is not qualified reuse')
    expect(view.reuse.qualification).toBe('INELIGIBLE')
    const html = render(view)
    expect(html).toContain('does not qualify as governed evidence reuse')
    expect(html).toContain('RECONSTRUCTION_AVOIDANCE_NOT_ESTABLISHED')
    expect(html).not.toContain('reused from an earlier governed context')
    expect(html).not.toContain('No new source retrieval was required')
  })
  it('hides raw rights by default while showing meaningful separate action permissions', () => {
    const html = render(find('Technical match without recipient decision'))
    expect(html).toMatch(/<details><summary>Technical permission details<\/summary>/)
    expect(html).not.toMatch(/<details[^>]*\sopen/)
    const visible = html.replace(/<details>[\s\S]*?<\/details>/g, '')
    expect(visible).not.toMatch(/retentionAfterDisconnect|rawRecipient|decisionRef/)
    expect(visible).toContain('Keep a copy: Not permitted or not established')
    expect(visible).toContain('Export: Not permitted or not established')
    expect(visible).toContain('Restore offline: Not permitted or not established')
  })
  it('uses native semantic headings and keyboard disclosures without connector controls', () => {
    const html = render(find('Technical match without recipient decision'))
    for (const heading of [
      'Overview',
      'Evidence and authority',
      'Permissions',
      'Requirement',
      'Reuse',
      'Decision',
      'Lineage',
    ]) {
      expect(html).toContain(`<h2>${heading}</h2>`)
    }
    expect(html).toContain('role="status"')
    expect(html).toContain('<summary>')
    expect(html).not.toMatch(
      /tabindex="-1"|<div[^>]*onclick|connect Deere|connect FieldView|OAuth|<input|<button/i,
    )
  })
})
