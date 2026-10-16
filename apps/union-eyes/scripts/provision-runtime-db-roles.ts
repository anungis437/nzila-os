#!/usr/bin/env tsx
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildPlan,
  rejectSecretFields,
  safeFailure,
  specifications,
  verifySnapshot,
  ProvisioningError,
  type BindingPacket,
  type BootstrapContract,
  type Snapshot,
  type TargetContract,
} from './provisioning/governed-provisioning'

export * from './provisioning/governed-provisioning'

export function main(args: string[]): void {
  if (args.length === 0)
    throw new ProvisioningError('EXPLICIT_PLAN_OR_VERIFY_MODE_REQUIRED_NO_IMPLICIT_APPLY')
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const folder = path.join(root, 'docs', 'union-eyes', 'reality-remediation')
  const canonical: BootstrapContract = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json'), 'utf8'),
  )
  const target: TargetContract = JSON.parse(
    readFileSync(path.join(folder, 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json'), 'utf8'),
  )
  const flags = new Map<string, string | true>()
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (
      !['--plan', '--apply', '--verify', '--bindings', '--scope', '--snapshot'].includes(flag) ||
      flags.has(flag)
    )
      throw new ProvisioningError('INVALID_PROVISIONING_ARGUMENTS')
    if (['--bindings', '--scope', '--snapshot'].includes(flag)) {
      const value = args[++index]
      if (!value || value.startsWith('--'))
        throw new ProvisioningError('MISSING_PROVISIONING_ARGUMENT')
      flags.set(flag, value)
    } else flags.set(flag, true)
  }
  if (
    [...flags.keys()].filter((key) => ['--plan', '--apply', '--verify'].includes(key)).length !== 1
  )
    throw new ProvisioningError('SELECT_ONE_PROVISIONING_MODE')
  if (flags.has('--apply'))
    throw new ProvisioningError('APPLY_REQUIRES_APPROVED_GOVERNANCE_AND_W8_ADAPTER_NOT_AUTHORIZED')
  const specification = specifications(canonical, target)
  if (!flags.has('--bindings')) {
    if (flags.has('--verify') || flags.has('--scope') || flags.has('--snapshot'))
      throw new ProvisioningError('EXPLICIT_BINDINGS_AND_SCOPE_REQUIRED')
    console.log(
      JSON.stringify(
        {
          MODE: 'UNBOUND_OFFLINE_PLAN',
          ...specification,
          EXECUTION_ALLOWED: 'NO',
          PRINCIPAL_BINDINGS_REQUIRED: true,
        },
        null,
        2,
      ),
    )
    return
  }
  const scope = flags.get('--scope')
  if (scope !== 'UE_OPERATIONAL' && scope !== 'FINANCIAL_SERVICE')
    throw new ProvisioningError('EXPLICIT_DATABASE_SCOPE_REQUIRED')
  const bindingFile = flags.get('--bindings')
  if (typeof bindingFile !== 'string') throw new ProvisioningError('BINDING_PATH_REQUIRED')
  const bindings: BindingPacket = JSON.parse(readFileSync(bindingFile, 'utf8'))
  rejectSecretFields(bindings)
  const plan = buildPlan(scope, bindings, canonical, target)
  if (flags.has('--verify')) {
    const snapshotFile = flags.get('--snapshot')
    if (typeof snapshotFile !== 'string')
      throw new ProvisioningError('OFFLINE_VERIFY_REQUIRES_SNAPSHOT_LIVE_ADAPTER_OWNER_W8')
    const snapshot: Snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'))
    rejectSecretFields(snapshot)
    verifySnapshot(plan, snapshot)
    console.log(
      JSON.stringify({ MODE: 'OFFLINE_DESCRIPTOR_VERIFY', STATUS: 'PASS', RUNTIME_PROVEN: 'NO' }),
    )
  } else {
    if (flags.has('--snapshot')) throw new ProvisioningError('SNAPSHOT_ONLY_VALID_FOR_VERIFY')
    console.log(
      JSON.stringify({ MODE: 'BOUND_OFFLINE_PLAN', plan, EXECUTION_ALLOWED: 'NO' }, null, 2),
    )
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`[provision-runtime-db-roles] ${safeFailure(error)}`)
    process.exitCode = 1
  }
}
