import { expect, it } from 'vitest'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Slice2Store, digest, type Options } from '../../src/slice2/store'
import {
  adversarialDirectory,
  repositoryRoot,
  storageDirectory,
} from '../../src/slice2/authorization'
import { guardLog, retain } from '../../src/slice2/harness'
import { proofOperations } from '../../src/slice1/scenario'

const contractPath = 'governance\\foundations\\civic-oci-doctrine.contract.json'
const operationsPath = 'docs\\public-service\\operations'

function fixture(kind: 'revoked' | 'terminated' | 'missing') {
  const name = `grant-${kind}-fixture-${Date.now()}`
  const root = join(adversarialDirectory, name)
  mkdirSync(join(root, 'governance', 'foundations'), { recursive: true })
  mkdirSync(join(root, operationsPath), { recursive: true })
  const contract = JSON.parse(readFileSync(join(repositoryRoot, contractPath), 'utf8')) as {
    runtimeAuthorization: { slice2?: Record<string, unknown> }
  }
  if (kind === 'missing') delete contract.runtimeAuthorization.slice2
  if (kind === 'revoked') contract.runtimeAuthorization.slice2!.revokedAt = new Date().toISOString()
  writeFileSync(join(root, contractPath), JSON.stringify(contract, null, 2) + '\n', { flag: 'wx' })
  for (const document of [
    'CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET.md',
    'CIVIC_RUNTIME_SLICE_0_PROOF.md',
    'CIVIC_RUNTIME_SLICE_1_PROOF.md',
  ])
    copyFileSync(
      join(repositoryRoot, operationsPath, document),
      join(root, operationsPath, document),
    )
  if (kind === 'terminated')
    writeFileSync(
      join(root, operationsPath, 'CIVIC_RUNTIME_SLICE_2_PROOF.md'),
      '# Synthetic deny-only termination fixture; not canonical governance\n\n**Authorization terminated:** YES\n',
      { flag: 'wx' },
    )
  return { name, root }
}

it.each(['revoked', 'terminated', 'missing'] as const)(
  'propagates deny-only %s grant fixture through new/existing admission and precommit without substituting a successful guard',
  (kind) => {
    const canonicalBefore = readFileSync(join(repositoryRoot, contractPath))
    const target = fixture(kind)
    const id = `grant-lifecycle-${Date.now()}-${kind}`
    const { s, operations } = proofOperations('A')
    const options: Options = {}
    const callsBefore = guardLog().length
    const store = new Slice2Store(`${id}.sqlite`, options)
    const errors: { boundary: string; error: string }[] = []
    const denied = (boundary: string, run: () => unknown) => {
      let observed: unknown
      try {
        run()
      } catch (error) {
        observed = error
      }
      expect(String(observed)).toContain('DENY_ONLY_SYNTHETIC_GRANT_FIXTURE')
      expect(String(observed)).toContain(
        kind === 'revoked'
          ? 'grant mismatch or revoked'
          : kind === 'terminated'
            ? 'Slice 2 authorization terminated'
            : 'no scoped Slice 2 grant',
      )
      errors.push({ boundary, error: String(observed) })
    }
    try {
      store.create(s.seed)
      store.submit(s.principal, operations[0], 'authorize', 1)
      const before = store.read(s.principal)
      options.denyOnlyGrantFixture = target.name
      denied(
        'new-instance',
        () => new Slice2Store(`${id}-new.sqlite`, { denyOnlyGrantFixture: target.name }),
      )
      expect(existsSync(join(storageDirectory, `${id}-new.sqlite`))).toBe(false)
      denied('existing-read-admission', () => store.read(s.principal))
      denied('existing-command-admission', () =>
        store.submit(s.principal, operations.at(-1)!, 'lifecycle-denial', 2),
      )
      delete options.denyOnlyGrantFixture
      options.hook = (stage) => {
        if (stage === 'precommit') options.denyOnlyGrantFixture = target.name
      }
      denied('after-admission-before-commit', () =>
        store.submit(s.principal, operations.at(-1)!, 'lifecycle-denial', 2),
      )
      denied('same-key-retry-while-denied', () =>
        store.submit(s.principal, operations.at(-1)!, 'lifecycle-denial', 2),
      )
      delete options.denyOnlyGrantFixture
      delete options.hook
      const after = store.read(s.principal)
      expect(after.version).toBe(2)
      expect(after.state.decisions).toHaveLength(0)
      expect(digest(after.state)).toBe(digest(before.state))
      const retry = store.submit(s.principal, operations.at(-1)!, 'lifecycle-denial', 2)
      expect(retry.replay).toBe(false)
      expect(retry.sequence).toBe(3)
      expect(readFileSync(join(repositoryRoot, contractPath))).toEqual(canonicalBefore)
      retain(`${id}-results.json`, {
        classification: 'DENY_ONLY_SYNTHETIC_GRANT_FIXTURE_ACTUAL_CANONICAL_GUARD_ALWAYS_REQUIRED',
        fixture: target,
        errors,
        beforeVersion: before.version,
        rolledBackVersion: after.version,
        stateUnchanged: digest(before.state) === digest(after.state),
        canonicalContractUnchanged: true,
        successfulActualCanonicalRetryAfterRemovingFixture: retry,
        authorizationCalls: guardLog().slice(callsBefore),
        humanAcceptance: 'NOT_CLAIMED',
      })
    } finally {
      store.close()
    }
  },
)
