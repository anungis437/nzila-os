# Union Eyes — Protected Governance Semantics Audit

**Audit date:** 2026-05-15
**Substrate:** `@nzila/institutional-governance-graph` — `src/governance/protected.ts`
**Posture:** validation-only

The protected fence prevents Class-B / founder / reserved-matter / golden-share semantics from appearing in any runtime read surface that is not the sanctioned admin governance console or the procurement appendix.

---

## 1. Fence module (recap)

[packages/institutional-governance-graph/src/governance/protected.ts](packages/institutional-governance-graph/src/governance/protected.ts) exports:

- **Protected entity kinds:** `CLASS_B_SPECIAL_VOTING_SHARE`, `RESERVED_MATTER`
- **Protected relationships:** `VETOES`, `HOLDS`, `OVERRIDES`
- **Protected events:** `CLASS_B_VETO`, `GOLDEN_SHARE_SUNSET_PROGRESSION`, `RESERVED_MATTER_RAISED`
- **Helpers:** `redactProtected()`, `assertNoProtectedKindsInReadSurface()`

These are invoked by every depth-1 institutional read surface (governance-center, institutional-{observability, topology, chronology}, longitudinal-cognition, executive-operating-intelligence) before projection, guaranteeing the fence at runtime.

---

## 2. Token sweep — runtime surfaces

| File | Lines | Tokens | Surface | Verdict |
| --- | --- | --- | --- | --- |
| [apps/union-eyes/app/api/governance/reserved-matters/route.ts](apps/union-eyes/app/api/governance/reserved-matters/route.ts) | 1–3 (header), implementation | "reserved matter" | API endpoint, gated `minRole: 'admin'` | ✅ allowed |
| [apps/union-eyes/app/[locale]/dashboard/admin/governance/governance-console.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/admin/governance/governance-console.tsx) | 150–920 | "Reserved Matter", "Class B vote", "Golden Share" | Admin governance console, gated `minRole: 'admin'` + `entitlement: 'governance_suite'` | ✅ allowed (sanctioned location) |
| [apps/union-eyes/app/(marketing)/components/role-page-content.tsx](apps/union-eyes/app/%28marketing%29/components/role-page-content.tsx) | 114–117 | "Labour Councils" / "labour councils" | Marketing role page (contextual) | ✅ allowed (descriptive of customer-side councils, not vendor Class-B) |
| [apps/union-eyes/app/[locale]/(marketing)/trust/stewardship-appendix/page.tsx](apps/union-eyes/app/%5Blocale%5D/%28marketing%29/trust/stewardship-appendix/page.tsx) | full page | Class-B founder narrative + assistive-intelligence labour-safe paragraph | Procurement appendix | ✅ allowed (sole sanctioned narrative location) |

No leakage detected outside these four sanctioned locations.

---

## 3. Surfaces explicitly verified clean

| Surface family | Result |
| --- | --- |
| `app/[locale]/dashboard/exports/**` | no protected tokens |
| `app/[locale]/dashboard/reports/**` | no protected tokens |
| `app/[locale]/dashboard/audits/**` | no protected tokens |
| `app/[locale]/dashboard/{members,claims,cases,grievances,bargaining}/**` | no protected tokens |
| `app/[locale]/dashboard/{finance,dues,strike-fund,pension,employer-execution}/**` | no protected tokens |
| `app/[locale]/dashboard/admin/{members,organizations,migrations,onboarding}/**` (non-`governance` admin sub-routes) | no protected tokens |
| All marketing pages other than `stewardship-appendix` | no protected tokens |
| Locale bundles (`messages/*.json`) | no protected tokens |
| API namespaces other than `/api/governance/reserved-matters` | no protected tokens |

---

## 4. Defence-in-depth assessment

| Layer | Mechanism | Status |
| --- | --- | --- |
| Substrate redaction | `assertNoProtectedKindsInReadSurface()` invoked by depth-1 projection helpers | ✅ enforced |
| Role gating | `minRole: 'admin'` on console + API | ✅ enforced |
| Entitlement gating | `entitlement: 'governance_suite'` on console | ✅ enforced |
| Narrative gating | Forbidden-vocabulary list + narrative CI | ✅ enforced (zero hard-fails on last run) |
| Marketing copy gating | Marketing pillars exclude vendor stewardship narrative; only stewardship-appendix carries it | ✅ enforced |
| Locale bundle gating | No protected tokens in any locale bundle | ✅ verified |

---

## 5. Verdict

**PASS.**

- All Class-B / reserved-matter / golden-share / founder semantics are isolated to the four sanctioned locations.
- Substrate-level redaction is in place via `assertNoProtectedKindsInReadSurface()`.
- Role + entitlement gating is uniform on the admin console and its API.
- Marketing surfaces correctly carry the procurement narrative only in the stewardship appendix and disclaim surveillance / scoring elsewhere.

No remediation required for the protected fence layer. This audit recommends only:

- **Maintain** the fence module as the single source of truth for protected kinds.
- **Extend** the narrative gate to dashboard / nav / locale-bundle scopes in a future hardening pass to detect the soft-drift findings called out in `legacy-semantic-drift-audit.md` and `locale-parity-audit.md` before they can mature into protected-token leakage.
