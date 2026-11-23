# CIVIC Runtime C1 — Readiness Package (non-activating)

**Status:** `EXECUTABLE_READY_PACKAGE` / implementation `NOT_AUTHORIZED`  
**Product:** `CIVIC_PRODUCT_GO_LIVE = NO_GO`  
**Authority:** `docs/public-service/operations/CIVIC_RUNTIME_C1_AUTHORIZATION_PACKET.md`

This package prepares everything that can be completed **without** writing
protected C1 runtime paths or issuing a grant. It does **not** authorize
`apps/civic/src/c1` implementation.

## 1. Contract review (complete offline)

| Item | State |
|---|---|
| Doctrine `c1.enabled` | `false` (`AWAITING_OWNER_GRANT`) |
| Guard `assertCivicC1Authorized` | Refuses while pending |
| Integrity tests | Refuse forged / expired / wrong-SHA grants |
| Slice 0/1/2 grants | Terminated — must not be reused |

## 2. Fixture design (fictional only)

Reuse `fixtures/sage-b005-institutional/` journeys as the SAGE-side corpus for
future C1 synthetic clients:

- P01 Alder procurement
- R01 regulator separation
- S01 secretariat succession
- T01 executive accountability

C1 must consume typed SAGE contracts; it must not mint institutional scores,
rankings, or AI decision-makers.

## 3. Component specifications (inactive)

Proposed surface (from authorization packet — **do not create until grant**):

- `apps/civic/src/c1` — synthetic client routes / views
- `apps/civic/tests/c1` — fail-closed + synthetic admission tests
- `apps/civic/c1.tsconfig.json` / `c1.vitest.config.ts`

Required behaviours once authorized:

- Bilingual EN/FR strings from Civic localization inventories
- Mobile-first navigation with institutional workspaces
- Source drill-down into CLEAR evidence without inventing acceptance
- Decision timeline + adoption actions bound to SAGE mandates

## 4. Test harness preparation

Pre-grant harness checklist (docs/tests only — no protected file writes):

1. Guard refuse tests already in `tooling/contract-tests/civic-oci-doctrine-integrity.test.ts`
2. Future positive admission tests must pin exact SHA / branch / window from the owner grant
3. Localization inventory: catalogue existing Civic EN/FR keys; list gaps for C1 copy
4. Navigation analysis: map Civic shell routes that would host C1 without aliasing Union Eyes

## 5. Integration mapping

| CIVIC concern | SAGE / CLEAR binding |
|---|---|
| Mandate selection | `sage_institutional_mandate` + Pattern-A enforcement |
| Evidence context | `applyAuthorizedEvidenceContextChoke` |
| Adoption | `sage_accountability_adoption` (draft ≠ adoption) |
| Capacity / recusal | migration `0051` store |
| Staging proof | B-005 (separate decision) |

## 6. Owner grant checklist (external)

Before any protected write:

- [ ] Decision = `AUTHORIZE_WITH_CONDITIONS`
- [ ] Exact starting SHA
- [ ] Authorized branch / worktree
- [ ] Effective + expiry timestamps
- [ ] Writable path list matches packet §3
- [ ] Synthetic-only / non-production / no real data confirmed

Until then retain `CIVIC_C1_ACTIVATION_BLOCKED`.
