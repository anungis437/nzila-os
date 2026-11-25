#!/usr/bin/env node
/** Exports or checks the Union Eyes Playwright runtime contract. Values are masked, never printed. */
import { appendFileSync, readFileSync } from 'node:fs'
import {
  E2E_CONTRACT_SECRETS,
  contractEnvFromRuntime,
  githubEnvLines,
  probeContractPorts,
  readOwnedServiceBindings,
  validateE2eRuntimeContract,
} from './lib/ue-e2e-runtime-contract.mjs'

function mask(env) {
  for (const name of E2E_CONTRACT_SECRETS) {
    console.log(`::add-mask::${env[name]}`)
    if (env[name].startsWith('postgresql:')) console.log(`::add-mask::${new URL(env[name]).password}`)
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode !== 'export' && mode !== 'check') throw new Error('E2E runtime contract mode must be export or check')
  const { operatorDatabaseUrl, runtimeEnv, AZURITE_FIXTURE_KEY } = await import('./ue-runtime-up.mjs')
  if (mode === 'check') {
    validateE2eRuntimeContract(process.env, { azuriteKey: AZURITE_FIXTURE_KEY, requireFixture: true })
    readOwnedServiceBindings(`${process.env.UE_RUNTIME_STATE_DIR}/runtime-owner.txt`)
    await probeContractPorts()
    console.log('E2E runtime contract ready')
    return
  }
  const githubEnv = process.env.GITHUB_ENV
  if (!githubEnv) throw new Error('E2E runtime contract export requires GITHUB_ENV')
  const runtime = runtimeEnv()
  readOwnedServiceBindings(`${runtime.UE_RUNTIME_STATE_DIR}/runtime-owner.txt`)
  const publicFixture = JSON.parse(readFileSync(`${runtime.UE_RUNTIME_STATE_DIR}/runtime-public.json`, 'utf8'))
  if (
    publicFixture?.azurite?.endpoint !== 'http://127.0.0.1:10000/devstoreaccount1' ||
    publicFixture?.azurite?.container !== 'union-eyes' ||
    publicFixture?.azurite?.clamavUrl !== 'http://127.0.0.1:18080'
  ) throw new Error('E2E runtime contract rejected azurite fixture')
  const env = contractEnvFromRuntime(runtime, operatorDatabaseUrl(), AZURITE_FIXTURE_KEY)
  await probeContractPorts()
  mask(env)
  appendFileSync(githubEnv, githubEnvLines(env))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'E2E runtime contract failed')
  process.exit(1)
})
