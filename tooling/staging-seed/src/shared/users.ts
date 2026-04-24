import type { SeedRng, SeedTime } from '../core/types'
import type { SyntheticOrganization } from './organizations'
import type { SyntheticPerson } from './people'

const USER_ROLES = ['admin', 'manager', 'member', 'analyst', 'viewer'] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface SyntheticUser {
  readonly id: string
  readonly orgId: string
  readonly personId: string
  readonly email: string
  readonly role: UserRole
  readonly active: boolean
  readonly lastLoginAt: string | null
  readonly createdAt: string
}

export interface FakeUsersArgs {
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly people: readonly SyntheticPerson[]
  readonly organizations: readonly SyntheticOrganization[]
  readonly count: number
}

/**
 * Build users by attaching people to organizations. The first user in each
 * org is forced to `admin` so org-scoped permissions tests work.
 */
export function fakeUsers(args: FakeUsersArgs): SyntheticUser[] {
  const { rng, time, people, organizations, count } = args
  if (organizations.length === 0) {
    throw new Error('fakeUsers: at least one organization is required')
  }
  if (people.length === 0) {
    throw new Error('fakeUsers: at least one person is required')
  }

  const adminPlaced = new Set<string>()
  const users: SyntheticUser[] = []
  for (let i = 0; i < count; i++) {
    const person = people[i % people.length]!
    const org = organizations[i % organizations.length]!
    const isFirstForOrg = !adminPlaced.has(org.id)
    if (isFirstForOrg) adminPlaced.add(org.id)
    const role: UserRole = isFirstForOrg ? 'admin' : rng.pick(USER_ROLES)
    const active = rng.boolean(0.92)
    users.push({
      id: rng.id('user'),
      orgId: org.id,
      personId: person.id,
      email: person.email,
      role,
      active,
      lastLoginAt: active ? time.daysAgo(rng.intBetween(0, 14)).toISOString() : null,
      createdAt: time.daysAgo(rng.intBetween(0, 365)).toISOString(),
    })
  }
  return users
}
