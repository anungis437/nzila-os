# OCI ↔ ISO 22301:2019 Crosswalk

DOCTRINE_VERSION: 1.0.0  
COMPILED: under the OCI Method™ Methodology Whitepaper v1.0.0  
RELATIONSHIP CLASS: **complements** (NEVER equivalent-to)

> **Hard rule.** This crosswalk does NOT assert that OCI™ is equivalent to ISO 22301, does NOT claim to replace BCMS certification, and does NOT certify ISO compliance. OCI is the **human continuity layer** beneath operational resilience and governance continuity systems. ISO 22301 specifies a Business Continuity Management System; OCI characterises the continuity-bearing **people fabric** that any BCMS implicitly depends on.

## Coverage classes used in this document

| Class | Meaning |
|---|---|
| `FULL` | OCI generates evidence that satisfies the auditor's information need for this clause without further mapping. |
| `PARTIAL` | OCI generates supporting evidence; clause still requires BCMS artefacts not produced by OCI. |
| `ADJACENT` | OCI produces evidence about an adjacent concern that informs but does not directly satisfy the clause. |
| `OUT_OF_SCOPE` | The clause is outside the doctrine of OCI; consult a BCMS practitioner. |

## Crosswalk

| ISO 22301 Clause | OCI Framework | OCI Artefact | Coverage | Evidence generated | Limitations | Auditor validation logic | Confidence implications |
|---|---|---|---|---|---|---|---|
| 4.1 Understanding the organisation and its context | Continuity Burden Map™ (CBM), Stewardship Density Index™ (SDI) | CBM posture, SDI band | PARTIAL | OCI articulates the continuity-bearing roles and concentration of institutional knowledge that contextualise organisational dependencies. | Does not produce the BCMS context register; the OCI burden map is a posture, not an inventory. | Confirm CBM posture and SDI band reference reviewer-led inputs and that confidence states are recorded. | Universal Confidence Envelope must be present and non-`INSUFFICIENT` for the reading to inform context. |
| 4.2 Needs and expectations of interested parties | OCI Anti-Surveillance Position™ | Doctrine doc | ADJACENT | Documents how OCI scopes interest-party data minimally and aggregately. | Does not enumerate interested parties for BCMS. | Confirm anti-surveillance doctrine is referenced in the BCMS register. | n/a |
| 5.2 Policy | Doctrine Governance §13 | Policy framework | ADJACENT | Doctrine governance reference. | Not a BCMS policy. | n/a | n/a |
| 6.1 Actions to address risks | Reconstruction Burden Index™ (RBI), Governance Entropy Scale™ (GES) | RBI band, GES ordinal | PARTIAL | Continuity-reconstruction posture and governance entropy ordinal contextualise risk treatments. | RBI is a structural index, not an ISO risk register entry. | Confirm RBI and GES outputs carry confidence envelopes and caution states. | Caution states surface to risk-treatment commentary. |
| 7.2 Competence | SDI, Reviewer Variance Model™ | Reviewer panel, calibration confidence | PARTIAL | Records reviewer panel calibration; does not certify competence of operational staff. | OCI evaluates reviewer calibration, not operator skill assessments. | Confirm reviewer panel size and calibration confidence. | INSUFFICIENT calibration must trigger reviewer-led re-examination, not BCMS rejection. |
| 8.2.2 Business impact analysis | CBM, RBI | CBM posture, RBI band | PARTIAL | Aggregate continuity posture supports BIA narrative; OCI does NOT produce quantitative BIA. | BIA needs BCMS-side process inventory; OCI provides the human carrier layer. | Confirm CBM/RBI artefacts are cross-referenced from the BIA. | Confidence envelopes flow into BIA assumptions register. |
| 8.4.2 Business continuity plans and procedures | Continuity Survivability Matrix™ (CSM) | CSM cell | ADJACENT | CSM characterises survivability of human continuity; BCPs cover process recovery. | OCI does not author BCPs. | Confirm CSM cell is referenced in BCP assumptions. | n/a |
| 9.1 Monitoring, measurement, analysis | Universal Confidence Model™ | Confidence envelopes | PARTIAL | Confidence states and decay bands provide monitoring signal for OCI readings. | Not a BCMS measurement programme. | Confirm decay bands trigger reviewer refresh per doctrine. | Mandatory. |
| 9.3 Management review | Governance Entropy Audit Program™ | Entropy Audit Packet™ | PARTIAL | Reproducible packets support management review of governance entropy. | Packets are not BCMS management-review minutes. | Confirm packet `reproducibilityHash` recorded in management-review record. | Packet `confidence` becomes part of review record. |
| 10.1 Nonconformity & corrective action | Evidence Sufficiency Engine™ | Escalation flags | PARTIAL | Evidence sufficiency escalations indicate where reviewer-led re-examination is required. | Does not enumerate nonconformities in the BCMS sense. | Escalation flags should be triaged through the existing corrective-action workflow. | Escalation priority informs triage priority. |

## What OCI deliberately does NOT cover

- ISO 22301 clause 8.3 (business impact analysis — quantitative MTPD/RTO/RPO targets)
- ISO 22301 clause 8.5 (exercise programme)
- Any technical recovery procedure
- Any operational BCMS audit programme

These are explicitly `OUT_OF_SCOPE` for OCI.

## Auditor reading note

OCI™ is best read as **the human continuity substrate** that any 22301-aligned BCMS implicitly assumes exists. Treat OCI outputs as **structural context with explicit confidence**, not as conformance evidence.

See also: [`OCI_COVERAGE_MATRIX.md`](OCI_COVERAGE_MATRIX.md), [`OCI_AUDITOR_GUIDE.md`](OCI_AUDITOR_GUIDE.md).
