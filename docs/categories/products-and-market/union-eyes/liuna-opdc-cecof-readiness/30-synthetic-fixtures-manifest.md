# 30 - Synthetic Fixtures Manifest (V1)

## Status

`LIUNA_SYNTHETIC_FIXTURES = V1_DETERMINISTIC`
`NOT_CLIENT_VALIDATED`
`NO_REAL_MEMBER_DATA`

Every entity described here is fabricated by Union Eyes for rehearsal, recording, and evidence purposes only. No entity in this manifest corresponds to any real LiUNA affiliate, local, member, matter, staff person, counsel, or communication.

## Fabrication Rules

Fixture authors MUST follow all six rules:

1. **Obviously synthetic names.** Organization names begin with `SYNTHETIC` or the `-DEMO` suffix. Personal names are drawn from a fixed working set that would never plausibly be confused with a real person.
2. **Deterministic identifiers.** Every UUID, case number, document ID, and audit event ID is generated from the seed `LIUNA_UE_FIXTURE_SEED_V1` so that regenerating the set is reproducible and diffable.
3. **Non-real dates.** Every date is within the fabricated corridor `2099-01-01` to `2099-12-31`. Nothing in the fixture set may fall within a real fiscal or grievance window that could be mistaken for production activity.
4. **No plausible member PII.** Emails end in `@example.invalid`. Phone numbers use the reserved `555-01` North American prefix range. Addresses use `RFC 2606` example placeholders.
5. **Non-legal document content.** Attachments are short synthetic narratives clearly labeled as `SYNTHETIC_DOCUMENT_FOR_DEMO_USE`. No lifted text from a real matter, no scraped counsel language, no reused fixture from another client.
6. **Bilingual parity.** Every synthetic surface with a member-visible label carries an equivalent FR-CA label sourced from `32-opdc-cecof-provisional-vocabulary.md`. Never machine-translate inside the fixture set.

## Manifest

The instantiated fixture file is `31-synthetic-fixtures-v1.json`. It is deterministic and safe to regenerate.

### Organizations

Two synthetic organizations, deliberately schematic. Modeled to exercise the OPDC / CECOF / affiliated-local pattern without adopting any real LiUNA structure.

- `SYNTHETIC-CENTRAL-DEMO` (represents a central overseer pattern).
- `SYNTHETIC-LOCAL-1836-DEMO` (represents an affiliated local pattern).

### Roles

- Steward, staff, counsel, central-analyst, member. All labeled as synthetic.

### People

- Six people total, two per role bucket where applicable. Names are drawn from the fixed synthetic set; no name matches any known LiUNA staff, elected officer, or member.

### Matters

- Three synthetic matters:
  - `MATTER-DEMO-A` (continuity handover rehearsal).
  - `MATTER-DEMO-B` (restricted-document boundary rehearsal).
  - `MATTER-DEMO-C` (evidence export rehearsal).

Each matter carries a status timeline entirely inside the `2099` fabricated corridor.

### Documents

- Nine synthetic documents (three per matter). Each carries the `SYNTHETIC_DOCUMENT_FOR_DEMO_USE` marker in body and metadata.

### Audit Events

- One event per state transition, seeded so the hash chain is deterministic across regenerations. Correlation IDs are prefixed `SYN-CORR-`.

## Regeneration

To regenerate, run the fixture loader with `LIUNA_UE_FIXTURE_SEED_V1` set as the only seed input. Any output whose digest does not match the digest recorded in `31-synthetic-fixtures-v1.json` header is considered contaminated and must be discarded.

## Prohibited Uses

- Using the fixture set to substantiate any claim about LiUNA behavior, outcomes, or approval.
- Combining fixture rows with any real member, matter, staff, or organizational record.
- Publishing the fixture set outside the internal rehearsal / recording context.
- Renaming synthetic entities to remove the synthetic markers.

## Cross-References

- Consumed by `29-recording-package-v1-handoff-baseline.md`.
- Vocabulary bindings sourced from `32-opdc-cecof-provisional-vocabulary.md`.
- Every fixture-touched surface must still respect the gate proofs in files 12 through 27.
