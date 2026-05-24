# OCI ↔ COBIT 2019 Crosswalk

DOCTRINE_VERSION: 1.0.0  
RELATIONSHIP CLASS: **complements** (NEVER equivalent-to)

> **Hard rule.** OCI™ does NOT certify COBIT compliance and does NOT replace ISACA frameworks. OCI provides **governance entropy** and **continuity burden** context that a COBIT 2019 implementation can cite when characterising the human continuity layer beneath IT and enterprise governance objectives.

## Crosswalk (selected governance & management objectives)

| COBIT 2019 Objective | OCI Framework | Coverage | Evidence generated | Limitations | Auditor validation logic | Confidence implications |
|---|---|---|---|---|---|---|
| EDM01 — Ensured governance framework setting and maintenance | GES™ | PARTIAL | Governance entropy ordinal contextualises sustainability of the governance framework. | OCI does not set the framework. | Cite GES ordinal in EDM01 commentary. | Confidence envelope mandatory. |
| EDM04 — Ensured resource optimisation | SDI™, CBM™ | PARTIAL | Stewardship density and continuity burden posture for governance-critical resources. | Not a resource-optimisation model. | Cite SDI/CBM bands in EDM04 commentary. | Confidence envelope mandatory. |
| APO01 — Managed I&T management framework | n/a | OUT_OF_SCOPE | none | OCI is not an IT-management framework. | n/a | n/a |
| APO07 — Managed human resources | SDI™, RBI™ | PARTIAL | Stewardship concentration and reconstruction burden contextualise HR continuity risk. | Not an HR management framework. | Cite SDI/RBI in APO07 commentary. | Confidence envelope mandatory. |
| APO12 — Managed risk | RBI™, GES™, HHI/Gini Anchoring™ | PARTIAL | Structural continuity-risk surfaces and concentration statistics. | Not a risk register or scoring engine. | Cite OCI outputs as context, not as risk scores. | Confidence envelope mandatory. |
| BAI06 — Managed IT changes | n/a | OUT_OF_SCOPE | none | OCI does not manage IT changes. | n/a | n/a |
| DSS01 — Managed operations | n/a | OUT_OF_SCOPE | none | OCI does not run operations. | n/a | n/a |
| MEA01 — Managed performance and conformance monitoring | Universal Confidence Model™ | PARTIAL | Confidence-aware monitoring of OCI readings; decay schedule. | Not an enterprise monitoring framework. | Cite decay band schedule in MEA01 commentary. | Mandatory. |
| MEA03 — Managed compliance with external requirements | All crosswalks under [`docs/oci/compliance/`](.) | PARTIAL | Cross-reference compliance documentation that OCI complements. | OCI does not certify compliance. | Confirm crosswalk documents referenced in compliance register. | n/a |

## Out-of-scope (explicit)

- IT controls
- IT change management
- Operations management
- Procurement of IT
- Vendor management

See also: [`OCI_COVERAGE_MATRIX.md`](./OCI_COVERAGE_MATRIX.md).
