# UE V2 base-journey failure text and save-claim audit

Scope: the client screens of the V2 base journeys (invitation, sign-in policy, intake, case, documents, correspondence, messaging, member
home, deadlines, privacy, setup). Source-level audit and repair only. It is not staging evidence, and it does not change the gate ruling
(`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`). PR #1309 stays on hold and staging still serves the older application.

## Method

A scanner over 81 base-journey `.tsx` files (non-test) listed every site that:

- shows `error.message`, `String(error)`, `statusText`, `HTTP <status>` or parser text to a person;
- passes a hard-coded English sentence to a toast or error state;
- says a change was saved or sent;
- drops a failure (`.catch(() => null)`, `catch {}`) or calls `fetch` with no `ok` check.

Each hit was read in context and classified. The scanner is a triage aid; the classification below is manual.

## Policy now applied

`lib/client/api-envelope.ts` holds one policy for failures:

- English shows the reason the server states for client-side refusals (4xx). Bare generics (`Unauthorized`, `Forbidden`) get status wording instead. Every 5xx response receives controlled status wording in both languages, regardless of its message; backend diagnostics never appear in the interface.
- French shows a held translation of the server message, else status wording (sign-in, permission, missing, changed, too large, busy,
  not available), else the screen's own French fallback, else a generic French line.
- Anything that is not a failed API answer (`TypeError`, a shape error, an `HTTP 500` string) shows only the screen's own fallback.

A change is reported as saved only after an ok response and a read-back of the shape (and, for the sign-in policy, of the values).

## Findings and repairs

| Family | Where | Repair |
| --- | --- | --- |
| Server English reason shown in a French page | members list and detail, member home, preferences, my union, claims console and page, new claim, grievances consoles, workbench, inbox, documents, correspondence (dashboard, detail, composer), leadership, admin console, invitations | Shared policy; French tests for each family assert the English reason is absent |
| `HTTP <status>`, `statusText`, `String(error)`, parser text shown | members/[id], crud list reader, admin console (`useRemote`, removal, status, optimize toasts), claims detail, correspondence | Replaced by status wording or the screen fallback |
| Hard-coded English fallback | sign-in policy form, bulk document bar, new claim, case-context notice | Moved into message catalogs or bilingual component copy |
| Unconfirmed save claim | sign-in policy form (success shown on any ok response) | Success only when the read-back matches what was sent; otherwise "saved but not confirmed" |
| Failure dropped | sign-in policy load (stayed on "Loading" forever), bulk document actions (selection cleared on failure) | Alert with retry; selection kept and failure shown |
| Failure shown as emptiness | case-context panel (a failed read showed empty lists and rejected unhandled) | Failure notice; panels hidden on failure |
| False promise | bulk document bar offered a ZIP that is not produced | Copy states what is produced |
| Technical details returned in server 5xx messages | Shared client failure policy | All 5xx responses use controlled bilingual wording; an explicit regression test rejects SQL/error-text disclosure |
| Partial sign-in policy read-back | `components/admin/auth-policy-form.tsx` | Save confirmation checks every stored Boolean setting, the email-domain list and MFA-required roles; focused tests cover previously omitted method flags |
| Sign-in policy save semantics | `components/admin/auth-policy-form.tsx`, sign-in policy route | The browser sends the snapshot it loaded; the route locks the stored row, compares it to the snapshot and answers 409 when it moved (another administrator saved first), writes policy and audit in one transaction, and the form then reads the policy back without cache and compares every stored setting before it says saved. A mismatch, a failed read-back or a lost response is reported as not confirmed, never as saved |
| Magic-link verification | `app/magic-link/verify/page.tsx` | Second-factor step and bilingual refusals; 429 and 5xx distinguished from a refused link |
| Operator consoles | `components/admin/members-console.tsx`, `app/[locale]/dashboard/admin/page.tsx` | Failure text comes from the shared policy (5xx masked, 4xx reason or status wording); the AI endpoint tester now shows controlled text for failures instead of raw bodies. Both stay platform-only: routes require `platform_lead` and `requirePlatformStaffAuthority`, asserted by `platform-console-boundary.test.ts` |
| Private document delivery from case screens | grievance detail, related-document and precedent panels, grievance read, repository detail read | No stored address is returned or linked; each document opens through the audited, time-limited download path (`useAuthorizedDocumentOpen`) and a refusal is explained in English or French |
| Ambiguous sign-in policy write result | `components/admin/auth-policy-form.tsx` | A lost response cannot prove a rollback; wording requires reloading the authoritative policy before retrying. Missing policy lists cannot be treated as empty confirmation |

## Deliberate non-changes

- `components/admin/members-console.tsx` (platform members console) and the AI endpoint tester are English-only platform operator tools. They are excluded from the French requirement on purpose; their failure text still uses the shared policy and the boundary test proves a non-platform administrator cannot reach their routes.
- `components/documents/transcript-review.tsx` reads one refusal by matching its English server sentence. The coupling is recorded; the visible
  text is the screen's own.
- `app/invite/accept/page.tsx` already maps the server reason to French or falls back to its own line.
- `components/documents/ocr-upload.tsx` interprets status and body into fixed copy; it shows no raw text.

## Proof on file

- Focused vitest suites for each repaired family, including French and no-raw-text assertions.
- The five repository commands recorded in the PR description.

No proof of runtime behaviour in staging is claimed here.
