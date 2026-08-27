# 03 - Domain And Scenario Matrix

## Domain Determinations

| Domain | Determination | Evidence Level | Operational Meaning |
| --- | --- | --- | --- |
| A. Institutional and federated fit | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Org isolation and hierarchy exist, but LIUNA OPDC/CECOF/local boundaries are not modeled or tested end-to-end. |
| B. Leadership continuity and institutional memory | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Continuity engines and dashboards exist, but successor comprehension and responsibility transfer are not live-proven. |
| C. Onboarding, offboarding, reassignment | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Assignment and onboarding surfaces exist; deactivation/session revocation is not proven for LIUNA transition scenarios. |
| D. Legal confidentiality and restricted matters | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Case/document access grants exist, but privilege-sensitive matter segregation is not proven across OPDC/CECOF/local roles. |
| E. Organization isolation and authorization | `IMPLEMENTED_WITH_LIMITATIONS` | `TEST_PROVEN` | RLS and org context contracts exist; route-by-route live negative proof is incomplete for all LIUNA surfaces. |
| F. Case/matter lifecycle and deadlines | `IMPLEMENTED_WITH_LIMITATIONS` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Case and deadline APIs exist; legal deadline correctness must not be claimed. |
| G. Decisions, rationale, accountability | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Audit/update/event mechanisms exist; decision-rationale versioning is not proven for leadership handover. |
| H. Documents, evidence, defensible history | `IMPLEMENTED_WITH_LIMITATIONS` | `TEST_PROVEN` plus code support | Evidence exports, document auth, retention guard, and audit tests exist; chain-of-custody should be qualified. |
| I. Retention, legal hold, disposition | `PARTIAL` | `TEST_PROVEN` for guard behavior | Guard blocks mutation based on metadata, but policy lifecycle and matter-wide holds require more proof. |
| J. Reporting and leadership visibility | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Dashboards exist; safe aggregation without raw disclosure is not LIUNA-proven. |
| K. Security, privacy, residency, assurance | `IMPLEMENTED_WITH_LIMITATIONS` | `RUNTIME_PROVEN` for UE health plus test/code evidence | UE runtime is healthy and storage-backed; legal/privacy certification is out of scope. |
| L. Bilingual, accessible, mobile field use | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Locale/mobile surfaces exist; LIUNA bilingual mobile scenario is not executed. |
| M. Import, export, migration, interoperability | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Import/export APIs exist; complete handover package independent of UE access is not proven. |
| N. Human-controlled intelligence | `IMPLEMENTED_WITH_LIMITATIONS` | `TEST_PROVEN` for selected unit tests | AI is framed as advisory, but restricted-source filtering must be scenario-tested before recording claims. |
| O. Production and support readiness | `IMPLEMENTED_WITH_LIMITATIONS` | `RUNTIME_PROVEN` for health/readiness | Live UE is healthy; LIUNA tenant/config/support readiness is not yet established. |
| P. Tailored-video veracity | `PARTIAL` | `INFERRED` from this audit | A recording is possible only with explicit limitations and careful claim selection. |

## Scenario Response Matrix

| Scenario | Result | Evidence Level | Video Consequence |
| --- | --- | --- | --- |
| 1. Planned leadership transition | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Show as controlled reassignment concept only unless a tested path is built. |
| 2. Unexpected unavailability | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Can discuss need and dashboard intent; do not claim full recovery workflow. |
| 3. Counsel/legal-team change | `NOT_READY` | `INFERRED` | Do not demonstrate privilege-sensitive counsel handover as proven. |
| 4. Affiliated-local officer change | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Must qualify central/local scope as configurable and discovery-dependent. |
| 5. Central oversight without unrestricted disclosure | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Safe as design principle; not as proven LIUNA federation behavior. |
| 6. Deadline ownership transition | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Can show generic deadline continuity; no legal-deadline correctness claim. |
| 7. Decision-rationale preservation | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Can show audit/history surfaces; rationale completeness is not proven. |
| 8. Access revocation | `INSUFFICIENT_EVIDENCE` | `NOT_ASSESSED` | Do not claim session/direct-link/document-link revocation until tested. |
| 9. Restricted matter | `NOT_READY` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Must not show highly restricted matter without negative tests. |
| 10. Retention or legal hold | `PARTIAL` | `TEST_PROVEN` | Can say mutation guard exists; do not claim full legal-hold lifecycle. |
| 11. Defensible handover export | `PARTIAL` | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` | Can show evidence export; call it a structured export, not complete chain of custody. |
| 12. Service interruption/restoration | `INSUFFICIENT_EVIDENCE` | `NOT_ASSESSED` | Do not include in recording except as roadmap/proof artifact if separately validated. |
| 13. Bilingual mobile continuation | `INSUFFICIENT_EVIDENCE` | `NOT_ASSESSED` | Do not claim full bilingual mobile task completion. |
| 14. AI-assisted continuity briefing | `PARTIAL` | `TEST_PROVEN` for selected copilot unit behavior | Use "human-reviewed draft/briefing aid"; do not imply autonomous decisions. |

## Authorization And Segregation Matrix

| Boundary | Current Support | Gap |
| --- | --- | --- |
| Same-org member vs steward | Role hierarchy and route tests exist | Not all LIUNA-relevant routes have negative tests. |
| Primary case owner vs collaborator | Case access service models owner/collaborator roles | Successor transition semantics not tied to case access handover. |
| Private documents | Explicit grants and case access flags exist | Restricted legal matter class not proven end-to-end. |
| Central oversight | Hierarchical roles exist | Raw-vs-aggregate access distinction needs implementation proof. |
| Former user | Role/user APIs exist | Session revocation, direct URL, queued notification, and document URL invalidation not proven. |
