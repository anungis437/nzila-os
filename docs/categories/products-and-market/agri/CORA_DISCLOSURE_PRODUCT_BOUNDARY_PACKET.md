# CORA Product Boundary Decision Packet

**Packet ID:** `CORA-DISCLOSURE-PRODUCT-001`  
**Version:** `1.0.0`  
**Status:** `AWAITING_PRODUCT_DECISION`

Lane A preparation for C4/C7 and product inputs to C3/C5/C8 in the
[register](CORA_DISCLOSURE_HUMAN_DECISION_REGISTER.md).
Accountable role: CORA product/Surface Owner, routed through
`team-cora-business@nzila.ai`; actual delegate/appointment remains UNSET.
Source-owner and Privacy/Legal concurrence remain required where applicable.
Conditional direction is not source or privacy approval.

## 1. Product decisions to record

| Question                    | Decision/evidence                                           | Recommended boundary, not approval                                                                                  |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Intended purpose            | UNSET: sign purpose, users, benefit and excluded inferences | Current producer-record status as a partial evidence indicator; no economic, eligibility or certification inference |
| History needed?             | UNSET                                                       | No historical status series                                                                                         |
| Export needed?              | UNSET                                                       | No export or bulk extraction                                                                                        |
| Onward redistribution?      | UNSET                                                       | No unrelated secondary use or redistribution                                                                        |
| Recipient roles/tasks       | UNSET: justify each task-based role                         | Smallest same-org cohort with canonical active membership and explicit read permission                              |
| Desired correction behavior | UNSET: product expectation for C5 concurrence               | No persistent status copy; no unsupported SLA                                                                       |
| Review cadence preference   | UNSET: proposed cadence and change triggers for C8          | Finite review/expiry; re-review on scope, role, source or legal change                                              |

## 2. Canonical role ratification (C4)

Exact source: [resolve-org.ts](../../../../apps/cora/lib/resolve-org.ts),
`isCanonicalMembershipRole` / `mapMembershipRole`. Canonical membership
storage is a role string, not an enum:
[platform-authorization.ts](../../../../packages/db/src/schema/platform-authorization.ts).
The application category enum alone is not the list of trusted memberships.

| Canonical membership role                                    | Application/policy role received             | Eligible?                           | Organization / purpose / permission              | Authority decision      |
| ------------------------------------------------------------ | -------------------------------------------- | ----------------------------------- | ------------------------------------------------ | ----------------------- |
| `admin`                                                      | `admin`                                      | UNSET                               | Same-org / exact purpose / `cora:farmer360:read` | UNSET                   |
| `org_admin`                                                  | `admin`                                      | UNSET                               | Same-org / exact purpose / explicit read grant   | UNSET                   |
| `cooperative_manager`                                        | `manager`                                    | UNSET                               | Same-org / exact purpose / explicit read grant   | UNSET                   |
| `field_agent`                                                | `operator`                                   | UNSET                               | Same-org / exact purpose / explicit read grant   | UNSET                   |
| `warehouse_manager`                                          | `operator`                                   | UNSET                               | Same-org / exact purpose / explicit read grant   | UNSET                   |
| `buyer`                                                      | `operator`                                   | UNSET                               | Same-org / exact purpose / explicit read grant   | UNSET                   |
| `viewer`                                                     | `viewer`                                     | UNSET                               | Same-org / exact purpose / explicit read grant   | UNSET                   |
| Unknown/unmapped string (including raw `manager`/`operator`) | Presentation `viewer`, provenance `fallback` | Ineligible under certified controls | Cannot satisfy disclosure eligibility            | Not a ratifiable bypass |

Recommendation: retain no eligible roles until task justification is ratified.
For discussion, canonical `viewer` only is the narrowest already proposed
single-role candidate, **not an entitlement or approval**. If product tasks do
not justify viewer, approve none or revise the candidate.

Important enforceability boundary: policy currently sees mapped roles.
Approving `operator` includes the three canonical roles mapped to it;
`admin` includes both admin roles. A decision limited to only one member of
a collapsed category cannot be materialized as that category. Record a
separate implementation/proof prerequisite without downgrading existing C4
certification. No such engineering is authorized here.

Closure: `C4_HUMAN = APPROVED_RECIPIENT_ROLES` only with product sign-off,
source concurrence, applicable privacy conditions and exact enforceable scope.
Any changed roles/scope require a newly reviewed candidate/version.

## 3. Prohibited and residual uses (C7)

| Use                                      | Proposed disposition                        | Required completed decision                                                                 |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| CSV/XLSX/PDF or other export             | Prohibit                                    | UNSET: product ratification, source/privacy concurrence                                     |
| Bulk extraction                          | Prohibit                                    | UNSET                                                                                       |
| API redistribution / third-party sharing | Prohibit                                    | UNSET                                                                                       |
| Reporting or analytics reuse             | Prohibit secondary reuse                    | UNSET                                                                                       |
| Marketing or AI/model reuse              | Prohibit                                    | UNSET                                                                                       |
| Screenshots/manual copying               | Not preventable by API after lawful display | UNSET: recipient obligations, training, contractual/user-policy terms and enforcement owner |
| Unrelated purpose / cross-org disclosure | Prohibit                                    | UNSET: exact scope and exception prohibition                                                |

No export/bulk/onward/unrelated-use direction was approved as a source/privacy
grant. E14 in the [evidence catalogue](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md#2-canonical-repository-evidence)
supports technical surface isolation, not prevention of post-display copying.
Record user-policy instrument/version, acknowledgement, breach reporting,
sanctions/incident owner and permitted exceptions (if any); exceptions
broadening scope require separate review, not an implicit extension.

Closure: `C7_HUMAN = APPROVED_ONWARD_USE_POLICY` only with source and
Privacy/Legal concurrence and evidence of residual-use obligations.
Dates/signatures/evidence remain UNSET. Submit via the
[institutional checklist](CORA_DISCLOSURE_INSTITUTIONAL_ACTIVATION_CHECKLIST.md).
