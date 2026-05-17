# Union Eyes — Onboarding / Admin / Procurement Readiness Audit

**Audit date:** 2026-05-15
**Posture:** validation-only

This audit assesses whether the surfaces that procurement reviewers, admin operators, and pilot onboarders actually traverse during a buyer evaluation are coherent, complete, and free of governance drift.

---

## 1. Procurement-traversed surfaces (canonical demo path)

| Order | Surface | Purpose | Production Readiness |
| --- | --- | --- | --- |
| 1 | [(marketing)/](apps/union-eyes/app/%28marketing%29) home | Landing | prod |
| 2 | [(marketing)/trust](apps/union-eyes/app/%28marketing%29/trust) | Trust pillar | prod |
| 3 | [(marketing)/trust/stewardship-appendix](apps/union-eyes/app/%5Blocale%5D/%28marketing%29/trust/stewardship-appendix) | Procurement appendix (only sanctioned location for Class-B / founder / reserved-matter narrative) | prod |
| 4 | [(marketing)/governance](apps/union-eyes/app/%28marketing%29/governance) | Governance pillar | prod |
| 5 | [(marketing)/institutional-continuity](apps/union-eyes/app/%28marketing%29/institutional-continuity) | Continuity pillar | prod |
| 6 | [(marketing)/proof](apps/union-eyes/app/%5Blocale%5D/%28marketing%29/proof) | Proof artifacts | prod |
| 7 | [(marketing)/case-studies](apps/union-eyes/app/%28marketing%29/case-studies) | Case studies | near-prod |
| 8 | [(marketing)/pricing](apps/union-eyes/app/%28marketing%29/pricing) | Pricing | near-prod |
| 9 | [(marketing)/pilot-request](apps/union-eyes/app/%28marketing%29/pilot-request) | Pilot intake | prod |
| 10 | [(marketing)/contact](apps/union-eyes/app/%28marketing%29/contact) | Contact | prod |
| 11 | [(marketing)/legal/{terms,privacy,security,accessibility}](apps/union-eyes/app/%5Blocale%5D/%28marketing%29/legal) | Legal | prod |

**Verdict:** the procurement path is **coherent and presentable**. Narrative audit clears at maturity 87 with zero hard-fails on this path. Class-B / reserved-matter narrative is fenced exclusively to `stewardship-appendix`, the sanctioned procurement location.

---

## 2. Admin / governance console surfaces

| Surface | Gating | State |
| --- | --- | --- |
| [/[locale]/admin/auth-policy](apps/union-eyes/app/%5Blocale%5D/admin) | role: admin | prod |
| [/[locale]/dashboard/admin/governance/governance-console.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/admin/governance/governance-console.tsx) | role: admin · entitlement: `governance_suite` | **prod — the only sanctioned runtime location for Reserved-Matter / Class-B / Golden-Share UX.** |
| [/api/governance/reserved-matters/route.ts](apps/union-eyes/app/api/governance/reserved-matters/route.ts) | role: admin | prod |
| /[locale]/dashboard/admin/onboarding | role: admin | near-prod |
| /[locale]/dashboard/admin/{members, organizations, dues, rewards, alerts, ingest, jobs, segments, pki, billing-cycles, ai-usage, migrations} | role: admin | near-prod |
| /[locale]/dashboard/admin/migrations | role: admin (operator only) | near-prod |

**Verdict:** admin gating is enforced uniformly. The protected substrate is correctly fenced behind `minRole: 'admin'` AND `entitlement: 'governance_suite'`. No leakage into non-admin surfaces detected (cross-referenced in `protected-governance-semantics-audit.md`).

---

## 3. Onboarding surfaces

| Surface | Audience | State |
| --- | --- | --- |
| /[locale]/dashboard/admin/onboarding | Internal admin onboarding flow | near-prod |
| /[locale]/dashboard/pilot/onboarding | Pilot org onboarding | near-prod |
| /[locale]/pilot-governance | Pilot governance landing | near-prod |
| /[locale]/operational-proving | Operational proving evidence surface | near-prod |
| /[locale]/final-go | Final-go evidence surface | near-prod |
| /[locale]/field-operations | Field operations onboarding | near-prod |
| /[locale]/dashboard/structure | Org structure setup | near-prod |
| /[locale]/dashboard/data-source | Data source linkage | near-prod |
| /[locale]/dashboard/integrations + /[locale]/dashboard/settings/integrations | Integration management | near-prod |

**Verdict:** the onboarding surface is complete in shape but uneven in narrative depth. Pilot-governance, operational-proving, and final-go are governance-aligned; admin/onboarding and dashboard/structure are operational shells. No drift detected; recommend institutional vocabulary harmonization across all six landings as a low-risk follow-up.

---

## 4. Procurement export / evidence surfaces

| Surface | Purpose | State |
| --- | --- | --- |
| /[locale]/dashboard/exports (under finance/exports + reports) | Export builder | near-prod |
| /[locale]/dashboard/reports | Report builder | near-prod |
| /[locale]/dashboard/audits | Audit log surface | prod |
| /(marketing)/proof, /[locale]/(marketing)/proof | Proof artifacts catalogue | prod |

Exports and reports correctly avoid protected tokens (audited in `protected-governance-semantics-audit.md`). Audit log surface is depth-1 read-only against substrate. Proof catalogue lists `reports/governance-graph/workstream-h-implementation-report.md` and the WS E continuity-convergence audit, both consumable by procurement reviewers.

---

## 5. Auth surfaces (procurement-relevant)

The auth tree is duplicated:

- Localized: `/[locale]/(auth)/{sign-in, sign-up, signup, login}`
- Root-level: `/{reset-password, forgot-password, sign-in, sign-up, signup, login}`

Both trees work. The root-level duplicates are SEO/legacy fallbacks and do not affect procurement readiness. Recommend consolidation as a low-priority cleanup.

---

## 6. Findings

1. **Procurement narrative is presentable** — the canonical demo path (11 surfaces) is governance-safe and the only Class-B / reserved-matter narrative lives in the sanctioned appendix.
2. **Admin gating is correct** — protected governance UX and APIs are double-gated (role + entitlement).
3. **Onboarding surfaces are complete in shape, uneven in depth** — six landings exist but only three carry institutional framing. Recommend vocabulary harmonization (additive, not destructive).
4. **Exports / reports / audits surfaces are clean** — no protected token leakage; audit log is depth-1.
5. **Auth duplication is non-blocking** — both trees function; consolidation is a hygiene item.

No procurement-blocking issues identified.
