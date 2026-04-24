import type { SeedRng, SeedTime } from '../core/types'

const FIRST_NAMES = [
  'Aisha', 'Bongani', 'Chen', 'Dineo', 'Emeka', 'Fatima', 'Gabriel', 'Hana',
  'Ibrahim', 'Jiro', 'Kwame', 'Lerato', 'Mei', 'Nia', 'Omar', 'Priya',
  'Quentin', 'Rashida', 'Sipho', 'Thandi', 'Uche', 'Valentina', 'Wangari',
  'Xolani', 'Yara', 'Zanele', 'Amara', 'Rohan', 'Sade', 'Marcus',
] as const

const LAST_NAMES = [
  'Adeyemi', 'Banda', 'Chen', 'Dlamini', 'Eze', 'Fofana', 'Gomez', 'Hassan',
  'Iwu', 'Jansen', 'Khumalo', 'Lopez', 'Mokoena', 'Ndlovu', 'Okonkwo',
  'Patel', 'Quintero', 'Reyes', 'Singh', 'Tshabalala', 'Umeh', 'Volkov',
  'Williams', 'Xaba', 'Yamada', 'Zulu', 'Mthembu', 'Naidu', 'Brown', 'Garcia',
] as const

const ROLES = [
  'Member', 'Steward', 'Officer', 'Operator', 'Manager', 'Director',
  'Founder', 'Analyst', 'Coordinator', 'Specialist',
] as const

export interface SyntheticPerson {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly fullName: string
  readonly email: string
  readonly role: string
  readonly createdAt: string
}

export function fakePerson(rng: SeedRng, time: SeedTime): SyntheticPerson {
  const firstName = rng.pick(FIRST_NAMES)
  const lastName = rng.pick(LAST_NAMES)
  const id = rng.id('person')
  const slug = `${firstName}.${lastName}.${id.slice(-4)}`.toLowerCase()
  const window = time.historyWindow()
  const ageDays = rng.intBetween(
    0,
    Math.max(1, Math.floor((window.end.getTime() - window.start.getTime()) / 86_400_000)),
  )
  return {
    id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${slug}@nzila-staging.example.com`,
    role: rng.pick(ROLES),
    createdAt: time.daysAgo(ageDays).toISOString(),
  }
}

export function fakePeople(
  rng: SeedRng,
  time: SeedTime,
  count: number,
): SyntheticPerson[] {
  return Array.from({ length: count }, () => fakePerson(rng, time))
}
