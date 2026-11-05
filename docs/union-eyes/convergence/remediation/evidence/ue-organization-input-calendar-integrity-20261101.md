# Union Eyes — organization creation JSON and affiliation-calendar integrity (2026-11-01)

Source baseline: `ab9d481792033f10871fb61f9a834ce0388422c8` on `agents/ue-cursor-final-closure`.

The system-admin-only organization creation route previously called `request.json()` without handling malformed JSON, null or arrays, and accepted impossible affiliation days because JavaScript `Date.parse` normalizes some invalid dates. These inputs could produce server errors or a persisted date inconsistent with the administrator's stated calendar date.

Source correction: refuse non-object or malformed JSON with HTTP 400 before opening the system transaction; require an exact UTC calendar round-trip for optional `affiliation_date`. Existing authorization, parent hierarchy checks, atomic INSERT and audit remain unchanged. Adversarial tests cover malformed JSON, null, arrays, numeric bodies, non-leap Feb 29, Feb 31, Apr 31, and valid leap Feb 29. Tests authored, **not yet executed on this HEAD**.

No defect implementation/qualification/CLOSED credit. Exact-HEAD Vitest, native PG15/16, HTTP/browser, staging and independent institutional review remain outstanding. Frozen 777-defect provenance, the 150-item release-debt index and all 111 capabilities remain unchanged.
