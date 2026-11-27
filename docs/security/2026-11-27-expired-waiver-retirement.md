# Supply-chain waiver retirement — 2026-11-27

## Scope and source

All seven entries in `ACTIVE_WAIVERS` expired at the end of 2026-11-26 UTC. From 2026-11-27, the Dependency
Audit and Supply Chain Waiver Expiry jobs therefore failed on every branch, including `main`. Example:
- Run `45918344680` (PR #1320 head `210bc13e0`).
- Dependency Audit reported `totalVulns: 0`, `unwaived: 0`, and seven `expiredWaivers`.

The Governance Gate and GA Gate failed only because those two jobs failed.

## Retired IDs (7)

| Dependency family | Identifiers | Why the advisory is gone |
| --- | --- | --- |
| minimatch | CVE-2026-26996 (GHSA-3ppc-4f35-3m26, npm 1113371) | Override `minimatch >=11.0.1 <12` resolves only `minimatch@11.0.9`. The fix shipped in 10.2.1. |
| xlsx | 1108110, 1108111 | `xlsx` is no longer in `pnpm-lock.yaml`. |
| axios | 1117576, 1117578, 1117591, 1117593 | Override `axios >=1.20.0` resolves only `axios@1.20.0`. The advisories affect `< 1.8.2`. |

Evidence: `node tooling/security/npm-bulk-audit.mjs --audit-level=low` against the current lockfile:
- It reports **zero advisories at every severity**: info 0, low 0, moderate 0, high 0, critical 0.
- None of the retired IDs or their aliases appear in it.

`supply-chain-policy.ts check-vulns` then passes with no expired waivers.

## What did not change

Nothing was weakened:
- No expiry was extended, no risk was accepted, and no audit gate or threshold changed. `ACTIVE_WAIVERS` is now empty.
- A reappearing high or critical advisory stays unwaived and fails closed.
- `checkVulnerabilityPolicy` gained an optional waiver list, which defaults to `ACTIVE_WAIVERS`. Its unit tests pass explicit fixture copies of the retired xlsx and minimatch records, so expiry, approval-window and alias-spoofing rules stay exercised without any production waiver.
