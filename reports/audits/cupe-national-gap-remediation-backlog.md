# CUPE National Gap Remediation Backlog

This is a subsequent-wave backlog, not work performed by this audit.

| ID | Priority | Gap | Required remediation and acceptance evidence |
|---|---|---|---|
| CUPE-01 | Critical | National hierarchy cannot be demonstrated | Implement configurable hierarchy types and parent-child relationships for National, department, region, sector, local, committee and working group; test multi-context membership, least privilege and reorganization. |
| CUPE-02 | Critical | Aggregate oversight is not separated from record access | Define aggregate policy; implement server-side aggregate-only queries and deny record drill-down; add adversarial tests for every executive path. |
| CUPE-03 | Critical | Matter/document sensitivity lacks proof | Add sensitivity/privilege classifications, field/document restrictions, time-bound grants, break-glass justification and immutable audit; test senior-user denial. |
| CUPE-04 | Critical | Authorization coverage is incomplete | Inventory every API/action/service surface, assign owners, enforce common server auth/org scope, and require complete route-contract coverage in CI. |
| CUPE-05 | Critical | Cross-structure service is incomplete | Implement transfer, consultation, joint responsibility, consent, acceptance/rejection, return, SLA and complete audit trail. |
| CUPE-06 | Critical | Bilingual/accessibility assertions are unproven | Build parity inventory and CI checks; complete axe/keyboard/screen-reader/contrast/reflow/manual bilingual audits with defect closure. |
| CUPE-07 | Critical | Privacy/legal/operational assurance is unproven | Complete data-flow map, PIA/DPIA, residency/vendor review, retention schedule, incident playbook, restore drill and CUPE sign-off. |
| CUPE-08 | Critical | Migration is absent | Deliver dry-run migration tooling, mapping, identity matching, duplicate resolution, validation/reconciliation, rollback, provenance and bilingual encoding tests. |
| CUPE-09 | Critical | National scale is unproven | Establish workload model; execute capacity, load, soak, export/search/dashboard and failure/recovery tests against representative data. |
| CUPE-10 | Critical | AI confidential-use controls are incomplete | Enforce data-class policy, opt-in/disable controls, provider agreement, redaction path, trace/audit retention, human review UX and decision-use prohibition tests. |
| CUPE-11 | High | Records lifecycle is incomplete | Add versioning, legal hold, retention/disposition, redaction, replacement, duplicate handling and scanner availability behavior. |
| CUPE-12 | High | Notification assurance is incomplete | Implement/test language preference, delivery monitoring/retry, sensitive-data minimization, opt-out policy and audit history. |
| CUPE-13 | High | Metric semantics are not governed | Publish definitions, data quality flags, permissions and comparison caveats; test filters and exports across orgs. |
| CUPE-14 | High | Pilot operational readiness needs execution | Run pre-go-live walkthrough, support drill, role lifecycle, staging restore and authenticated governance proof; collect signed evidence. |
| CUPE-15 | Medium | Integration posture is not scoped | Conduct CUPE systems discovery; document system of record, identity, M365/SharePoint/Teams interfaces, API/webhook contracts and security tests. |

## Gate for any CUPE production decision

All Critical items require completed implementation evidence, independent security/privacy review, executed validation, and named CUPE approval. No backlog item is satisfied by a schema, plan, demo, or documentation-only artifact.
