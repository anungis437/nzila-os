# Union Eyes Claims Ledger

> Generated for procurement hardening review.
> Scope: buyer-facing claims across commercial docs, trust page, security docs, pricing docs, and pilot docs.

| Claim | Source file | Implementation proof | Status |
|---|---|---|---|
| Canada-hosted production data plane | docs/commercial/security-one-pager.md; apps/union-eyes/app/(marketing)/trust/page.tsx | Azure Canada Central deployment posture documented in governance and ops artifacts | verified |
| Cross-org isolation via RLS | apps/union-eyes/app/(marketing)/trust/page.tsx | Org-scoped data model and RLS boundary tests | verified |
| HMAC-sealed audit trail and exportable evidence | apps/union-eyes/app/(marketing)/trust/page.tsx; docs/commercial/security-one-pager.md | Evidence packages and hash-chain controls in platform evidence modules | verified |
| Entra SSO posture | apps/union-eyes/app/(marketing)/trust/page.tsx; docs/commercial/security-one-pager.md | platform-auth with optional Entra SSO wiring | verified |
| AI outputs include confidence indicators | apps/union-eyes/app/(marketing)/trust/page.tsx | governed-ai surfaces with confidence metadata | partially verified |
| Dedicated tenant available for large federations | apps/union-eyes/app/(marketing)/trust/page.tsx | Commercial option only; not default deployment path | roadmap |
| SOC 2 Type II status | docs/commercial/security-one-pager.md; apps/union-eyes/app/(marketing)/trust/page.tsx | No active attestation engagement | roadmap |
| Third-party penetration test status | docs/commercial/security-one-pager.md; apps/union-eyes/app/(marketing)/trust/page.tsx | No active engagement committed in repo evidence | roadmap |
| Backup/DR certainty | docs/commercial/security-one-pager.md | Nightly backup claim present; restore-drill evidence not yet complete | partially verified |
| Response SLA certainty | docs/demos/union-eyes-demo-seed.md | SLA language exists, but no published SLA metrics evidence export yet | partially verified |

## Auto-rewrites applied in this delta

- Downgraded absolute residency wording to policy-backed language.
- Removed unsourced scheduling claims for SOC2 and penetration testing.
- Reframed dedicated tenant as commercial-scope option instead of unconditional baseline.
- Reframed backup/availability wording to avoid over-claiming until drill evidence is published.
