# Cora JD001 Authorization and Rights Model

**Profile:** `JD001` — John Deere Operations Center  
**Status:** Qualification model only. No authorization or source access is
granted.

## Authority layers

Authorization is a conjunction of independent authorities, not a single OAuth
grant. Each layer must be established for the named actor, subject, data,
purpose, recipient, action, and period.

| Layer                               | Authority question                                                                                                                                             | Current evidence and state                                                                                                                                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deere developer/application license | Is Cora’s legal entity entitled to register/use the application, and under what production agreement and restrictions?                                         | Deere publicly exposes an API Development License Agreement. Its displayed provisions describe internal development/testing and require a separate Production Agreement before third-party release. No Cora acceptance or production agreement is evidenced. `NOT_ESTABLISHED` / no use authorized. |
| Operator/account grant              | Can an eligible Deere account holder authorize this named app for the exact organization, operations, and scopes? What can the account holder grant or revoke? | Deere documents OAuth authorization-code flow, user-selected organization connections, scope-to-permission mapping, and a user permission ceiling. Eligible account roles and all revocation effects remain unresolved. `AUTHORIZATION_MODEL_DOCUMENTED` / `PARTIALLY_DOCUMENTED`.                  |
| Deere source/disclosure rights      | What contract permits access, processing, retention, derived use, export, and onward disclosure of Deere Content?                                              | The public development agreement is materially restrictive; it is not evidence of production rights or a Cora grant. Current rights are `NOT_ESTABLISHED`; fail closed.                                                                                                                             |
| Cora platform authority             | Is the authenticated actor bound to a canonical user and active organization membership with the precise Cora permission?                                      | Governed by [Cora authorization composition](CORA_AUTHORIZATION_COMPOSITION.md). Application permission alone is not source-disclosure permission.                                                                                                                                                  |
| Cora source-disclosure authority    | Is each field/action permitted for the source, purpose, recipient, and period?                                                                                 | Cora’s policy and source rights must separately allow disclosure. No Deere-specific policy or grant exists. `NOT_AUTHORIZED`.                                                                                                                                                                       |
| Operator authority and consent      | Has the operator validly authorized the particular processing and recipient use, and can that authority be withdrawn?                                          | Must be established independently. Operator consent cannot grant Deere’s API/application license or override source terms. `NOT_ESTABLISHED`.                                                                                                                                                       |
| Recipient authority                 | Can a named receiving institution receive, retain, and use the exact evidence for its decision?                                                                | Recipient-specific terms and accepted evidence formats are unknown. `NOT_ESTABLISHED`.                                                                                                                                                                                                              |

The Deere agreement is not treated as accepted by Cora merely because it is
publicly readable. The public page says acceptance creates an agreement and
contains a literal placeholder; applicability, currentness, and the production
contract require formal confirmation.

## Public OAuth and organization-connection mechanics

