import { describe, expect, it } from 'vitest'
import { partitionFixtureEntries, planFixtureReset } from '../fixture-plan'

// DEF-0B10-PIL-CUPE-BOOTSTRAP-RESET-DELETES-ALL-GRIEVANCES-MEMBERS-AND-CHECKLIST-ROWS-OF-THE-ORGANIZATION-AT-THE-FIXTURE-SLUG-WITH-NO-DEMO-MARKER
describe('planFixtureReset', () => {
  const none = { members: 0, grievances: 0 }

  it('deletes exactly the rows the ledger names and the organization still holds', () => {
    const plan = planFixtureReset({
      ledger: { members: ['m1', 'm2'], grievances: ['g1'] },
      present: { members: ['m1', 'm2'], grievances: ['g1'] },
      foreign: none,
    })

    expect(plan.remove).toEqual({ members: ['m1', 'm2'], grievances: ['g1'] })
    expect(plan.refusal).toBeNull()
  })

  it('refuses when the organization holds a row the ledger does not name, however it is called', () => {
    const plan = planFixtureReset({
      ledger: { members: ['m1'], grievances: [] },
      present: { members: ['m1'], grievances: [] },
      foreign: { members: 2, grievances: 0 },
    })

    expect(plan.refusal).toEqual({ reason: 'foreign_rows' })
    expect(plan.foreign).toEqual({ members: 2, grievances: 0 })
  })

  it('refuses for a foreign grievance alone', () => {
    const plan = planFixtureReset({ ledger: { members: [], grievances: [] }, present: { members: [], grievances: [] }, foreign: { members: 0, grievances: 1 } })

    expect(plan.refusal).toEqual({ reason: 'foreign_rows' })
  })

  it('never plans to delete an id the ledger does not name, even if the caller reports it as present', () => {
    const plan = planFixtureReset({
      ledger: { members: ['m1'], grievances: ['g1'] },
      present: { members: ['m1', 'real-member'], grievances: ['g1', 'real-case'] },
      foreign: none,
    })

    expect(plan.remove).toEqual({ members: ['m1'], grievances: ['g1'] })
  })

  it('reports a ledger entry whose row is gone as stale, so the ledger stops claiming it', () => {
    const plan = planFixtureReset({
      ledger: { members: ['m1', 'm2'], grievances: ['g1'] },
      present: { members: ['m1'], grievances: [] },
      foreign: none,
    })

    expect(plan.remove).toEqual({ members: ['m1'], grievances: [] })
    expect(plan.stale).toEqual({ members: ['m2'], grievances: ['g1'] })
  })

  it('an organization with no ledger rows has nothing it can delete: an unmarked or pre-ledger organization is never adopted by its names', () => {
    const plan = planFixtureReset({
      ledger: { members: [], grievances: [] },
      present: { members: [], grievances: [] },
      foreign: { members: 13, grievances: 5 },
    })

    expect(plan.remove).toEqual({ members: [], grievances: [] })
    expect(plan.refusal).toEqual({ reason: 'foreign_rows' })
  })

  it('does not mistake the same id twice for two rows', () => {
    const plan = planFixtureReset({ ledger: { members: ['m1', 'm1'], grievances: [] }, present: { members: ['m1', 'm1'], grievances: [] }, foreign: none })

    expect(plan.remove.members).toEqual(['m1'])
  })
})

describe('partitionFixtureEntries', () => {
  const entry = (key: string) => ({ key })
  const keyOf = (value: { key: string }) => value.key

  it('creates what the organization does not hold and leaves what it holds alone', () => {
    const { create, alreadyPresent } = partitionFixtureEntries([entry('a'), entry('b'), entry('c')], keyOf, new Set(['b']))

    expect(create.map(keyOf)).toEqual(['a', 'c'])
    expect(alreadyPresent.map(keyOf)).toEqual(['b'])
  })

  it('creates a key repeated within the fixture once', () => {
    const { create, alreadyPresent } = partitionFixtureEntries([entry('a'), entry('a')], keyOf, new Set())

    expect(create).toHaveLength(1)
    expect(alreadyPresent).toHaveLength(1)
  })

  it('creates everything for an organization that holds nothing, and nothing for an empty fixture', () => {
    expect(partitionFixtureEntries([entry('a'), entry('b')], keyOf, new Set()).create).toHaveLength(2)
    expect(partitionFixtureEntries([], keyOf, new Set(['a']))).toEqual({ create: [], alreadyPresent: [] })
  })
})
