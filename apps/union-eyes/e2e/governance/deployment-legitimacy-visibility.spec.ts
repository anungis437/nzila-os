import { test } from '@playwright/test'
import {
  expectAttestationReachable,
  expectGovernanceHeadersOnHealth,
} from '../helpers/governance'

test.describe('governance: deployment legitimacy visibility', () => {
  test('health endpoint exposes release identity governance headers (when bound)', async ({ page, baseURL }) => {
    const url = baseURL ?? 'http://localhost:3002'
    await expectGovernanceHeadersOnHealth(page, url)
  })

  test('attestation surface accepts release id queries without 5xx', async ({ page, baseURL }) => {
    const url = baseURL ?? 'http://localhost:3002'
    await expectAttestationReachable(page, url, process.env.NZILA_RELEASE_ID ?? 'UE-DEV')
  })
})
