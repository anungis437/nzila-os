# Wave 0 §8 — Operational-Build Customer-Fixture Scanner

## Purpose

The operational-build scanner (`pnpm reality:build-scan`) enforces a **zero-tolerance** policy for customer-specific fixtures in the operational `@nzila/union-eyes` package. The prior allowlist-based inventory model was **retired at Wave 0 Task E** in favour of a hardcoded audit-trail permit that lives inside the scanner itself.

This document supersedes the prior "Path B — classified allowlist" description.

---

## Policy

1. **Operational source MUST NOT contain customer-specific tokens.**
   The following patterns are forbidden anywhere under `apps/union-eyes/` (excluding tests, mocks, fixtures, snapshots, e2e specs, scripts, coverage dumps, and root-level `reports/` / `artifacts/` / `proof-artifacts/`):

   ```
   cupe\s*[-_]?\s*4373
   cupe\s*local\s*4373
   CUPE4373_
   ```

2. **The only exception is a hardcoded audit-trail permit.** The permit is a `readonly` constant (`PERMITTED_AUDIT_TRAIL`) inside `tooling/reality/operational-build-scan.ts`. It exists solely to preserve forensic evidence in `capability-registry.ts` evidence arrays that name the files removed during Wave 0 Task D. It is not a growth surface.

3. **Any unpermitted hit is a HARD FAILURE (exit 1).** There is no JSON allowlist to edit. Adding a new customer-fixture token to operational source will fail the scan; the correct remediation is to move the content to `apps/union-eyes-demo/` or delete it.

4. **Dead permit entries are HARD FAILURES.** If a permitted file no longer contains hits, the permit ceases to be justified and the entry must be removed from the constant.

5. **Overflow is a HARD FAILURE.** Each permit entry has a strict `maxHits`. If the audit-trail evidence legitimately expands, raise `maxHits` in the same commit that adds the evidence — with an explicit reason.

---

## Retired: the allowlist model

The old model used `tooling/reality/operational-build-demo-allowlist.json` with 28 classified entries and per-file `maxHits` ceilings. It was appropriate when operational and demo code shared a single Next.js bundle and both surfaces needed to compile together while runtime gates hid demo UI in production.

That architecture no longer exists:

- `apps/union-eyes-demo/` is a separate Next.js application (`@nzila/union-eyes-demo`, port 3012) with its own build, its own routes, and its own tests.
- The operational package (`@nzila/union-eyes`, port 3002) rejects demo profile env vars at boot (`z.never().optional()` in `apps/union-eyes/lib/config/env-validation.ts`).
- All CUPE-specific components, personas, navigation constants, and helpers have been physically deleted from the operational package (Wave 0 Task D, commit `1ccb36259`).

The allowlist would have to be shrunk to a single entry — `capability-registry.ts` at maxHits=4 — with no other legitimate uses. That is exactly what the hardcoded permit encodes, without the ceremony of an external JSON file that could grow again.

---

## Test/fixture filter

`isTestOrFixturePath()` skips paths containing `/__tests__/`, `/__mocks__/`, `/__fixtures__/`, `/__snapshots__/`, `/tests/`, `/test/`, `/e2e/`, `/fixtures/`, `/scripts/`, `/coverage/`, `.test.*`, `.spec.*`, `.stories.*`, and root-only paths under `reports/`, `artifacts/`, `proof-artifacts/`, `apps/union-eyes/reports/`. Tests naturally reference customer names for regression coverage; they are not shipped and are excluded from the policy.

---

## Invocation

```powershell
# Source-only scan (enforces the permit, produces the baseline report)
pnpm reality:build-scan

# Source + informational bundle scan (requires apps/union-eyes/.next to exist)
pnpm build:union-eyes
pnpm reality:build-scan:with-bundle
```

Outputs:

- `reports/operational-build-demo-scan.json` — full machine-readable inventory.
- `reports/operational-build-demo-scan.md` — human-readable summary table.

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | All source hits are covered by `PERMITTED_AUDIT_TRAIL` within their `maxHits` ceilings, and every permit entry has at least one real hit. |
| `1` | One or more source files contain unpermitted customer-fixture tokens, exceed their ceiling, or a permit entry is dead. |
| `2` | Fatal internal error. |

Note: `--build-dir` problems (missing directory, missing ripgrep) are surfaced to stderr but **do not** contribute to the exit code — bundle presence is an operator concern, not a policy violation.

---

## Current baseline (Task E — post allowlist retirement)

- **Source**: 1 file with hits / 4 total hits / 0 errors.
- The single hit file is `apps/union-eyes/lib/reality/capability-registry.ts` — evidence arrays for `UE-DEMO-SEPARATE-PACKAGE` and `UE-BUILD-OPERATIONAL-ISOLATION` name the four files that were physically removed during Task D.
- **Bundle** (`.next/` informational, when scanned): expected to drop to zero after `pnpm build:union-eyes` picks up the Task D deletions. Bundle counts remain informational and do not affect the exit code.

See `reports/operational-build-demo-scan.md` for the latest numbers.

---

## Governance rules

1. **Never widen `PERMITTED_AUDIT_TRAIL` casually.** Any new entry requires:
   - explicit ownership by Aubert Nungisa,
   - a capability-registry entry that justifies the exception, and
   - the smallest possible `maxHits` (the actual count, not a padded ceiling).

2. **Any addition of a customer-fixture token to operational source will fail the scan.** The correct remediation is to move the content to `apps/union-eyes-demo/` or delete it. There is no scanner-side accommodation for "temporary" additions.

3. **`maxHits` is a ceiling, not a floor.** When a refactor removes evidence lines, lower `maxHits` in the same commit.

4. **Bundle hits (`.next/`) are informational only.** The source-side gate is authoritative. If the bundle contains customer-fixture strings after the operational source is clean, the cause is elsewhere (workspace dependency, generated code, static asset) and should be triaged separately.

---

## Related artifacts

- Scanner: [tooling/reality/operational-build-scan.ts](../../../tooling/reality/operational-build-scan.ts)
- Capability entries: `UE-DEMO-SEPARATE-PACKAGE`, `UE-BUILD-OPERATIONAL-ISOLATION` in [apps/union-eyes/lib/reality/capability-registry.ts](../../../apps/union-eyes/lib/reality/capability-registry.ts)
- Baseline report: [reports/operational-build-demo-scan.md](../../../reports/operational-build-demo-scan.md)
- Peer scanner (anti-theatre): [tooling/reality/anti-theatre-scan.ts](../../../tooling/reality/anti-theatre-scan.ts)
- Env boundary contract: [apps/union-eyes/lib/config/env-validation.ts](../../../apps/union-eyes/lib/config/env-validation.ts)
- Demo package: [apps/union-eyes-demo/](../../../apps/union-eyes-demo/)
