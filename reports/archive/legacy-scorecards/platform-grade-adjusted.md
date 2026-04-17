# Platform Grade — Adjusted

> Generated: 2026-03-10T20:46:02.745Z

## Overall: **A-**

This grade is computed with severity-weighted scoring where:
- Any ERROR immediately caps the dimension at C+ or below
- Warnings degrade from A+ progressively
- INFO findings are non-blocking

## Per-Dimension Assessment

### Architecture: **B**
- Errors: 0
- Warnings: 1256
- 4516 files scanned

### Security: **A+**
- Errors: 0
- Warnings: 0
- org-isolation + SDK boundary checks

### Governance: **A**
- Errors: 0
- Warnings: 2
- 20/22 claims verified, 2 partial

### Documentation: **B**
- Errors: 0
- Warnings: 373
- 709 files scanned

### Portfolio Maturity: **B**
- Errors: 0
- Warnings: 41
- 19 production-ready, 3 scaffold-only

### Test Coverage: **A**
- Errors: 0
- Warnings: 2
- 2 apps without tests, 0 platform pkgs without tests

### Validation Integrity: **A**
- Errors: 0
- Warnings: 3
- 367 info-level findings

## ✅ No Release Blockers


## Action Items

1. 2 production apps lack test coverage
2. Complete 2 partially-implemented claims
3. Fix broken documentation links and stale references
