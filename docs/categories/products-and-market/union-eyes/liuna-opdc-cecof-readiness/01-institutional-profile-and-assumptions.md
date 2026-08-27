# 01 - LIUNA Institutional Profile And Assumptions

## Confirmed Engagement Facts

| Item | Classification |
| --- | --- |
| Aubert met with Sean McFarling | Confirmed engagement fact |
| Sean showed broad interest in Union Eyes | Confirmed engagement fact |
| Leadership-change continuity was a material concern | Confirmed engagement fact |
| Tailored recording was promised | Confirmed engagement fact |
| OCI workshop may be useful | Confirmed engagement fact |
| No organizational approval has been granted | Confirmed engagement fact |

## Verified Public Institutional Facts

| Fact | Classification | Source |
| --- | --- | --- |
| LIUNA operates across the United States and Canada | Verified public fact | `liuna.org/about` |
| LIUNA reports roughly half a million members | Verified public fact | `liuna.org/about` |
| LIUNA has construction, infrastructure, energy, and public-sector footprint | Verified public fact | `liuna.org/about`, `liuna.org/public-sector` |
| LiUNA Canada emphasizes locals and training centres | Verified public fact | `liuna.ca` |

## Repository Facts

| Fact | Evidence |
| --- | --- |
| Union Eyes already has org-scoped auth and RLS helpers | `apps/union-eyes/lib/db/with-rls-context.ts`, `apps/union-eyes/lib/organization-middleware.ts` |
| Union Eyes has case/grievance, evidence, deadline, audit, document, onboarding, continuity, AI, and reporting surfaces | `apps/union-eyes/app/api/**`, `apps/union-eyes/lib/**` |
| Existing vocabulary package is CUPE-specific | `packages/cupe-vocabulary/**` |
| Existing CLC readiness is demo/convention oriented, not LIUNA legal/federated proof | `docs/categories/products-and-market/union-eyes/clc/final-clc-readiness-report.md` |
| LIUNA-specific repo artifacts were absent before this audit folder | Search baseline in `00-audit-charter-and-baseline.md` |

## Audit Assumptions

| Assumption | Why It Is Used | Risk |
| --- | --- | --- |
| OPDC and CECOF need separate institutional scopes | They are distinct entities in the engagement context | Actual implementation boundary requires client confirmation |
| Affiliated locals may require autonomy from central bodies | Federated union operations commonly involve local autonomy | Authorization rules cannot be finalized without LIUNA discovery |
| Legal/confidential matter handling is material | Sean is a senior legal/institutional contact | Product must not imply privilege controls without proof |
| Leadership continuity is the primary recording theme | Directly tied to Sean's expressed concern | Recording must avoid becoming a generic product tour |

## Hypotheses Requiring Discovery

- Intended first operating unit: OPDC, CECOF, a selected local, or a shared discovery workspace.
- Whether counsel, organizers, business agents, officers, and locals require different information boundaries.
- Whether restricted matters require ethical walls, legal holds, external-counsel access, or conflict controls.
- Whether training/apprenticeship/dispatch data is in scope for the first recording or later roadmap.
- Current systems of record and migration expectations.
- Bilingual requirements for Ontario and Central/Eastern Canada audiences.
- Accessibility, mobile, and low-bandwidth field expectations.
- Whether any current LIUNA data may be used later, under written authorization only.

## Modeled Actors

- OPDC leadership
- CECOF leadership
- Internal counsel/legal team
- Business agent or representative
- Local officer
- Steward
- Member
- Read-only oversight reviewer
- Restricted-matter participant
- System administrator
- Former officer or departed employee
- External counsel or expert

## Boundary Statement

Central oversight must not mean raw access to all local records. For LIUNA, Union Eyes must treat central visibility, local autonomy, and restricted legal participation as explicit authorization design questions.
