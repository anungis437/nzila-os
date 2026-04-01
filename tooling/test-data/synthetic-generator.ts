/**
 * Nzila OS — Synthetic Test Data Generator
 * iSSDLC W2-8: PII-free synthetic data for test fixtures
 *
 * Generates realistic but completely synthetic union/labour data
 * with no real member information. All names, SINs, addresses,
 * and identifiers are fabricated.
 *
 * Usage: pnpm tsx tooling/test-data/synthetic-generator.ts [count] [output]
 */
import { randomUUID, randomInt } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Synthetic data pools ─────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper', 'Hayden', 'Jamie',
  'Kendall', 'Logan', 'Mackenzie', 'Parker', 'Peyton', 'Reese', 'Rowan', 'Sage',
]

const LAST_NAMES = [
  'Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris',
  'Jackson', 'Kim', 'Lee', 'Martinez', 'Nelson', 'Okafor', 'Patel', 'Quinn',
  'Robinson', 'Singh', 'Thompson', 'Wang', 'Williams', 'Young', 'Zhang', 'Chen',
]

const EMPLOYERS = [
  'Northern Manufacturing Inc.', 'Prairie Health Services',
  'Atlantic Logistics Corp.', 'Maple Ridge Construction',
  'Pacific Coast Hotel Group', 'Central Education Board',
  'Maritime Transport Ltd.', 'Mountain View Mining Co.',
]

const GRIEVANCE_TYPES = [
  'wage_dispute', 'wrongful_termination', 'safety_violation', 'discrimination',
  'overtime_denial', 'seniority_dispute', 'benefit_denial', 'scheduling_conflict',
]

const PROVINCES = ['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL']

const CBA_TITLES = [
  'Collective Bargaining Agreement 2024-2027',
  'Collective Agreement — Local 123',
  'Master Agreement — Northern Regional',
  'Provincial Framework Agreement 2025-2028',
]

// ── Generators ───────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[randomInt(arr.length)]
}

function syntheticSIN(): string {
  // Generates a fake SIN (900-series, never valid)
  return `9${randomInt(10)}${randomInt(10)}-${randomInt(10)}${randomInt(10)}${randomInt(10)}-${randomInt(10)}${randomInt(10)}${randomInt(10)}`
}

function syntheticEmail(first: string, last: string): string {
  return `${first.toLowerCase()}.${last.toLowerCase()}${randomInt(100)}@example.test`
}

function syntheticPhone(): string {
  return `555-${String(randomInt(1000)).padStart(3, '0')}-${String(randomInt(10000)).padStart(4, '0')}`
}

function syntheticDate(yearRange: [number, number]): string {
  const year = yearRange[0] + randomInt(yearRange[1] - yearRange[0])
  const month = String(randomInt(12) + 1).padStart(2, '0')
  const day = String(randomInt(28) + 1).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Record generators ────────────────────────────────────────────────────────

export interface SyntheticMember {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  sin: string
  employerId: string
  employer: string
  province: string
  localNumber: number
  memberSince: string
  status: 'active' | 'inactive' | 'retired'
}

export interface SyntheticGrievance {
  id: string
  memberId: string
  type: string
  title: string
  description: string
  filedDate: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  province: string
}

export function generateMember(): SyntheticMember {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  return {
    id: randomUUID(),
    firstName: first,
    lastName: last,
    email: syntheticEmail(first, last),
    phone: syntheticPhone(),
    sin: syntheticSIN(),
    employerId: randomUUID(),
    employer: pick(EMPLOYERS),
    province: pick(PROVINCES),
    localNumber: randomInt(100, 999),
    memberSince: syntheticDate([2010, 2025]),
    status: pick(['active', 'active', 'active', 'inactive', 'retired']),
  }
}

export function generateGrievance(memberId?: string): SyntheticGrievance {
  const type = pick(GRIEVANCE_TYPES)
  return {
    id: randomUUID(),
    memberId: memberId ?? randomUUID(),
    type,
    title: `${type.replace(/_/g, ' ')} — Synthetic case #${randomInt(10000)}`,
    description: `This is a synthetic test grievance for ${type.replace(/_/g, ' ')}. No real member data is contained in this record.`,
    filedDate: syntheticDate([2024, 2026]),
    priority: pick(['low', 'medium', 'medium', 'high', 'critical']),
    status: pick(['open', 'in_progress', 'resolved', 'closed']),
    province: pick(PROVINCES),
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  /\b\d{3}-\d{3}-\d{3}\b/,           // Real SIN format (not 9xx)
  /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/,    // Postal code
  /\b\d{3}-\d{2}-\d{4}\b/,           // SSN
]

export function validateNoPII(data: string): { clean: boolean; violations: string[] } {
  const violations: string[] = []
  for (const pattern of PII_PATTERNS) {
    const match = data.match(pattern)
    if (match && !match[0].startsWith('9')) {
      violations.push(`Potential PII detected: ${match[0]}`)
    }
  }
  return { clean: violations.length === 0, violations }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const count = parseInt(process.argv[2] ?? '100', 10)
  const outputDir = process.argv[3] ?? join(__dirname, '..', '..', 'fixtures', 'synthetic')

  const members = Array.from({ length: count }, () => generateMember())
  const grievances = members.flatMap(m =>
    Array.from({ length: randomInt(1, 4) }, () => generateGrievance(m.id))
  )

  const { mkdirSync } = require('node:fs')
  mkdirSync(outputDir, { recursive: true })

  writeFileSync(join(outputDir, 'members.json'), JSON.stringify(members, null, 2))
  writeFileSync(join(outputDir, 'grievances.json'), JSON.stringify(grievances, null, 2))

  // Validate no PII leaked
  const allData = JSON.stringify({ members, grievances })
  const validation = validateNoPII(allData)
  if (!validation.clean) {
    console.error('⚠️ PII validation failed:', validation.violations)
    process.exit(1)
  }

  console.log(`✅ Generated ${members.length} synthetic members + ${grievances.length} grievances`)
  console.log(`   Output: ${outputDir}`)
  console.log('   PII validation: CLEAN')
}
