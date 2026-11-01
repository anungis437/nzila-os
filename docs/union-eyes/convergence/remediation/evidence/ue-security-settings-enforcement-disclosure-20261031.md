# Union Eyes Gate 0 — organization security-setting enforcement disclosure

Defect: `DEF-0B11-IDS-SETTINGS-SECURITY-POLICY-VALUES-ARE-SAVED-AS-UPDATED-TRUE-AND-ENFORCED-BY-NO-CODE`.

## Source correction

The organization-settings GET now reports the persisted `notEnforced` keys, not only the PUT response. The organization-settings screen reads that server-owned status on initial load and displays an explicit, bilingual warning that the security options are stored preferences, **not active sign-in, session or password controls**. After a save it retains the server's enforcement status. A failed HTTP request, an unsuccessful API envelope, or a response without `updated: true` no longer clears unsaved changes or implies success; the screen displays a bilingual error. This prevents a returning administrator from assuming that previously saved MFA, password, session, IP or domain preferences are being enforced.

Source:
- `apps/union-eyes/app/api/settings/organization/route.ts`
- `apps/union-eyes/app/[locale]/dashboard/settings/_components/org-settings-content.tsx`
- `apps/union-eyes/lib/services/__tests__/s47-settings-enforcement-ui.test.ts`

## Qualification separation

**Source-level:** the above changes were committed to `agents/ue-cursor-final-closure`. **Unit:** a focused regression test was authored; no execution claim is made in this record. **Native PostgreSQL 15/16:** not established for these changes. **HTTP/browser/staging:** not established. **Independent institutional acceptance:** not obtained.

This is an incremental truthful-disclosure correction, **not** implementation of the security controls. The defect remains PARTIAL: authentication/session/password enforcement must consume institution-approved policy with fail-closed semantics, and every affected user journey needs adversarial runtime proof. No CLOSED credit, ratification, GO or release authorization is claimed. Frozen qualification artifacts and all 777 original defect identifiers remain unchanged.
