# OCI Coverage Matrix™

DOCTRINE_VERSION: 1.0.0

> **Hard rule.** This matrix records how OCI™ artefacts **complement** widely-cited governance and continuity standards. It does NOT assert equivalence. It does NOT replace certification. It does NOT certify compliance.

## Coverage classes

| Class | Meaning |
|---|---|
| `FULL` | OCI alone satisfies the auditor's information need. |
| `PARTIAL` | OCI provides supporting evidence; standard still requires its own artefacts. |
| `ADJACENT` | OCI evidence informs but does not directly satisfy the requirement. |
| `OUT_OF_SCOPE` | Outside OCI doctrine. |

## Top-level coverage view

| Standard | Domain | Highest coverage class achieved | OCI frameworks invoked | Crosswalk document |
|---|---|---|---|---|
| ISO 22301:2019 | Business continuity (BCMS) | PARTIAL | CBM™, SDI™, RBI™, GES™, CSM™, Universal Confidence Model™, Audit Packet™ | [`OCI_ISO22301_CROSSWALK.md`](OCI_ISO22301_CROSSWALK.md) |
| ISO/TS 22317:2021 | Business Impact Analysis | PARTIAL | CBM™, SDI™, Universal Confidence Model™ | [`OCI_ISO22317_CROSSWALK.md`](OCI_ISO22317_CROSSWALK.md) |
| ISO 37000:2021 | Governance of organisations | PARTIAL | GES™, SDI™, RBI™, CBM™, Universal Confidence Model™ | [`OCI_ISO37000_CROSSWALK.md`](OCI_ISO37000_CROSSWALK.md) |
| ISO 31000:2018 | Risk management | PARTIAL | RBI™, GES™, HHI/Gini Anchoring™, Universal Confidence Model™ | [`OCI_ISO31000_CROSSWALK.md`](OCI_ISO31000_CROSSWALK.md) |
| COBIT 2019 | Enterprise governance of I&T | PARTIAL | GES™, SDI™, RBI™, CBM™, HHI/Gini Anchoring™, Universal Confidence Model™ | [`OCI_COBIT2019_CROSSWALK.md`](OCI_COBIT2019_CROSSWALK.md) |

## Per-framework coverage summary

| OCI Framework | Standards it provides PARTIAL coverage against | Standards it is ADJACENT to | Standards where it is OUT_OF_SCOPE |
|---|---|---|---|
| Stewardship Density Index™ (SDI) | 22301 §4.1 / §7.2, 22317 §6.3.3, 37000 oversight/leadership, COBIT EDM04 / APO07 | — | All operational/technical requirements |
| Governance Entropy Scale™ (GES) | 22301 §6.1, 37000 oversight, 31000 §6.4.2, COBIT EDM01 / APO12 | — | Strategy / value-creation |
| Continuity Burden Map™ (CBM) | 22301 §4.1 / §8.2.2, 22317 §6.3.2 / §6.3.3, 37000 accountability, COBIT EDM04 / APO07 | — | Recovery time objectives |
| Continuity Survivability Matrix™ (CSM) | — | 22301 §8.4.2 | BCPs, technical recovery |
| Reconstruction Burden Index™ (RBI) | 22301 §6.1, 37000 accountability, 31000 §6.4.2, COBIT APO07 / APO12 | — | Operational recovery |
| Universal Confidence Model™ | 22301 §9.1, 22317 §7.2, 37000 data & decisions, 31000 §6.6, COBIT MEA01 | — | — |
| Entropy Audit Packet™ | 22301 §9.3, 22317 §6.4.2, 37000 data & decisions, 31000 §6.6 | — | — |
| HHI / Gini Statistical Anchoring™ | 31000 §6.4.3, 37000 risk governance, COBIT APO12 | 22301 §8.2.2 (context only) | Quantitative risk scoring |
| Evidence Sufficiency Engine™ | 22301 §10.1 (corrective action input) | 22317 §6.4.2 | — |
| Reviewer Variance Model™ | 22301 §7.2, 37000 oversight | — | — |

## Explicit anti-claims

1. OCI is **not** equivalent to any cited standard.
2. OCI does **not** certify compliance with any cited standard.
3. OCI does **not** replace BCMS, governance, or risk-management certification.
4. OCI does **not** produce risk scores or rank institutions.
5. OCI **never** infers behavioural conclusions about individuals.

See also: [`OCI_AUDITOR_GUIDE.md`](OCI_AUDITOR_GUIDE.md), [`OCI_PROCUREMENT_POSITIONING.md`](OCI_PROCUREMENT_POSITIONING.md).
