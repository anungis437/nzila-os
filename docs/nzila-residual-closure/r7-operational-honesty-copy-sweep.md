# R7 — Operational Honesty Copy Sweep

> **Status: PARTIALLY CLOSED.** Sweep inventory + banner taxonomy shipped; copy edits scoped to `chore/r7-operational-honesty-copy-sweep`.

## Authority

This document is the canonical operational honesty copy sweep procedure for Nzila OS. Every runtime banner, fallback message, degradation signal, and cognition-suppression notice MUST be governance-safe, continuity-safe, anti-surveillance, evidence-anchored — never inflated, never celebratory on recovery, never silently degraded. Operational, institutional, deterministic, bounded.

## 1. Banner taxonomy (canonical)

The operational honesty layer recognizes exactly the following banner classes. The chore PR sweeps every UI surface and reconciles each user-visible string to one of these classes.

| Banner class | Trigger | Canonical copy pattern | Forbidden framings |
|---|---|---|---|
| **service-degraded** | upstream provider 5xx, queue overflow | "<service> is degraded — operations queued for retry" | "service is back online soon", "estimated recovery in N minutes" |
| **cognition-suppressed** | OpenAI outage, schema violation, missing context | "cognition unavailable — reviewer-of-record path active" | "AI is thinking", "intelligent suggestions temporarily off" |
| **review-queued** | governance API surface 503 | "review queued — substrate restoring" | "we'll process this shortly" |
| **dispatch-degraded** | notification provider degraded | "notification dispatch degraded — queued for retry" | "your message will arrive soon" |
| **lineage-readonly** | PG primary write-blocked | "operational memory read-only — write substrate restoring" | "saving disabled temporarily" |
| **cadence-paused** | cadence emitter dependency degraded | "cadence emission paused — substrate restoring" | "we paused notifications" |
| **operational-recovery** | substrate restored | "operational recovery — cadence resumed at <ISO>" | "🎉 we're back!", "service restored — fully operational" |

## 2. Forbidden framings (rejected globally)

The following classes of copy are structurally forbidden across the UE surface:

- **Inflated readiness** — "fully operational", "100% available", "all systems go"
- **Celebratory recovery** — emoji-loaded recovery copy, marketing tone on the recovery path
- **Ambient AI assistant framing** — "AI is thinking", "smart suggestions", "intelligent assistant"
- **Confidence theater** — confidence percentages without reviewer-of-record anchor
- **Silent suppression** — degraded surfaces that show pre-degradation copy as if nothing changed
- **Operational ambiguity** — "may have been delivered", "should arrive shortly"
- **Marketing collapse** — operational status surfaces using marketing tone (CTAs, hero copy)

## 3. Sweep scope

The chore PR sweeps the following surface categories:

- **UE Next surface** — `apps/union-eyes/app/**/*.{tsx,ts}` for user-visible JSX strings
- **i18n catalogs** — `apps/union-eyes/messages/*.json` (en-CA / fr-CA / it / pt)
- **Email templates** — `apps/union-eyes/lib/notifications/templates/**`
- **System banner emitter** — operational status banner component
- **Dashboard layout shells** — degraded-state copy in layout components
- **Error boundaries** — fallback UI copy
- **Toast/notification surfaces** — runtime feedback strings

## 4. Sweep procedure

For each surface category:

1. Enumerate every user-visible string (rg over JSX text + i18n catalog values)
2. Classify each string against the banner taxonomy (or mark "non-banner" — informational copy)
3. For each banner-class string, verify it matches the canonical copy pattern OR rewrite to match
4. For each forbidden framing match, rewrite to the canonical equivalent
5. Update i18n catalog parity across en-CA / fr-CA / it / pt (no missing translations)
6. Capture before/after diff in the chore PR

## 5. Validation procedure

```powershell
# Forbidden framing scan (must return zero matches after sweep)
rg -i "fully operational|100% available|AI is thinking|smart suggestions|🎉|we're back" apps/union-eyes/

# i18n parity (each banner key must exist in all 4 catalogs)
node tooling/scripts/validate-i18n-parity.mjs apps/union-eyes/messages
```

## 6. Anti-pattern enumeration (rejected)

- inflated readiness language
- celebratory recovery banners
- ambient AI assistant framing
- confidence theater
- silent suppression of degradation
- operational ambiguity
- marketing collapse on operational surfaces

## 7. Cadence

Copy sweep is bound to:

- per addition of a new degradation surface
- per i18n catalog change
- quarterly operational honesty review

## 8. Verdict

R7 inventory + taxonomy is **fully specified**. Copy edits scoped to a discrete chore PR — institutional, bounded, honest.

**Status: PARTIALLY CLOSED. Chore PR: `chore/r7-operational-honesty-copy-sweep`.**
