# UE V2 base-journey failure text and save-claim audit

Scope: the client screens of the V2 base journeys (invitation, sign-in policy, intake, case, documents, correspondence, messaging, member
home, deadlines, privacy, setup). Source-level audit and repair only. It is not staging evidence, and it does not change the gate ruling
(`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`). PR #1308 stays on hold and staging still serves the older application.

## Method

A scanner over 81 base-journey `.tsx` files (non-test) listed every site that:

- shows `error.message`, `String(error)`, `statusText`, `HTTP <status>` or parser text to a person;
- passes a hard-coded English sentence to a toast or error state;
- says a change was saved or sent;
- drops a failure (`.catch(() => null)`, `catch {}`) or calls `fetch` with no `ok` check.

Each hit was read in context and classified. The scanner is a triage aid; the classification below is manual.

## Policy now applied

`lib/client/api-envelope.ts` holds one policy for failures:

- English shows the reason the server states. A bare generic (`Internal server error`, `Unauthorized`) gets status wording instead.
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

## Deliberate non-changes

- `app/[locale]/dashboard/admin/page.tsx` AI endpoint tester shows the status and body as received. It is a platform operator tool and says so.
- `components/admin/members-console.tsx` (platform members console) is an English-only operator console; its strings were not localized in this change.
- `components/documents/transcript-review.tsx` reads one refusal by matching its English server sentence. The coupling is recorded; the visible
  text is the screen's own.
- `app/invite/accept/page.tsx` already maps the server reason to French or falls back to its own line.
- `components/documents/ocr-upload.tsx` interprets status and body into fixed copy; it shows no raw text.

## Proof on file

- Focused vitest suites for each repaired family, including French and no-raw-text assertions.
- The five repository commands recorded in the PR description.

No proof of runtime behaviour in staging is claimed here.
