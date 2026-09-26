import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CIVIC_OCI_CONTRACT_PATH,
  validateCivicOciDoctrine,
} from '../../scripts/lib/civic-oci-doctrine'

const ROOT = join(__dirname, '..', '..')
const FIXTURE_PATHS = [
  CIVIC_OCI_CONTRACT_PATH,
  'apps/civic',
  'apps/union-eyes/lib/oci/frameworks/index.ts',
  'docs/CIVIC_OCI_ALIGNMENT.md',
  'docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md',
  'docs/oci/CANON.md',
  'docs/oci/OCI_AI_BOUNDARY.md',
  'docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md',
  'docs/oci/OCI_METHOD.md',
  'docs/oci/README.md',
  'docs/oci/SUPERSEDED.md',
  'docs/public-service/civic-faq.md',
  'docs/public-service/civic-one-page-brief.md',
  'docs/public-service/civic-thesis.md',
  'docs/public-service/clear-method-canonical.md',
  'docs/public-service/forwardable/civic-one-page-brief-executive.md',
  'docs/public-service/human-review-and-evidence-principles.md',
  'governance/portfolio/product-catalog.json',
]

const fixtures: string[] = []

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'civic-oci-doctrine-'))
  fixtures.push(root)
  for (const artifact of FIXTURE_PATHS) {
    const source = join(ROOT, artifact)
    const target = join(root, artifact)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(source, target, { recursive: true })
  }
  return root
}

function mutateText(root: string, artifact: string, mutate: (value: string) => string): void {
  const path = join(root, artifact)
  writeFileSync(path, mutate(readFileSync(path, 'utf8')))
}

function mutateContract(root: string, mutate: (value: Record<string, any>) => void): void {
  const path = join(root, CIVIC_OCI_CONTRACT_PATH)
  const contract = JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>
  mutate(contract)
  writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`)
}

function ids(root: string): string[] {
  return validateCivicOciDoctrine(root).map((item) => item.id)
}

afterEach(() => {
  while (fixtures.length > 0) rmSync(fixtures.pop()!, { recursive: true, force: true })
})

describe('CIVIC / OCI doctrine integrity', () => {
  it('passes the current canonical repository state', () => {
    expect(validateCivicOciDoctrine(ROOT)).toEqual([])
  })

  it('rejects CIVIC becoming an independent methodology', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.identity.civicRole = 'independent-methodology'
    })
    expect(ids(root)).toContain('CIVIC_METHOD_AUTHORITY_DRIFT')
  })

  it('reports a malformed contract without throwing', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      delete contract.identity.authority
    })
    expect(ids(root)).toEqual(['CIVIC_CONTRACT_INVALID'])
  })

  it('rejects a CIVIC-owned scoring dimension', () => {
    const root = createFixture()
    mutateText(
      root,
      'docs/public-service/civic-thesis.md',
      (value) => `${value}\nCIVIC introduces the institutional velocity scoring dimension.\n`,
    )
    expect(ids(root)).toContain('CIVIC_INDEPENDENT_SCORING_DRIFT')
  })

  it('rejects an OCI phase mutation when canonical method authority is unchanged', () => {
    const root = createFixture()
    mutateText(root, 'apps/union-eyes/lib/oci/frameworks/index.ts', (value) =>
      value.replace("name: 'Recognition'", "name: 'Diagnosis'"),
    )
    expect(ids(root)).toContain('OCI_METHOD_STRUCTURE_DRIFT')
  })

  it('rejects autonomous institutional decision authority for AI', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.humanAuthority.autonomousInstitutionalDecisioningPermitted = true
    })
    expect(ids(root)).toContain('CIVIC_HUMAN_AUTHORITY_DRIFT')
  })

  it('rejects removing behavioural profiling from the AI prohibitions', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.aiBoundary.prohibited = contract.aiBoundary.prohibited.filter(
        (item: string) => item !== 'behavioural-inference',
      )
    })
    expect(ids(root)).toContain('CIVIC_AI_BOUNDARY_DRIFT')
  })

  it('rejects removal of canonical human-review authority', () => {
    const root = createFixture()
    mutateText(root, 'docs/public-service/human-review-and-evidence-principles.md', (value) =>
      value.replace('human review remains authoritative', 'automation remains authoritative'),
    )
    expect(ids(root)).toContain('CIVIC_HUMAN_AUTHORITY_DRIFT')
  })

  it('rejects permitting institutional leaderboards', () => {
    const root = createFixture()
    mutateContract(root, (contract) => {
      contract.antiSurveillance.prohibited = contract.antiSurveillance.prohibited.filter(
        (item: string) => item !== 'institutional-leaderboards',
      )
    })
    expect(ids(root)).toContain('CIVIC_ANTI_SURVEILLANCE_DRIFT')
  })

  it('rejects active-pilot claims while portfolio authority remains pre-product', () => {
    const root = createFixture()
    mutateText(
      root,
      'docs/public-service/civic-one-page-brief.md',
      (value) => `${value}\nCIVIC now offers an active pilot for departments.\n`,
    )
    expect(ids(root)).toContain('CIVIC_FRONT_DOOR_POSTURE_DRIFT')
  })

  it('rejects runtime source while runtime authorization remains false', () => {
    const root = createFixture()
    const runtime = join(root, 'apps/civic/src/index.ts')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, 'export const civicRuntime = true\n')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('rejects a CIVIC route introduced through another application', () => {
    const root = createFixture()
    const runtime = join(root, 'apps/union-eyes/app/[locale]/civic/page.tsx')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, 'export default function CivicPage() { return null }\n')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('rejects a CIVIC package alias introduced through another application', () => {
    const root = createFixture()
    const runtime = join(root, 'apps/platform-admin/civic/package.json')
    mkdirSync(dirname(runtime), { recursive: true })
    writeFileSync(runtime, '{"scripts":{"start":"next start"}}\n')
    expect(ids(root)).toContain('CIVIC_RUNTIME_UNAUTHORIZED')
  })

  it('allows non-runtime CIVIC governance metadata outside the placeholder', () => {
    const root = createFixture()
    const metadata = join(root, 'apps/union-eyes/docs/civic/decision-record.json')
    mkdirSync(dirname(metadata), { recursive: true })
    writeFileSync(metadata, '{"runtime":false,"status":"rejected"}\n')
    expect(validateCivicOciDoctrine(root)).toEqual([])
  })

  it('ignores historical doctrine even when it contains obsolete claims', () => {
    const root = createFixture()
    const historical = join(root, 'docs/oci/superseded/old-method.md')
    mkdirSync(dirname(historical), { recursive: true })
    writeFileSync(
      historical,
      'CIVIC is an independent methodology with autonomous rankings and active pilots.\n',
    )
    expect(validateCivicOciDoctrine(root)).toEqual([])
  })

  it('does not apply first-touch restrictions to OCI technical material', () => {
    const root = createFixture()
    mutateText(
      root,
      'docs/oci/OCI_METHOD.md',
      (value) => `${value}\nTechnical procurement may request an OCI assessment or pilot.\n`,
    )
    expect(validateCivicOciDoctrine(root)).toEqual([])
  })

  it('allows additional non-runtime governance metadata in the CIVIC placeholder', () => {
    const root = createFixture()
    writeFileSync(
      join(root, 'apps/civic/decision-record.json'),
      '{"status":"placeholder","runtime":false}\n',
    )
    expect(validateCivicOciDoctrine(root)).toEqual([])
  })
})
