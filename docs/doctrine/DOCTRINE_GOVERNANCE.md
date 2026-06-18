# Nzila OS — Doctrine Governance

<!--
  ARTIFACT TYPE: Doctrine Governance (Lifecycle Management)
  DOCTRINE_VERSION: 1.0.0
  CHANGE CLASS: Constitutional — founder sign-off required to modify this file.
  CANONICAL SOURCE: This file is self-governing.
-->

> The doctrine now requires governance.
> It is no longer just branding or positioning — it is institutional operating philosophy.
> Institutional operating philosophy that is ungoverned drifts.
> Drift is the exact problem the doctrine warns against.

---

# Artifact Ownership and Change Authority

| Artifact | Change Class | Who Can Change | Review Required |
|----------|-------------|----------------|-----------------|
| `constitution.md` | Constitutional | Founder only | Founder sign-off |
| `DOCTRINE.md` | Canonical | Doctrine review | 2-party review |
| `vocabulary.md` | Standard | Doctrine review | 1-party review |
| `frameworks.md` | Standard | Doctrine review | 1-party review |
| `DOCTRINE_GOVERNANCE.md` | Constitutional | Founder only | Founder sign-off |
| `DOCTRINE_TRACEABILITY.md` | Standard | Engineering + doctrine review | 1-party review |
| `SCORING_MODELS.md` | Standard | Doctrine + product review | 1-party review |
| `principles.md` | Standard | Doctrine + engineering review | 1-party review |
| `positioning.md` | Standard (canonical) | Doctrine review | 1-party review |
| `positioning.md` (GTM copy) | Light | Team | No formal review |
| `narrative-playbooks.md` | Light | Team | No formal review |
| `DOCTRINE_STRESS_TEST.md` | Internal | Doctrine review | 1-party review |

**Constitutional:** Requires explicit written approval from the founding decision-maker before any change is merged. No exceptions.

**Standard:** Requires at least one doctrine review — a thoughtful written review that explicitly addresses what is changing, why, and what doctrine anchor it connects to.

**Light:** May evolve with market feedback and operational experience. Document the change in the version history section of the file if it modifies canonical narrative direction.

---

# Versioning Standard

## Doctrine Version Format

```
DOCTRINE_VERSION: MAJOR.MINOR.PATCH
```

| Change Type | Version Component |
|-------------|------------------|
| Core thesis change, pillar addition/removal, constitutional amendment | MAJOR |
| New framework, vocabulary addition, principle addition | MINOR |
| Clarification, wording improvement, deduplication, compression | PATCH |

All artifact files embed `DOCTRINE_VERSION` in their header comment. When `DOCTRINE.md` version advances, all artifact files must be updated to reflect the current version.

---

# Change Protocol

## Before Making Any Change

1. Identify which artifact(s) are affected.
2. Identify the change class.
3. Confirm authority to change under the table above.
4. Document what is changing and why (one paragraph minimum for Standard+).
5. Check for cross-artifact consistency impacts.

## Cross-Artifact Consistency Checklist

When any of the following change, audit all listed files:

| Changed Item | Also Audit |
|-------------|-----------|
| Core thesis | constitution.md, DOCTRINE.md, positioning.md |
| A doctrine pillar | constitution.md, DOCTRINE.md, vocabulary.md, frameworks.md, DOCTRINE_TRACEABILITY.md |
| A vocabulary term | vocabulary.md, narrative-playbooks.md, positioning.md |
| A framework | frameworks.md, SCORING_MODELS.md |
| An engineering principle | principles.md, DOCTRINE_TRACEABILITY.md |
| Any canonical positioning | positioning.md, narrative-playbooks.md |

## After Making a Change

1. Update `DOCTRINE_VERSION` in the modified file.
2. Update `DOCTRINE_VERSION` in `DOCTRINE.md` if a canonical change.
3. Add an entry to the version history below.
4. Confirm `vocabulary.md` term deprecation log is current if terminology was changed.

---

# Deprecation Protocol

When a doctrine term, framework, or principle is deprecated:

1. **Never delete** the deprecated item from vocabulary.md or frameworks.md — move it to the deprecation log in that file.
2. Document the replacement term or framework.
3. Search and flag all uses in public-facing docs for update.
4. Add a deprecation note in `DOCTRINE.md` changelog.
5. Deprecated items remain interpretable so historical references remain coherent.

---

# Terminology Change Process

Terminology changes carry the highest drift risk because they propagate silently across all communication surfaces.

When a canonical vocabulary term changes:

1. The old term moves to the deprecation log in `vocabulary.md`.
2. The new term is added with a full definition and `DOCTRINE_VERSION` tag.
3. All files in `docs/doctrine/` must be audited for the old term.
4. All public-facing documentation must be queued for update.
5. The vocabulary level (L1–L4) must be explicitly assigned to the new term.

---

# Publication Governance

## Internal Artifacts (never publish externally without review)

- `constitution.md` — never publish without intentional founder authorization
- `DOCTRINE_STRESS_TEST.md` — internal red team only
- `DOCTRINE_TRACEABILITY.md` — internal product mapping only
- `principles.md` — may be summarized publicly; detailed engineering implications are internal

## Artifacts Safe for External Use (with review)

- Excerpts from `vocabulary.md`
- Framework summaries from `frameworks.md`
- Level 1–2 narratives from `narrative-playbooks.md`
- Canonical positioning from `positioning.md`

## Whitepaper / Conference Production Governance

Any publication, whitepaper, conference presentation, or procurement document that uses doctrine-level language must:

1. Be traceable to at least one entry in `vocabulary.md` or `frameworks.md`.
2. Not introduce new terminology not yet in `vocabulary.md`.
3. Not make scoring or measurement claims not yet supported by `SCORING_MODELS.md`.
4. Not claim architectural capabilities not yet documented in `DOCTRINE_TRACEABILITY.md`.

---

# Doctrine Version History

| Version | Date | Summary |
|---------|------|---------|
| 1.1.0-draft | 2026-06-06 | Institutional Intelligence category formation initiated. Wave 1.5 validation complete (discovery basis). Artifact 001 drafted and revised. Artifact 002 drafted. Artifact 003 Primer drafted (maturity model, IIA, sector patterns, roadmap, measurement). IIA standalone assessment drafted. Canonical Package created as constitutional reference. Validation gate kit complete. Canonical model frozen: Memory > Continuity > Governance > Trust > Institutional Intelligence > Resilience. |
| 1.0.0 | Initial | Canonical doctrine architecture created. All artifact files produced from deduplicated DOCTRINE.md. Humility Doctrine added to constitution. Governance lifecycle established. |
