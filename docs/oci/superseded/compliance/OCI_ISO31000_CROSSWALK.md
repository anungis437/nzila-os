# OCI ↔ ISO 31000:2018 (Risk management) Crosswalk

DOCTRINE_VERSION: 1.0.0  
RELATIONSHIP CLASS: **complements** (NEVER equivalent-to)

> **Hard rule.** OCI™ does NOT define a risk management framework, does NOT publish risk treatments, and does NOT replace ISO 31000. OCI surfaces a **continuity-burden** lens that contextualises certain categories of governance and operational risk.

## Crosswalk

| ISO 31000 Element | OCI Framework | Coverage | Evidence generated | Limitations | Auditor validation logic | Confidence implications |
|---|---|---|---|---|---|---|
| 4 Principles | OCI Doctrine | ADJACENT | OCI doctrine references the principles its design respects. | Not a risk principle library. | n/a | n/a |
| 5.4 Establishing the context | CBM™, SDI™ | PARTIAL | Continuity-burden and stewardship-density posture. | Not a risk context register. | Cite CBM/SDI in context narrative. | Confidence envelope mandatory. |
| 6.4.2 Risk identification | RBI™, GES™ | PARTIAL | Surfaces continuity-reconstruction and governance entropy structural risk surfaces. | Does not enumerate risks per ISO 31000. | Cross-reference RBI/GES in risk register. | Caution states accompany cited risks. |
| 6.4.3 Risk analysis | HHI/Gini Statistical Anchoring™ | PARTIAL | Concentration/inequality statistical context. | Statistical, not normative. | Confirm HHI/Gini outputs cited as context, never as risk scores. | Mandatory. |
| 6.4.4 Risk evaluation | n/a | OUT_OF_SCOPE | none | OCI does not assign risk priority. | n/a | n/a |
| 6.5 Risk treatment | n/a | OUT_OF_SCOPE | none | OCI does not author risk treatments. | n/a | n/a |
| 6.6 Recording & reporting | Universal Confidence Model™, Audit Packet™ | PARTIAL | Reproducible packets and confidence envelopes. | Not a risk-reporting framework. | Hashes recorded with risk register entries. | Confidence envelope mandatory. |

## Anti-claims (explicit)

- OCI does **not** produce risk scores.
- OCI does **not** rank risks.
- OCI does **not** prescribe risk treatments.
- HHI/Gini outputs contextualise; they do not evaluate.

See also: [`OCI_COVERAGE_MATRIX.md`](OCI_COVERAGE_MATRIX.md).
