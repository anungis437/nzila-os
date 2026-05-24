# OCI ↔ ISO/TS 22317:2021 (BIA) Crosswalk

DOCTRINE_VERSION: 1.0.0  
RELATIONSHIP CLASS: **complements** (NEVER equivalent-to)

> **Hard rule.** OCI™ does NOT perform Business Impact Analysis. OCI characterises the **continuity-bearing human fabric** that a BIA implicitly assumes is documented. ISO/TS 22317 specifies how to perform a BIA; OCI generates structural context the BIA can cite.

## Crosswalk

| ISO/TS 22317 Clause | OCI Framework | Coverage | Evidence generated | Limitations | Auditor validation logic | Confidence implications |
|---|---|---|---|---|---|---|
| 5.2 BIA programme | n/a | OUT_OF_SCOPE | none | OCI does not author BIA programmes. | n/a | n/a |
| 6.3.2 Prioritised activities | CBM™ | PARTIAL | Continuity Burden Map™ posture identifies institution-critical carriers underpinning prioritised activities. | OCI does not assign criticality to processes; it characterises carriers. | Confirm OCI carriers are cross-referenced to BIA-prioritised activities. | Confidence envelope must accompany the citation. |
| 6.3.3 Dependencies | SDI™, CBM™ | PARTIAL | Concentration and density of stewardship-side dependencies. | OCI dependencies are human-fabric dependencies, not technology dependencies. | Auditor checks SDI/CBM bands referenced in dependency register. | Confidence envelope mandatory. |
| 6.3.4 Resources required | n/a | OUT_OF_SCOPE | none | Resource quantification is a BCMS concern. | n/a | n/a |
| 6.3.5 MTPD/RTO/RPO determination | n/a | OUT_OF_SCOPE | none | OCI never asserts time-based recovery objectives. | n/a | n/a |
| 6.4.2 Documentation | Entropy Audit Packet™ | ADJACENT | Reproducible packets where OCI readings inform BIA narrative. | Not a BIA document. | Auditor checks packet hash referenced in BIA documentation. | Packet `confidence` informs BIA assumption register. |
| 7.2 Reporting | Universal Confidence Model™ | PARTIAL | Confidence envelopes accompany every OCI reading cited in BIA reports. | Reporting itself is BCMS-side. | Confidence states must appear with every OCI citation. | Mandatory. |

## Out-of-scope (explicit)

- All quantitative recovery objectives
- Technology dependencies
- Resource costing

See also: [`OCI_ISO22301_CROSSWALK.md`](./OCI_ISO22301_CROSSWALK.md), [`OCI_COVERAGE_MATRIX.md`](./OCI_COVERAGE_MATRIX.md).