Deere's [Organizations documentation](https://developer.deere.com/dev-docs/organizations)
and [Partnerships documentation](https://developer.deere.com/dev-docs/partnerships)
describe external-application OAuth 2 authorization-code flow. A validated
Deere user must be able to sign in to the developer portal to create an
application; the app profile supplies an Application ID and Secret, and its
redirect/callback URI must be configured. The OAuth grant and token issuance
are followed by a distinct organization-connection step: the application
uses the `connections` link from `/organizations`, and the user selects which
of their organizations to connect in `connections.deere.com`. A user may
have access to several organizations and choose not to connect all of them.
After connection, Deere documents a `manage_connections` link.

Deere states that requested OAuth scopes map to permission levels and that
the application cannot receive more permissions than the connecting user
has. A later higher/new scope request requires the user to adjust the
application's connection permissions in Connections after the user has
obtained those permissions or received them from a partner organization.
The pages do not establish all eligible account roles or fully specify
revocation consequences for copies already received.

| Scope             | Documented permission mapping                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `ag1`             | View Locations: Clients, Farms, Fields, and associated data.                                                |
| `ag2`             | `ag1` plus Analyze Production Data (website access only).                                                   |
| `ag3`             | View Locations, Analyze Production Data, and Manage Locations and Production Data (website and API access). |
| `files`           | Files API access; `ag3` also required for most file types.                                                  |
| `eq1`             | View Equipment; RDA and setup/WDT-related permission mapping.                                               |
| `eq2`             | Equipment view/edit/manage, including detailed machine measurements; RDA and setup/WDT-related mapping.     |
| `work1` / `work2` | Work and Crop Plans Access Level 1 / Levels 1 and 2.                                                        |
| `offline_access`  | Requests a refresh token; it is an authentication scope, not a data-use permission.                         |

The access token expires after 12 hours. A refresh token is issued only when
`offline_access` is requested; an unused refresh token expires after 365
days. Deere's documentation says a refreshed token remains active unless the
customer removes all organization connections for the application in
Connections. These are technical token/connection facts only. Neither a
scope nor a connection grants Cora contractual authority to read, cache,
persist, normalize, derive, export, share, rehydrate, commercialize, or use
data for AI/model purposes.

## Action-by-action rights ledger

| Action                                            | Minimum authority required                                                                                             | Current JD001 disposition                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register an app, accept terms, create credentials | Authorized corporate acceptance of current Deere developer and production terms                                        | Not authorized by this qualification.                                                                                                                                              |
| Authenticate or call an API                       | Applicable Deere app license plus a verified operator grant for exact scopes/account and compliant credential handling | `NOT_AUTHORIZED`; no credentials or calls.                                                                                                                                         |
| Read/query specific records                       | All above, documented operation and field semantics, named purpose and subject                                         | `NOT_AUTHORIZED`; a bounded set of read capabilities is publicly documented, but production entitlement, complete schema semantics, and source rights are not established.         |
| Transiently process or validate                   | Express source and operator authority for the precise fields and purpose, plus privacy/security basis                  | `NOT_ESTABLISHED`; no payload processing.                                                                                                                                          |
| Copy or retain any Deere Content                  | Contractual permission, permitted location/duration, deletion and backup-expiry rules                                  | The displayed development agreement prohibits copying/storing Deere Content under that license. Production rights and retention terms are `NOT_ESTABLISHED`; no persistence.       |
| Normalize, derive, or display                     | Express permission for transformation/display and continued source attribution; verified semantics                     | `NOT_ESTABLISHED`; no mapping or derivation.                                                                                                                                       |
| Export, package, or rehydrate                     | Permission for portable copies/representations, interpretation, integrity and recipient disclosure                     | `NOT_ESTABLISHED`; capsule remains design-only.                                                                                                                                    |
| Reuse for another purpose or recipient            | Separate source, operator, Cora, and recipient authority for that purpose and recipient                                | `NOT_AUTHORIZED`; no cross-context reuse.                                                                                                                                          |
| Commercialize or monetize                         | Explicit production/commercial permission and legal/privacy review                                                     | Displayed development license bars monetary gain/third-party payment and requires a separate Production Agreement for release. Production terms remain unknown; no commercial use. |
| AI training or model improvement                  | Explicit permission naming data, model purpose, recipients, retention, and opt-out/deletion conditions                 | `NOT_ESTABLISHED`; no training or inference use.                                                                                                                                   |
| Correct, revoke, or delete copied data            | Source/operator correction and revocation semantics plus deletion across derived data, logs, backups, and recipients   | `NOT_PUBLICLY_ESTABLISHED`. Deere may modify/delete content in its own system under displayed §3.2; that is not evidence of propagation to Cora.                                   |
| Continue after provider exit or key revocation    | Contracted export/transition rights, retention/deletion rules, independent verification, recovery design               | `NOT_ESTABLISHED`. Under displayed §§14.2–14.3 access may end; no continuity right is established.                                                                                 |

## Non-inheritance rules

```text
Operator can view/export ≠ operator can authorize Cora to retrieve
OAuth permission ≠ source-rights permission
API read permission ≠ right to process or retain
Permission to display ≠ permission to copy, export, or redistribute
Integrity verification ≠ source authenticity or currentness
Operator consent ≠ receiving-institution acceptance
Cora permission ≠ Deere permission or institutional decision authority
```

## Required authority record before any future source action

Any proposed action must have a recorded grantor and legal basis; legal entity;
operator/account; organization and subject scope; source, exact operation and
fields; purpose and recipient; jurisdiction; start and expiry; retention and
deletion rules; derivative/export/rehydration treatment; revocation path;
security conditions; and proof of acceptance/approval. Missing, ambiguous,
expired, conflicting, or unsupported authority blocks that action.

## Current boundary

This model changes none of the organic-source gates:
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PHASE_3_PERMISSION = NONE_GRANTED`, and
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.
