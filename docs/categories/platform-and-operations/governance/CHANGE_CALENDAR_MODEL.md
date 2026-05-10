# Change Calendar Model

> How scheduling, freeze periods, and conflict detection work.

## Calendar Policy

The calendar policy is defined in YAML at
`ops/change-management/calendar-policy.yml` and loaded by the
`loadCalendarPolicy()` function.

### Schema

```yaml
freeze_periods:
  - name: "End of Year Freeze"
    start: "2026-12-20T00:00:00.000Z"
    end: "2027-01-03T00:00:00.000Z"
    environments:
      - PROD

restricted_hours:          # optional
  weekdays_only: true
  start_hour: 8            # UTC
  end_hour: 18             # UTC
```

## Freeze Periods

A freeze period blocks all non-emergency deployments to the specified
environments during the defined window. The `isInFreezePeriod()` function
checks whether a proposed implementation window overlaps any active freeze.

Freeze periods are enforced both in the `validateChangeWindow()` pre-deploy
gate and in the Control Plane calendar view (highlighted visually).

## Conflict Detection

`detectWindowConflicts()` scans all APPROVED, SCHEDULED, and IMPLEMENTING
change records for a given environment and returns any that overlap the
proposed implementation window. Each conflict includes:

- `conflicting_change_id` — the overlapping record
- `conflicting_title`
- `overlap_start` / `overlap_end` — the intersection range

This prevents two teams from deploying to the same environment simultaneously
without coordination.

## Window Validation

The `isWithinApprovedWindow()` function checks whether the current timestamp
falls within a change record's `implementation_window_start` and
`implementation_window_end`.

- **NORMAL/STANDARD** changes fail validation if outside their window
- **EMERGENCY** changes pass with a warning (bypasses window restriction)

## Control Plane Views

The `/change-calendar` page in the Control Plane displays:

- Staging and Production upcoming change windows side by side
- PIR reminders for completed changes awaiting review
- Real-time conflict indicators

## Utilities

| Function | Description |
|---|---|
| `windowsOverlap(a, b)` | Returns true if two `{start, end}` windows intersect |
| `isWithinWindow(timestamp, window)` | Returns true if a timestamp falls inside a window |
| `generateChangeId(seq?)` | Produces `CHG-YYYY-NNNN` format IDs |
| `parseChangeId(id)` | Extracts year and sequence from a change ID |
