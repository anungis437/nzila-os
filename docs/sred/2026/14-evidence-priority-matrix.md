# 2026 Evidence Priority Matrix

Purpose: rank evidence sources by claim strength so advanced narratives are anchored to the strongest artifacts first.

Use rule:
- Always prioritize higher-strength evidence when supporting an advancement or failure entry.
- Use lower-tier sources only as supplementary context.

## Priority Matrix
| Source Type | Strength | Why It Matters | Use in Claim |
|---|---|---|---|
| Git commits (dated, attributable) | High | Shows concrete implementation progression and technical chronology | Primary |
| Test outputs and validation results | High | Demonstrates experimental behavior and outcomes | Primary |
| Experiment outputs (tables, logs, model evaluations) | High | Directly supports uncertainty-resolution claims | Primary |
| Architecture decision records (ADRs) | High | Captures rationale and alternatives considered | Primary/Secondary |
| Methodology docs and audit reports | Medium | Provides structured interpretation and framework continuity | Secondary |
| Whitepapers and doctrine summaries | Medium | Useful for framing but can be polished narrative | Secondary |
| Meeting notes and internal discussions | Medium | Supports context and decision timing | Secondary |
| Reconstructed narrative after the fact | Low | Highest risk of hindsight bias and weak direct proof | Tertiary only |

## Anti-Overweighting Controls
- Do not let polished narrative documents substitute for experimental artifacts.
- If a claim sentence cites only Medium/Low evidence, flag for Tier 1 or Tier 2 backfill.
- For each advancement in 11-advancement-registry.md, maintain at least one Tier 1 artifact link.

## Backfill Checklist
For each advancement and failure entry:
1. Add at least one dated commit reference.
2. Add at least one test/experiment output reference.
3. Add one rationale artifact (ADR or methodology/audit note).
4. Label weak evidence explicitly as contextual only.

## Review Cadence
- Review matrix application during weekly SR&ED evidence review.
- Re-rank evidence quality if new artifacts are discovered.
- Keep weighting consistent across all four claim scope areas.
