# Supply-chain advisory-ID waiver retirement — 2026-11-03

> **Provenance (added 2026-11-05).** This record was written on branch `fix/security-retire-expired-waivers-20261103`
> for PR #1054, which was closed unmerged. The same 23 waivers, plus `node-forge` 1240912 and `braces` 1240992, were
> retired on `main` by PR #1092 (merge `eef062ee5`). The text below is kept unchanged as the evidence of 2026-11-03: its
> "pending" and `NO_GO` entries describe that day's candidate, not the current state.

## Scope and source

Branch: `fix/security-retire-expired-waivers-20261103`.

Evidence is from the **same** 2026-11-03 CI baseline, SHA `66ce01a556c87482c7da8d11fb469027947d9c51`:
- Supply Chain Waiver Expiry: job `125758768348` — 23 entries expired on 2026-10-31.
- Dependency Audit: job `125758768608` — 45 vulnerability findings, 14 high; 14 current high findings are unwaived, **none carry the historical rollover IDs listed below**.
- The `ACTIVE_WAIVERS` source intentionally required manual re-review even for no-longer-observed advisories, causing the governance gate to fail.

## Retired IDs (23)

| Dependency family | Historical advisory identifiers |
| --- | --- |
| brace-expansion | 1123898, 1130591 |
| js-yaml | 1123911, 1123912 |
| tar | 1123940, 1123941 |
| socket.io | 1123943 |
| shell-quote | 1123944 |
| axios | 1123967 |
| immutable | 1124007, 1124017 |
| fast-uri | 1124064, 1130178 |
| sharp | 1124066 |
| next | 1124170, 1124171, 1124184, 1124192 |
| next-auth | 1124242, 1124244, 1124246 |
| find-my-way | 1124273 |
| postcss | 1124288 |

The waiver policy now simply omits the stale entries. It does **not** extend expiration, accept risk, suppress any new vulnerability, or disable an audit gate. A reappearing high/critical advisory ID remains unwaived and fails closed.

## Explicitly **not** corrected

- The current dependency audit still reports 14 high findings; these require package remediation and new CI proof.
- Trivy reports nine high findings in `@azure/msal-node`, `body-parser`, `follow-redirects`, `multer`, and `node-forge`; none is resolved by deleting old waivers.
- Waivers 1240912 (`node-forge`) and 1240992 (`braces`) expire **2026-11-04**. Those cannot be extended without independent risk review and are separate live dependency work. All other active waivers are preserved.

## Acceptance ledger

| Control | Evidence / status |
| --- | --- |
| Exactly 23 historical entries removed | Source edit; targeted check pending CI |
| No other waiver changed, extended, or approved | Existing non-rollover entries preserved in source |
| Expired-waiver job | **UNEXECUTED on candidate SHA** until PR CI completes |
| High/critical audit | **FAIL on baseline**; separate remediation required |
| Release gate | **NO_GO** until all applicable checks pass |
