# Centralized Coverage Reporting

Coverage artifacts already exist in the repo root:

- `coverage.xml` (machine-readable source)
- `coverage_html/index.html` (human-friendly drilldown)

## Generate Aggregated Dashboard

Run:

```bash
pnpm coverage:dashboard
```

Outputs:

- `reports/coverage/dashboard.md`
- `reports/coverage/dashboard.json`

The dashboard includes:

1. Global line coverage summary.
2. Coverage distribution buckets.
3. Lowest-coverage files list for remediation targeting.

## Suggested CI Integration

1. Run tests that produce `coverage.xml`.
2. Run `pnpm coverage:dashboard`.
3. Upload `reports/coverage/dashboard.md` and `reports/coverage/dashboard.json` as artifacts.
4. Optionally publish markdown summary in PR comments.

## Ownership

- Platform team owns dashboard schema and generation script.
- Domain teams own remediation of low-coverage hotspots in their areas.
