/**
 * Institutional Topology — protected-kind projection guard.
 *
 * Asserts that every projected view produced by `getInstitutionalTopologyView`
 * passes the IGG `assertNoProtectedKindsInProjections` fence. The placeholder
 * substrate is empty today, but wiring this guard now means any future
 * substrate adapter will hit the fence at test time before it can surface a
 * protected category, kind, or summary token in this read surface.
 */

import { describe, expect, it } from 'vitest'

import { assertNoProtectedKindsInProjections } from '@nzila/organizational-governance-graph'

import {
  getInstitutionalGraph,
  getInstitutionalTopologyView,
} from '../source'

describe('organizational-topology projection guard', () => {
  it('placeholder graph is empty and well-typed', async () => {
    const raw = await getInstitutionalGraph()
    expect(raw.nodes).toEqual([])
    expect(raw.edges).toEqual([])
    expect(raw.decisions).toEqual([])
  })

  it('every projected view passes assertNoProtectedKindsInProjections', async () => {
    const view = await getInstitutionalTopologyView()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.continuityTopology,
        'organizational-topology.continuityTopology',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.hierarchy.map((h) => ({ kind: h.iggKind })),
        'organizational-topology.hierarchy',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.affiliationRepresentation.edges.map((e) => ({
          kind: e.relationship,
        })),
        'organizational-topology.affiliationEdges',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.delegation.map((d) => ({ kind: d.state })),
        'organizational-topology.delegation',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.lineage.map((l) => ({ summary: l.chain.join(' ') })),
        'organizational-topology.lineage',
      ),
    ).not.toThrow()
  })

  it('view exposes integer substrate counts and ISO generatedAt', async () => {
    const view = await getInstitutionalTopologyView()
    expect(Number.isInteger(view.substrate.nodes)).toBe(true)
    expect(Number.isInteger(view.substrate.edges)).toBe(true)
    expect(Number.isInteger(view.substrate.decisions)).toBe(true)
    expect(() => new Date(view.generatedAt).toISOString()).not.toThrow()
  })
})
