# Union Eyes QA — User Story Coverage Matrix

This matrix tracks user story coverage across QA scenarios for the Union Eyes pilot.

## Coverage Matrix

| Story ID | Description | Status | Blocker Level |
|----------|-------------|--------|---------------|

## Concurrency Stories

| Story ID | Description | Status | Blocker Level |
|----------|-------------|--------|---------------|
| CONCURRENCY-ASSIGNMENT-RACE | Concurrent assignment of the same case must resolve to exactly one winner; duplicate assignment returns 409 | covered | production_blocker |
| CONCURRENCY-ESCALATION-RACE | Concurrent escalation transitions must be serialised; second in-flight transition returns 409 | covered | production_blocker |
| CONCURRENCY-STALE-UPDATE | Stale version write to case status must return 409 to prevent silent data loss | covered | production_blocker |
| CONCURRENCY-DOUBLE-SUBMIT | Duplicate intake submission with same idempotency key must return 409 on repeat | covered | pilot_blocker |
