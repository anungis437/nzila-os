#!/usr/bin/env npx tsx
/**
 * validate-ga-state
 *
 * Enforces a single machine-readable GA certification source of truth
 * and ensures human-readable GA documents do not over-claim status.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type CertificationState = {
  version: number
  state: 'PENDING_RED_TEAM' | 'CERTIFIED' | 'BLOCKED'
  lastUpdated: string
  requirements: {
    hardGatesPassed: boolean
    redTeamExecuted: boolean
    certificationSigned: boolean
  }
  evidence: {
    gateDoc: string
    certificationReport: string
  }
}

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Cannot locate repo root')
}

function assertCondition(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function parseState(path: string): CertificationState {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<CertificationState>
  assertCondition(raw.version === 1, 'governance/ga/certification-state.json must have version=1')
  assertCondition(raw.state === 'PENDING_RED_TEAM' || raw.state === 'CERTIFIED' || raw.state === 'BLOCKED', 'Invalid certification state')
  assertCondition(typeof raw.lastUpdated === 'string' && raw.lastUpdated.length > 0, 'Missing lastUpdated')
  assertCondition(raw.requirements, 'Missing requirements object')
  assertCondition(typeof raw.requirements?.hardGatesPassed === 'boolean', 'Missing requirements.hardGatesPassed')
  assertCondition(typeof raw.requirements?.redTeamExecuted === 'boolean', 'Missing requirements.redTeamExecuted')
  assertCondition(typeof raw.requirements?.certificationSigned === 'boolean', 'Missing requirements.certificationSigned')
  assertCondition(raw.evidence?.gateDoc && raw.evidence?.certificationReport, 'Missing evidence doc pointers')

  return raw as CertificationState
}

function main(): void {
  const root = findRepoRoot()
  const statePath = join(root, 'governance', 'ga', 'certification-state.json')
  const state = parseState(statePath)

  const gateDoc = readFileSync(join(root, state.evidence.gateDoc), 'utf8')
  const reportDoc = readFileSync(join(root, state.evidence.certificationReport), 'utf8')

  const failures: string[] = []

  if (state.state === 'PENDING_RED_TEAM') {
    if (!state.requirements.hardGatesPassed) {
      failures.push('PENDING_RED_TEAM requires requirements.hardGatesPassed=true')
    }
    if (state.requirements.redTeamExecuted) {
      failures.push('PENDING_RED_TEAM requires requirements.redTeamExecuted=false')
    }
    if (state.requirements.certificationSigned) {
      failures.push('PENDING_RED_TEAM requires requirements.certificationSigned=false')
    }

    if (!gateDoc.includes('FINAL CERTIFICATION PENDING RED TEAM EXECUTION')) {
      failures.push('GA readiness gate doc must include explicit pending red-team statement for PENDING_RED_TEAM state')
    }

    if (!reportDoc.includes('Status: INCOMPLETE')) {
      failures.push('GA certification report must remain INCOMPLETE while state=PENDING_RED_TEAM')
    }
  }

  if (state.state === 'CERTIFIED') {
    if (!state.requirements.hardGatesPassed || !state.requirements.redTeamExecuted || !state.requirements.certificationSigned) {
      failures.push('CERTIFIED requires all requirements booleans set to true')
    }

    if (reportDoc.includes('Status: INCOMPLETE')) {
      failures.push('GA certification report cannot be INCOMPLETE while state=CERTIFIED')
    }
  }

  if (state.state === 'BLOCKED') {
    if (!gateDoc.includes('NO-GO') && !gateDoc.includes('BLOCK')) {
      failures.push('GA readiness gate should explicitly indicate a blocking status when state=BLOCKED')
    }
  }

  console.log('\nGA Certification State Validation\n')
  console.log(`State: ${state.state}`)
  console.log(`Last updated: ${state.lastUpdated}`)

  if (failures.length === 0) {
    console.log('PASS: GA state and documentation are coherent')
    return
  }

  for (const failure of failures) {
    console.log(`ERROR ${failure}`)
  }

  process.exit(1)
}

main()
