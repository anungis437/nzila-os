import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRewardsBoundaryFixture } from '@/db/__tests__/rewards-boundary-testkit'
import { RewardsInstitutionalAuthorityUnavailable } from '@/lib/rewards/credit-authority'

/** Historical positive credit algorithms do not establish current institutional
 * authority. Exercise the current source service and the actual restricted SQL
 * persistence contract without mocking either authority verdict. */
export function currentCreditDenial(
  name: string,
  operation: (f: Awaited<ReturnType<typeof createRewardsBoundaryFixture>>) => Promise<unknown>,
  sql: string,
  system = false,
) {
  describe(name, () => {
    let fixture: Awaited<ReturnType<typeof createRewardsBoundaryFixture>>
    beforeAll(async () => {
      fixture = await createRewardsBoundaryFixture()
    })
    afterAll(async () => {
      expect(await fixture.preserved()).toEqual(fixture.history)
      await fixture.db.close()
    })
    it('refuses the held service operation before its former financial effects', async () => {
      await expect(operation(fixture)).rejects.toBeInstanceOf(
        RewardsInstitutionalAuthorityUnavailable,
      )
      expect(await fixture.preserved()).toEqual(fixture.history)
    })
    it('also refuses direct restricted SQL while preserving historical rows', async () => {
      await expect(
        (system ? fixture.system : fixture.runtime)(() => fixture.db.query(sql)),
      ).rejects.toMatchObject({ code: '42501' })
      expect(await fixture.preserved()).toEqual(fixture.history)
    })
  })
}
