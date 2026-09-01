# OCI Data Handling

**ARTIFACT TYPE:** Institutional Doctrine — Data Processing Disclosure
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**INTENDED READER:** institutional data governance, privacy review, integration counterparts
**PARENT DOCTRINE:** [OCI Privacy Position](./OCI_PRIVACY_POSITION.md)

> This document describes what data OCI handles, where it travels,
> what leaves the institutional boundary and what does not. It is
> written for institutional reviewers who need a concrete account
> of data flows.

---

## Tenancy and keys

Each institution runs in its own database instance (not a shared, row-level-isolated multi-tenant
table). The institution's data is encrypted at rest under Azure-managed keys scoped to that
instance; Nzila does not hold a separate copy of the encryption key outside the Azure resource
the institution's contract names. This is the short answer to "whose tenant, whose keys" — see
Subprocessors below for who else touches the data, and Deletion on contract close for what
happens to the evidence pack when the relationship ends.

## Categories of data

OCI handles four categories of institutional data, each with its own
handling rules.

### Institutional records

The institution's own governance and continuity records — decisions
and their lineage, role definitions, succession notes, ratified
plans, board minutes referenced by the workbook. These are the
institution's authoritative records and are stored in the
institution's database instance under its own retention rules.

### Stewardship cartography

Records that name memory holders, the responsibilities they carry,
and the continuity dependencies surrounding them. These are
institutional records about institutional roles. Individuals named
in cartography records are stewards, never subjects of measurement.

### Workbook working data

Notes, drafts, and intermediate workbook entries produced during
the Mapping and Stabilization phases. This data is retained for the
duration of the engagement and through the period defined in the
institution's contract, then archived or deleted under the
institution's instruction.

### Facilitation transcripts (optional)

If the institution opts in, working sessions may be transcribed for
the institution's own reference. Transcripts are stored in the
institution's records. They are not used for inference, scoring, or
training of any kind. Default is no transcription.

---

## What leaves the institutional boundary

Three classes of data leave the institutional Azure tenant under
specific, bounded conditions:

### 1. Hosted reasoning inference

When AI-assisted facilitation is in scope, request payloads pass to
Azure OpenAI resources in East US (`nzila-openai-eastus`) and East
US 2 (`nzila-openai-eastus2`). The boundary rules:

- The payload contains the working context, not the institution's
  full record set.
- Microsoft does not use the inference data for model training
  (Azure OpenAI commercial terms).
- No payload is retained by the OCI runtime beyond the immediate
  response.
- The institution may disable hosted reasoning entirely by contract;
  the workbook and facilitation continue to operate without it,
  at lower interpretive density.

### 2. Aggregate sector intelligence (opt-in)

If the institution participates in sector intelligence (OCI Method™
Phase 5), the following data leaves the institutional boundary
under explicit consent:

- aggregated, anonymised stewardship density distributions across
  sector cohorts,
- aggregated governance entropy patterns across institutional types,
- aggregated continuity breakpoint categories (not specific
  breakpoints, not identifying details).

What does not leave the boundary under any condition:

- individual steward identities,
- institutional decisions and their rationale,
- governance interpretations,
- workbook working data,
- transcripts of facilitation sessions.

Each aggregate publication is reviewed by the institution's
governance liaison before contribution. Withdrawal is supported at
any time and applies to future aggregates.

### 3. CRM and partner-facing systems

Where the institution maintains a partner-facing CRM (for example,
to coordinate sector partners or to record engagement state),
synchronisation between the OCI runtime and the partner CRM is
**aggregate-only**. Specifically:

- engagement-level state (phase, cadence, ratified artifact
  identifiers) may flow;
- steward-level information does not flow;
- workbook contents do not flow;
- governance interpretations do not flow.

This boundary is enforced at the integration layer, not by
convention. Attempts to expand the synchronisation scope require
explicit governance approval and a written amendment to the data
handling addendum for the institution.

---

## Data flows, by phase

| Phase | Inbound to OCI | Internal processing | Outbound from OCI |
|---|---|---|---|
| Recognition | OCRA inputs supplied by sponsor | OCRA computation | Executive Continuity Brief (printed and digital to sponsor) |
| Mapping | Steward observations; role data | Workbook engines (stewardship density, governance entropy) | Workbook PDF to sponsor; cartography to governance liaison |
| Stabilization | Stabilisation moves; succession notes | Governance continuity planning | Governance continuity plan to governance body |
| Embedding | Engagement state | Runtime continuity systems | Aggregate sector contribution (if opted in, reviewed per publication) |

No outbound flow is unattended. Each outbound artifact has a named
recipient, a documented purpose, and a recorded handover.

---

## Logging and observability

Operational telemetry — request rates, error rates, latency,
infrastructure health — is collected through Azure Monitor and
Application Insights. Telemetry is operational, not behavioural:

- no user productivity measures,
- no user attention measures,
- no inferred behavioural traits,
- no scoring of any kind.

User identifiers in telemetry are pseudonymised at the application
boundary where the use case does not require the real identifier.

---

## Backup and recovery

Backups are managed by the Azure Database for PostgreSQL Flexible
Server backup mechanism and by Azure Blob Storage backup
containers. Backup retention follows the institution's contract.
Restoration is tested annually and verified end-to-end by an
operator who is not the routine database operator.

---

## Subprocessors

The current institutional runtime relies on the following
subprocessors:

| Subprocessor | Purpose | Region |
|---|---|---|
| Microsoft Azure (compute, storage, database) | Application hosting | Canada Central |
| Microsoft Azure OpenAI | Hosted reasoning inference (optional) | East US, East US 2 |
| Microsoft Entra ID | Identity (optional) | Global |

Additions to the subprocessor list are notified to the institution
in writing not less than thirty days before the new subprocessor
begins handling institutional data.

---

## Deletion on contract close

On contract close, the institution may select one of three
outcomes:

1. **Return and delete.** Records are exported to the institution
   in a documented format; OCI deletes its copies on a documented
   schedule.
2. **Delete in place.** OCI deletes records without export, with
   the institution acknowledging the consequence in writing.
3. **Continue under archival contract.** Records are retained
   under a narrower archival contract for the period the
   institution specifies.

The chosen outcome is recorded in the close-out memo and confirmed
in writing.

---

## Cross-references

- [OCI Privacy Position](./OCI_PRIVACY_POSITION.md)
- [OCI Security Overview](./OCI_SECURITY_OVERVIEW.md)
- [OCI AI Boundary](./OCI_AI_BOUNDARY.md)
- [OCI Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md)
