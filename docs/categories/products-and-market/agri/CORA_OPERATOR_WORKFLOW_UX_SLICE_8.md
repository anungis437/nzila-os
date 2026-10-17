# Cora Operator Workflow UX - Slice 8

**Disposition:** `CORA_OPERATOR_WORKFLOW_UX_SLICE_8_PASS_WITH_LIMITATIONS`

## Scope and reviewed context map

Slice 7 remains accepted. This slice makes its governed synthetic runtime
legible through a route-free presentational reference, not a production UX.

| Surface                                                                                                                                                                                | Relationship                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Slice 7 proof](CORA_GOVERNED_INSTITUTIONAL_WORKFLOW_SLICE_7.md), [runtime](CORA_INSTITUTIONAL_WORKFLOW_RUNTIME_CONTRACT.md), [audit](CORA_WORKFLOW_AUDIT_AND_IDEMPOTENCY_CONTRACT.md) | Preserve trusted identity, immutable bindings, lifecycle, idempotency and current-rights checks.                                                 |
| [Slice 6 proof](CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md), [reuse contract](CORA_CROSS_INSTITUTIONAL_REUSE_EVENT_CONTRACT.md)                                                      | Reuse remains governed use, separate from recipient acceptance and modeled friction.                                                             |
| [Authorization composition](CORA_AUTHORIZATION_COMPOSITION.md), [resolver](../../../../apps/cora/lib/resolve-org.ts)                                                                   | Existing trusted context port; no grants or resolver changes.                                                                                    |
| [Resolution](../../../../apps/cora/lib/evidence-resolution/), [reuse implementation](../../../../apps/cora/lib/evidence-reuse/)                                                        | Reuse existing interpretation, authority and rights helpers; no browser reconstruction.                                                          |
| [View and fixtures](../../../../apps/cora/lib/operator-workflow/), [components](../../../../apps/cora/components/workflow/)                                                            | Add server projection, synthetic journeys, pure presentation and local static rendering.                                                         |
| [Workflow service](../../../../apps/cora/lib/institutional-workflow/service.ts)                                                                                                        | Add explicit operator/history viewing, supplemental assertion binding and current verification metadata; preserve original primary-only digests. |

No route, HTTP endpoint, production persistence, migration, live connector or
recipient integration is added. Synthetic view/history grants are local
fixture-port results, not new application grants.

## Journeys rendered

The collection has ten entries from nine independently executed synthetic
journeys. Results come from runtime execution, not fabricated browser flags.

| Journey                  | Reference result                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| A: technical match       | `MATCHED`, awaiting recipient; explicit non-approval explanation.                                              |
| B: additional evidence   | `PARTIAL`, missing criteria, same governed evidence and `QUALIFIED_REUSE`; supplemental evidence still needed. |
| Revoked                  | Historical technical match survives, new use prohibited, separate historical-view permission required.         |
| Superseded and successor | Old run marked historical; authorized successor has a working local anchor.                                    |
| Conflict                 | Both issuer-bound assertions/providers shown; no winner; authorized recipient review required.                 |
| Inaccessible             | Detail-free denial after disclosure becomes unknown.                                                           |
| Stale                    | Visible `STALE`; no currentness or actionable success claim.                                                   |
| Expired                  | Current check `EXPIRED`; historical technical result preserved separately.                                     |
| Reconstruction           | Attempt is not qualified reuse; trace/rejection reasons shown.                                                 |

Source/provider, issuer, Cora processing, requirement owner and decision owner
have distinct labels. Currentness, use permission, technical resolution, reuse
and recipient disposition are not collapsed into one success state.

See [the view contract](CORA_OPERATOR_WORKFLOW_VIEW_CONTRACT.md)
and [truth/authority guide](CORA_WORKFLOW_UX_TRUTH_AND_AUTHORITY_GUIDE.md).

## Local reference

Use the existing renderer with an absolute local HTML output path:

```powershell
pnpm exec tsx apps\cora\lib\operator-workflow\render-synthetic.tsx C:\absolute\local\cora-synthetic-reference.html
```

Open the generated file locally. No server or HTTP route is needed. It
contains only synthetic evidence, rights and audit details. Closed support
disclosures hide raw vectors/metrics by default but are not security controls.

## Verification

Focused tests cover truth wording, missing criteria, zero-detail denial,
conflicting issuers, revocation/history, permitted successor links, freshness,
expiry, independent disposition, qualified/pseudo-reuse, default-closed
support disclosures, tenant/actor isolation and native semantic structure.
Additional server tests cover missing viewing permission, absent historical
permission, unknown/denied source and recipient rights, earliest expiry,
timestamp-backed currentness and propagation of unexpected errors.

Browser checks use the generated local file: no network resources or setup
controls; no duplicate IDs; actual successor navigation; conflict/reuse/history
wording; closed disclosures; keyboard Enter/Space behavior and visible focus;
narrow-viewport wrapping. The Playwright file protocol was blocked, so Chrome
DevTools local-file inspection was used without adding a server.

Validation commands and final counts are recorded with the completion report:
focused UX/runtime tests, full Cora suite, Cora typecheck/lint, scoped Prettier,
docs validation, `git diff --check` and governance audit.

## Readiness, limitations and frozen gates

**Ready for bounded human comprehension validation with synthetic scenarios
only.** No human comprehension, institutional acceptance, real productivity,
live currentness, screen-reader audit or production accessibility claim is
made. The next milestone is comprehension validation, not another runtime
architecture layer.

The design-phase successor is [the human comprehension validation protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md),
with [rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md),
[capture schema](CORA_HUMAN_VALIDATION_CAPTURE_SCHEMA.md) and
[session guide](CORA_SYNTHETIC_VALIDATION_SESSION_GUIDE.md).
It does not represent conducted human sessions or authorize outreach.

Process-memory storage and synthetic identity/rights/issuer/recipient ports
remain. There is no production authorization, platform audit integration,
durable retention/deletion, real recipient decision service or authenticated
HTTP proof. Supplemental assertions are bounded synthetic conflict support,
not a new source acquisition path.

Deere and FieldView gates remain unchanged. Organic Alpha remains
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PHASE_3_PERMISSION = NONE_GRANTED` and
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.

No real provider/farm data, credentials, external APIs, outreach, commit or
push. Unrelated dirty worktree content remains outside this disposition.
