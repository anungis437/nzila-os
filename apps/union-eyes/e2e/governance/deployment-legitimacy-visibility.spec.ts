import { test } from '@playwright/test'
import {
  expectAttestationReachable,
  expectGovernanceHeadersOnHealth,
} from '../helpers/governance'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

test.describe('governance: deployment legitimacy visibility', () => {
  test('health endpoint exposes release identity governance headers (when bound)', async ({ page }) => {
    await expectGovernanceHeadersOnHealth(page, BASE_URL)
  })

  test('attestation surface accepts release id queries without 5xx', async ({ page }) => {
    await expectAttestationReachable(page, BASE_URL, process.env.NZILA_RELEASE_ID ?? 'UE-DEV')
  })
})
