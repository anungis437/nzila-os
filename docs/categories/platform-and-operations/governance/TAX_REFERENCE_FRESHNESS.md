# Tax reference freshness

## What failed

On 26 November 2026 the shared unit-coverage job failed because `packages/tax/src/__tests__/integration.test.ts` called `getStaleModules()` with no instant and required an empty result. The registry in `packages/tax/src/data-versions.ts` records `lastVerified: 2026-08-26` for all 10 modules. The threshold is 90 days, using greater-than rather than greater-or-equal. At 26 November 2026 00:00 UTC the age is 92 days, so the classification was correct.

`Unit Tests` and `Merge Authority / Unit Tests` repeat that coverage result. They are software checks. They are not a separate tax-data policy.

## Three separate controls

| Control | Question it answers | Where it runs | Result while these dates remain |
| --- | --- | --- | --- |
| Deterministic software tests | Does the 90-day rule classify explicit instants correctly? | Shared unit coverage on applicable pull requests | Pass |
| Live freshness audit | Are the recorded CRA verification dates current today? | `Tax reference freshness` workflow | `TAX_REFERENCE_DATA_CURRENTNESS = STALE` |
| Tax-dependent release | May a release that relies on these tables proceed? | Audit exit status, plus a named risk disposition | Blocked until re-verification or a recorded disposition |

A passing unit test does not mean the tax tables are current. The audit does not rewrite `lastVerified`.

## Algorithm

A module is current only when all of these hold:

- The source reference is non-blank.
- The verification date is a real `YYYY-MM-DD` calendar date.
- The elapsed UTC time from that UTC midnight to the evaluation instant is from 0 through 90 days.

Exactly 90 days stays current. One millisecond later is stale. A future date, a blank source, and an invalid date such as `2026-02-31` are not verification. The earlier comparison treated those as current because `NaN > 90` is false and a negative age is not greater than 90.

## Consumers

| Surface | Use of `@nzila/tax` | Effect of stale reference data |
| --- | --- | --- |
| `apps/cfo` | Corporate and personal rates, GST/HST, payroll thresholds, penalties, dividends, deadlines, and the data-freshness panel | Calculations and the panel can present rules last checked on 2026-08-26 |
| `apps/console` finance services | Tax-year types, close gates, governance actions, and CRA deadline calculation | Year-end deadlines can follow rules last checked on 2026-08-26 |
| `apps/partners` | Listed only as a transpiled package. No source import of the registry | No direct reference-data decision |
| Union Eyes | No package dependency and no import | No tax-reference release dependency |

`apps/console/lib/data-freshness.ts` measures operational sync lag. It does not read this CRA registry.

## CI decision

Shared unit coverage remains a required software check. Its command and name are unchanged. The wall-clock assertion was removed from that suite because it tested the calendar rather than the rule.

`tax-reference-freshness.yml` runs weekly, on demand, and for pull requests that change `packages/tax`, `apps/cfo`, or `apps/console`. It executes `pnpm --filter @nzila/tax freshness:audit` and fails while the registry is stale. The artifact keeps the module findings. This workflow is not added to branch protection or to the required-check publisher.

That publisher change, and a call from `deploy-console.yml`, still need a release-governance decision. Until that decision, a tax-consumer pull request shows the failing audit, and an unrelated pull request is not failed by this workflow. A release can record a disposition only by passing a file whose accepted currentness equals the audit result. The disposition cannot relabel stale data as current.

## Re-verification

Update `lastVerified` only for a module whose source was actually checked. Leave the other dates unchanged. The audit then reports the remaining modules as stale.
