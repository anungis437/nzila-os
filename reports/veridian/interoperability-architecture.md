---
platform: veridian-care
type: architecture
version: 1.0.0
status: pilot-ready
generated: 2026-04-27
---

# Veridian Care — Interoperability Architecture

## Data Architecture Overview

Veridian Care is designed as a governed orchestration layer that normalises and unifies clinical
data from multiple source systems without replacing them.

```
Source Systems → Connector Layer → Normalisation → Identity Resolution
    → Consent Enforcement → Clinical Timeline + Analytics + UI
```

Each layer is independently governed and audited.

---

## Connector Types

| Connector | Standard | Use Case |
|---|---|---|
| FHIR R4 | HL7 FHIR R4 | Modern EMR systems with FHIR endpoints |
| HL7 v2 | HL7 v2.x | Legacy messaging (ADT, ORU, ORM) |
| CSV | Batch import | Lab exports, legacy bulk data |
| REST API | Custom REST | Proprietary EMR APIs |
| Legacy export | Flat file / structured export | End-of-life systems with export capability |

All connectors operate in read-mode by default during the pilot. Write-back connectors require
a separate integration readiness review and Privacy Officer approval.

---

## Patient Identity Resolution

Veridian Care includes an MPI-lite (Master Patient Index) component designed to resolve patient
identity across source systems that use different patient identifiers.

- **Match criteria:** name, date of birth, MRN (per site), and gender
- **Confidence scoring:** each match is assigned a confidence score; low-confidence matches are
  flagged for manual review rather than auto-merged
- **Duplicate detection:** potential duplicates are surfaced to the network administrator for
  review before appearing in the unified timeline
- **No destructive merges:** identity resolution is additive and reversible; source records are
  never modified

---

## Clinical Timeline

The unified clinical timeline is the primary output of the Veridian Care platform:

- **Multi-source merge:** events from all connected source systems are merged into a single
  chronological view per patient
- **Chronological sort:** events are sorted by clinical date, not ingestion date
- **Source attribution:** every event in the timeline carries a source label (site + system)
  so clinicians always know where a record originated
- **Timeline flags:** conflicting records, low-confidence identity matches, and break-glass
  access events are flagged inline in the timeline view

---

## Integration Readiness Approach

Veridian Care uses a phased integration readiness process:

1. **Discovery:** inventory of source systems, data formats, and network topology
2. **Connector selection:** identification of the appropriate connector type per source system
3. **Synthetic validation:** connector configured against synthetic data in the staging environment
4. **Data quality review:** assessment of record completeness, date consistency, and identifier coverage
5. **Privacy review gate:** Privacy Impact Assessment completed before any live data flows

---

## No-Replace Philosophy

Veridian Care is explicitly designed as an orchestration layer, not an EMR replacement:

- Source systems remain the system of record for all clinical data
- Veridian Care does not write back to source systems during the pilot
- Clinicians continue to use their existing EMR for documentation and ordering
- Veridian Care provides a unified read layer for cross-site visibility and care coordination

---

## Legal Notice

All connector types and integration patterns described are **integration-ready** designs.
Actual connectivity depends on source system capabilities and network configuration confirmed
during the integration readiness review.
