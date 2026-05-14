/**
 * Institutional Chronology — protected-kind projection guard.
 *
 * Asserts that every projected chronology collection produced by
 * `getInstitutionalChronologyView` passes the IGG projection fence.
 */

import { describe, expect, it } from 'vitest'

import { assertNoProtectedKindsInProjections } from '@nzila/institutional-governance-graph'

import { getInstitutionalChronologyView } from '../source'

describe('institutional-chronology projection guard', () => {
  it('every chronology projection passes assertNoProtectedKindsInProjections', async () => {
    const view = await getInstitutionalChronologyView()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.proceduralTimeline.entries,
        'institutional-chronology.proceduralTimeline',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.epochs,
        'institutional-chronology.epochs',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.evolution.organizations.flatMap((o) => o.entries),
        'institutional-chronology.evolution.organizations',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.evolution.affiliations.flatMap((a) => a.entries),
        'institutional-chronology.evolution.affiliations',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.evolution.representations.flatMap((r) => r.entries),
        'institutional-chronology.evolution.representations',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.continuity.flatMap((c) => c.entries),
        'institutional-chronology.continuity',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.lineage.flatMap((l) =>
          l.decisionTimelines.flatMap((timeline) => timeline.entries),
        ),
        'institutional-chronology.lineage.decisionTimelines',
      ),
    ).not.toThrow()

    expect(() =>
      assertNoProtectedKindsInProjections(
        view.explainability.map((record) => ({
          category: record.category,
          summary: record.summary,
        })),
        'institutional-chronology.explainability',
      ),
    ).not.toThrow()
  })

  it('view exposes integer substrate counts and ISO generatedAt', async () => {
    const view = await getInstitutionalChronologyView()
    expect(Number.isInteger(view.substrate.nodes)).toBe(true)
    expect(Number.isInteger(view.substrate.edges)).toBe(true)
    expect(Number.isInteger(view.substrate.decisions)).toBe(true)
    expect(() => new Date(view.generatedAt).toISOString()).not.toThrow()
  })
})
