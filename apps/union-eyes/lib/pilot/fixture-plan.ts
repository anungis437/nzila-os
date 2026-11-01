/**
 * What a bootstrap of a fixture organization may touch.
 *
 * A reset deletes exactly the member and grievance rows the origin ledger names (lib/pilot/fixture-bootstrap.ts records a row the moment the
 * bootstrap creates it). A row that is not in the ledger is not fixture data, whatever it is called or whatever a fixture file says, and its
 * presence refuses the reset. The fixture file is an input to seeding; it is never evidence about which rows are disposable.
 *
 * An organization seeded before the ledger existed has no marker and no ledger rows, so nothing in it can be proven disposable: the bootstrap
 * refuses it instead of guessing. That is deliberate: the demo is realigned to the application, not the other way round.
 */
export interface FixtureResetInput {
  /** Row ids the bootstrap recorded creating. */
  ledger: { members: readonly string[]; grievances: readonly string[] }
  /** The ledger ids whose row the organization still holds. */
  present: { members: readonly string[]; grievances: readonly string[] }
  /** Rows the organization holds that the ledger does not name. */
  foreign: { members: number; grievances: number }
}

export interface FixtureResetPlan {
  /** Rows a reset deletes: held and named by the ledger. */
  remove: { members: string[]; grievances: string[] }
  /** Ledger entries whose row no longer exists; a reset clears them so the ledger never claims a row that is gone. */
  stale: { members: string[]; grievances: string[] }
  /** Rows the organization holds that the bootstrap did not create; any of them refuses a reset. */
  foreign: { members: number; grievances: number }
  refusal: { reason: 'foreign_rows' } | null
}

function removable(ledger: readonly string[], present: readonly string[]) {
  const named = new Set(ledger)
  const held = new Set(present)
  return {
    remove: [...held].filter((id) => named.has(id)),
    stale: [...named].filter((id) => !held.has(id)),
  }
}

export function planFixtureReset(input: FixtureResetInput): FixtureResetPlan {
  const members = removable(input.ledger.members, input.present.members)
  const grievances = removable(input.ledger.grievances, input.present.grievances)
  const foreign = { members: input.foreign.members, grievances: input.foreign.grievances }
  return {
    remove: { members: members.remove, grievances: grievances.remove },
    stale: { members: members.stale, grievances: grievances.stale },
    foreign,
    refusal: foreign.members + foreign.grievances > 0 ? { reason: 'foreign_rows' } : null,
  }
}

/** Splits fixture entries into those to create and those the organization already holds; a duplicated key within the fixture is created once. */
export function partitionFixtureEntries<T>(
  entries: readonly T[],
  keyOf: (entry: T) => string,
  taken: ReadonlySet<string>,
): { create: T[]; alreadyPresent: T[] } {
  const seen = new Set<string>()
  const create: T[] = []
  const alreadyPresent: T[] = []
  for (const entry of entries) {
    const key = keyOf(entry)
    if (taken.has(key) || seen.has(key)) {
      alreadyPresent.push(entry)
      continue
    }
    seen.add(key)
    create.push(entry)
  }
  return { create, alreadyPresent }
}
