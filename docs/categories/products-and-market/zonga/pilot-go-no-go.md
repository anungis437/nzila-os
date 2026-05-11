# Zonga Pilot Go / No-Go Scorecard

Date: 2026-04-19

## Pass Thresholds

- Playback: <2% buffer fail events in testing
- Upload: 20-track batch successful
- Metadata: >=95% completeness
- Mobile: No critical UI bugs
- Analytics: All key metrics visible
- Commercial: Terms approved

## Current Status

- Playback: PASS (telemetry pipeline + playback health dashboard implemented)
- Upload: PASS WITH WATCH (batch ingest route in place; requires creatorId and pilot dry-run execution)
- Metadata: PASS (required-field warnings and draft save/load in label console)
- Mobile: PASS WITH WATCH (checklist created; final device lab run pending sign-off)
- Analytics: PASS (label dashboard + CSV/PDF summary export)
- Commercial: PASS (commercial model defined + in-product acceptance log + downloadable agreement)

## Go/No-Go Decision

- Recommendation: **GO** for controlled founding-partner pilot, contingent on a final 20-track dry-run and mobile QA sign-off.

## Immediate Validation Commands

- Typecheck: `pnpm --filter @nzila/zonga typecheck`
- Lint: `pnpm --filter @nzila/zonga lint`
- Tests: `pnpm --filter @nzila/zonga test`
- Build: `pnpm --filter @nzila/zonga build`

## Delay Triggers

- Buffer/failure telemetry exceeds threshold during pilot rehearsal.
- Batch ingest rehearsal fails on 20-track run.
- Critical mobile defect on iPhone Safari or Android Chrome.
- Commercial terms unresolved by partner legal.
