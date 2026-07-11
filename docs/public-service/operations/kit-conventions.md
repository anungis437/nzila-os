# CLEAR/SAGE Kit Conventions

## Template metadata

| Field | Value |
| --- | --- |
| Template version | v0.1 |
| Status | Internal operating draft |
| Owner | Nzila Ventures |
| Last updated | 2026-07-11 |
| Related framework | CIVIC / CLEAR / SAGE |
| Public or internal | Internal only |
| Calibration source | Proof Run 0.1 retrospective, Section 11 |

> Internal governance material. This is a shared conventions reference for the CLEAR/SAGE Alpha
> Operating Kit. It is not a public route, UI, product, demo, pricing, pilot, procurement offer, or
> availability claim.

## 1. Purpose

Proof Run 0.1 showed that several kit fields were filled in with ad hoc wording: status words, confidence
levels, authorized-only markers, and risk-tier phrasing all varied by hand. This file defines the shared
standards so the same word means the same thing across every template and proof run. Apply these
conventions when completing any kit template.

## 2. Standard internal-use disclaimer

Every completed workspace or proof-run file must carry a disclaimer at the top. Use one of the
following standard blocks, unchanged.

For internal proof runs, completed workspaces, samples, and dry-run materials:

> **Fictional internal dry run. Does not refer to any real institution. Not for external use.**

For retrospectives:

> **Fictional internal dry run retrospective. Does not refer to any real institution. Not for external use.**

For reusable blank templates that are not completed fictional runs:

> **Internal operating template. Not public copy. Not for external use unless separately reviewed and approved.**

The disclaimer must not name real institutions in negation. Avoid phrases such as “not CBC” or
“not Radio-Canada.” Use generic language such as “not a real institution” instead.

## 3. Standard status definitions

Use these three status words, and only these, on checklists and gates:

| Status | Definition |
| --- | --- |
| **PASS** | The item is confirmed by a human reviewer with evidence on hand. No open concern. |
| **NEEDS REVIEW** | The item is incomplete, uncertain, or awaiting accountable human confirmation. Not cleared until resolved. |
| **N/A** | The item does not apply to this workspace, and the reason is recorded. |

A package or workspace is not cleared while any required item is **NEEDS REVIEW**.

## 4. Standard confidence levels

Use these four confidence levels for evidence and findings, grounded in the CLEAR confidence rubric
(provenance, durability, corroboration, recency, completeness, decision relevance, sensitivity):

| Level | Meaning |
| --- | --- |
| **low** | Single weak or unverified source; provenance or recency unclear. Not decision-grade. |
| **low–moderate** | Some corroboration, but material gaps remain. Human review required before use. |
| **moderate** | Reasonable provenance and corroboration; some gaps noted. Supports human review, not decisions. |
| **high** | Strong provenance, corroboration, and recency; gaps documented. Still organized for human decision, never a decision itself. |

`Insufficient` remains available when there is no usable evidence at all. No confidence level ever
converts a finding into a decision.

## 5. Standard authorized-only marker

When a source may only be used with explicit authorization, mark it with the standard marker and carry
the standard placeholder disclaimer:

- **Marker:** prefix the source name with `[AUTHORIZED-ONLY]`.
- **Placeholder disclaimer (for templates and dry runs):**

  > Rows marked `[AUTHORIZED-ONLY]` are placeholders for workflow testing. They do not imply access,
  > collection, review, permission, data extraction, or system integration.

An `[AUTHORIZED-ONLY]` source is never collected, copied, or accessed without explicit, recorded
authorization and demonstrated necessity.

## 6. Reusable risk-tier phrasing

Risk tiering is always confirmed by accountable humans. Use this reusable phrasing pattern rather than
writing tier language from scratch:

> **Level N — [short description of the institutional question's risk].** Applied here for a fictional
> internal dry run. In a real engagement, risk tiering would require accountable human confirmation.

Tier reference (from the CLEAR method): Level 1 (low) · Level 2 (moderate) · Level 3 (elevated) ·
Level 4 (high). The tier is never set automatically and never implies a finding of wrongdoing.

## 7. How to apply

- **Assurance checklist** — use the Section 3 status definitions for every item.
- **CLEAR brief** — use the Section 4 confidence levels and Section 6 risk-tier phrasing.
- **Evidence source register** — use the Section 5 authorized-only marker and placeholder disclaimer.
- **SAGE workspace** — mirror sources from the register and CLEAR brief; do not restate them as new.
- **All completed files** — carry the Section 2 disclaimer block.

These conventions are calibration output from the Proof Run 0.1 retrospective. They do not change any
boundary, do not create software, and do not change SAGE's future-facing status.
