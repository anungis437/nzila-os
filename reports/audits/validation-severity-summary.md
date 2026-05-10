# Validation Severity Summary

> Generated: 2026-03-10T20:46:02.745Z

## Severity Distribution

| Severity | Count |
|----------|-------|
| ERROR    | 0 |
| WARNING  | 1677 |
| INFO     | 367 |

## Findings by Dimension

| Dimension | Errors | Warnings | Grade |
|-----------|--------|----------|-------|
| Architecture | 0 | 1256 | B |
| Security | 0 | 0 | A+ |
| Governance | 0 | 2 | A |
| Documentation | 0 | 373 | B |
| Portfolio Maturity | 0 | 41 | B |
| Test Coverage | 0 | 2 | A |
| Validation Integrity | 0 | 3 | A |

## Severity Policy

### ERROR — Must fail release
- Unsupported platform claims in buyer-facing docs
- Missing env validation in production apps
- Missing request correlation ID in API handlers
- Governance bypass on sensitive operations
- Broken doc links in buyer-facing docs
- org_id from request body (tenant isolation violation)

### WARNING — Degrades score
- Missing README for production-critical package
- Production app without tests
- Missing health route in production app
- Missing audit hook coverage
- API route without correlation ID
- Config without Zod validation

### INFO — Non-blocking
- Style issues
- Optional docs
- Minor naming inconsistencies
