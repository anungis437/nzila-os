# R3 — Continuity Degradation Drill Corpus

> **Status: PARTIALLY CLOSED.** Drill protocol shipped; live execution scoped to recurring chore cadence `chore/r3-continuity-degradation-drill-corpus`.

## Authority

This document is the canonical continuity degradation drill protocol for Nzila OS. Continuity (steward transitions, onboarding lineage, governance review continuity, operational memory, cadence emission, recovery) must survive operational degradation **without losing institutional memory**, **without re-emitting degraded cadence events**, and **without silent attribution change**. Governance-safe, continuity-safe, anti-surveillance, evidence-anchored, reviewer-of-record bound. Operational, institutional, deterministic, bounded.

## 1. Drill matrix

| Drill | Trigger | Expected behavior | Lineage preservation |
|---|---|---|---|
| **Onboarding degradation** | block notification provider during invitation accept | invitation row written with `status='pending_outage'`; deferred notification queued | invitation lineage append-only; never silently dropped |
| **Steward-transition degradation** | initiate steward transition while cadence emission paused | transition recorded in lineage; new steward sees prior lineage on first authenticated load | reviewer-of-record attribution preserved |
| **Governance-review degradation** | scale Django sidecar to 0 mid-review | Next surface 200, auth fail-closed; governance API returns 503 with "review queued" copy | prior lineage read-only available; new verdicts queued, not dropped |
| **Operational-memory degradation** | block PG primary writes (force read-only) | reads remain available; writes queued; replay deterministic on substrate return | memory never collapsed to "current state only" |
| **Cadence degradation** | block cadence emitter dependency mid-emission | cadence event paused (not skipped); reviewer-of-record sees bounded "cadence emission paused" banner | cadence resumes deterministically on substrate return; never silently re-emitted at degraded fidelity |
| **Recovery restoration** | restore each subsystem above | replay queued events in original order; re-validate reviewer-of-record anchors; emit single bounded "operational recovery — cadence resumed at <ISO>" notice | full lineage reconstructible; no celebratory readiness notice on recovery path |

## 2. Execution procedure

For each environment (dev / staging / demo; pilot scoped to post-R1):

1. Capture pre-drill baseline lineage state (snapshot the relevant lineage tables)
2. Execute degradation trigger
3. Probe each surface for bounded behavior
4. Verify lineage append-only contract: `SELECT count(*) FROM <lineage_table> WHERE created_at > $baseline` matches expected queued count
5. Restore subsystem
6. Verify deterministic replay: queue drains in original order; lineage reconciles
7. Capture artifact under `chore/r3-continuity-degradation-drill-corpus` evidence directory

## 3. Required outputs (per drill)

- **continuity preservation** — pre/post lineage snapshot diff
- **memory preservation** — read-only fallback works during degradation
- **lineage preservation** — append-only contract honored (no silent rewrite)
- **bounded degradation** — retries capped at bounded budget; queue capped at bounded ceiling
- **operational recovery integrity** — replay deterministic; no silent skip; no silent attribution change

## 4. Anti-pattern enumeration (rejected)

- silent loss of cadence events
- silent rewrite of historical lineage
- silent skip of paused cadence
- silent attribution change on steward transition
- unbounded retry loops
- silent queue overflow
- collapse of memory into current-state-only view
- celebratory readiness notice on recovery path

## 5. Cadence

Continuity drills are bound to a stewardship cadence:

- per substrate change (KV mint, identity rotation, image cut)
- per governance schema migration
- per reviewer-of-record cohort change
- quarterly institutional drill

## 6. Verdict

R3 protocol is **fully specified, evidence-anchored, reviewer-of-record bound, cadence-aligned**. UE behaves like continuity infrastructure under operational pressure: append-only, bounded, deterministic, calm.

**Status: PARTIALLY CLOSED. Chore PR: `chore/r3-continuity-degradation-drill-corpus` (recurring).**
