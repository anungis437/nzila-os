# 32 - OPDC / CECOF Provisional Working Vocabulary

## Status

`LIUNA_VOCABULARY_SHEET = SYNTHETIC_WORKING_DRAFT_PENDING_CLIENT_VALIDATION`
`NOT_CLIENT_VALIDATED`
`NOT_ENDORSED_BY_LIUNA_OPDC_CECOF`

Every term on this sheet is a Union Eyes working assumption. No term here should be adopted into a rehearsal script, client-facing brief, or product surface as canonical without going through OCI-workshop validation and a maintainer-applied ledger update.

## Register

- Plain-language institutional Canadian labour and union register.
- Avoid legalese unless a specific term is unavoidably legal.
- EN and FR-CA equivalents are complete parallel experiences, not line-by-line interleaved bilingual text.
- Where the plain-language term differs from the strict legal term, both are recorded; the plain-language term is the default UI term and the strict term is available as a tooltip or glossary entry.

## Per-Term Status Values

Every row carries a status. Nothing provisional silently becomes canonical.

- `SYNTHETIC_WORKING_TERM` - Union Eyes-authored default. Assume incorrect until validated.
- `REPO_DERIVED` - term already present in the Union Eyes codebase or existing docs. Also assumed provisional here.
- `CLIENT_VALIDATED` - only after a documented workshop or written client confirmation. Set by maintainer, not by the vocabulary author.
- `REJECTED` - workshop or client review explicitly refused the term. Kept in the sheet for audit; not used in product.

## Vocabulary Table

| Concept | EN Term | FR-CA Term | EN Status | FR-CA Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Person representing a member in a workplace matter | Steward | Delegue | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Confirm whether "shop steward" or a local-specific title is preferred. |
| Paid representative supporting stewards | Staff representative | Representant du personnel | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | May be titled differently in OPDC vs. CECOF context. |
| Person receiving representation | Member | Membre | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Confirm whether "represented member" is preferred where scope is ambiguous. |
| Central overseer body | Central body | Organisme central | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Do not conflate with the client itself. |
| Affiliated local body | Affiliated local | Section locale affiliee | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Number-based identification pattern to be confirmed. |
| Workflow envelope for a single represented situation | Case | Dossier | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | "Grievance" may be preferred in some contexts; do not silently substitute. |
| Formal complaint under a collective agreement | Grievance | Grief | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Confirm whether stage numbering language is required. |
| Non-grievance representation situation | Matter | Affaire | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Kept distinct from "grievance" on purpose. |
| Attached record inside a case | Document | Document | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Retain synthetic marker in fixtures. |
| Marked-for-preservation state | Legal hold | Retenue legale | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Confirm plain-language equivalent for member-facing surfaces. |
| Access removal for a former user | Access revocation | Revocation d'acces | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Bounded to app-auth boundary per Gate 3B and Gates 10A/B/C. |
| AI-assisted advisory helper | Copilot | Copilote | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Always advisory, human-reviewed, audit-referenced. |
| Handover to a successor holder of a role | Continuity handover | Transfert de continuite | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Not "succession" alone; keep "continuity" to avoid legal-succession confusion. |
| Audit-safe evidence snapshot | Evidence export | Exportation de preuve | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Staff-scoped only; not a legal chain-of-custody certification. |
| Aggregate-only central reporting output | Aggregate reporting | Rapports agreges | `REPO_DERIVED` | `SYNTHETIC_WORKING_TERM` | Raw local rows are never exposed. |
| Sensitive information posture | Sensitive-data posture | Posture des donnees sensibles | `SYNTHETIC_WORKING_TERM` | `SYNTHETIC_WORKING_TERM` | Neutral phrase; avoid "privileged" unless matching a legal frame. |

## Terms Explicitly NOT Adopted Provisionally

The following terms are common in the market but Union Eyes will not adopt them provisionally without client confirmation, because misuse would create a false claim:

- "solicitor-client privilege guaranteed" (never say guaranteed).
- "LIUNA-approved" (never; discovery only).
- "production-ready for LIUNA" (never; only bounded gate closures apply).
- "endorsed" or "sponsored" (never).
- "official French version" (never; FR-CA is provisional equivalent, not official translation).

## Change Rules

- Vocabulary changes proposed in the OCI workshop are captured in `workshop-vocabulary-delta-DATE_TBD.md`.
- A maintainer must review each delta row before flipping any term's status to `CLIENT_VALIDATED`.
- A term that flips to `CLIENT_VALIDATED` must be applied to product surfaces in a discrete follow-up commit; never combined with a functional code change.
- A term that flips to `REJECTED` must be removed from every rehearsal script and fixture in the same follow-up commit; the removed term is retained in this sheet with `REJECTED` status for audit.

## Cross-References

- Used by the workshop pack (`28-oci-workshop-pack.md`) as the reference sheet for equivalents.
- Used by the recording package baseline (`29-recording-package-v1-handoff-baseline.md`) for allowed spoken terms.
- Used by the fixture set (`30-synthetic-fixtures-manifest.md` + `31-synthetic-fixtures-v1.json`) for bilingual labels.
