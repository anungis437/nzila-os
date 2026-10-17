# Cora FV001 Authorization Model

**Profile:** `FV001` — Climate FieldView Platform APIs
**Status:** Documentation-only qualification. No FieldView account, app,
credentials, API access, or source data was used.

## Authorization layers are distinct

An OAuth grant, API key, partner agreement, operator instruction, Cora
authorization, and recipient approval are separate controls. The public
developer materials document the technical login flow and partner pathway;
they do not establish a Cora grant for source-data use.

| Layer                             | What public documentation establishes                                                                                                                                                                                                                                                              | Current Cora state                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Partner onboarding                | FAQ describes a three-step route: explain the business/value, talk to a Climate representative and agree on partner terms, then build/deploy. It links a partner information form. A developer account is stated to be free; that is not the same as production partner approval.                  | No Cora onboarding or agreement evidenced.                                                 |
| Application credentials           | The API Security page says a client ID and secret are provided by Climate. The v4 platform assigns an `X-Api-Key` with a partner-specific usage plan.                                                                                                                                              | No credentials exist or may be created in this qualification.                              |
| OAuth user consent                | OAuth2 authorization-code flow redirects the user to FieldView login and asks the user to authorize the partner app for explicitly requested, URL-encoded scopes.                                                                                                                                  | Mechanism documented; no actual user grant.                                                |
| Callback                          | The authorization request must use a fully qualified callback/redirect URI on the partner server. The short-lived code is returned to that URI and expires in about one minute.                                                                                                                    | No callback configured.                                                                    |
| Token exchange                    | The backend exchanges the code at `https://api.climate.com/api/oauth/token`; the security documentation requires the client’s Basic authorization and form-encoded grant. The access token is used in API Authorization headers.                                                                   | No token request made.                                                                     |
| Token lifetime                    | Access token lasts four hours. A refresh token lasts 30 days or until exchanged, is single-use, and is replaced on refresh. Documentation recommends securely/persistently storing and rotating the latest refresh token at least every 30 days.                                                   | Authentication-secret storage guidance only; not a data-retention right.                   |
| Scope and API key                 | Scopes are requested per endpoint and should be least-privilege; API key is assigned partner rate and monthly quota limits.                                                                                                                                                                        | Exact endpoint-scope combinations require resolution where published spec prose conflicts. |
| Resource visibility               | v4 `/operations/all` returns operations accessible to the authenticated user, with optional resource-owner filtering. FAQ says the APIs currently do not support data access for other users who shared operations with the authenticated user and recommends explicit partner-account connection. | Do not infer that shared Farm/FieldView data is available through the API.                 |
| Organization/connection selection | Unlike Deere’s published connection flow, the reviewed FieldView v4 OAuth documentation describes login and scope consent, not a separate user-selected organization connection screen. v5 has a preview `/v5/connections` route for application/resource-owner connection data.                   | No Deere-style organization selection or production connection semantics established.      |
| Disconnect/revocation             | No public v4 OAuth revocation endpoint or complete partner-disconnect effects were identified. Climate’s consumer account-deactivation/closure paths are separate and do not define Cora cleanup.                                                                                                  | Revocation effects for tokens and copies already received remain unresolved.               |

## v4 scope-to-capability index

The OpenAPI declares the following scope names; descriptions are abbreviated
here. Endpoint-specific requirements remain authoritative, including cases
where the prose and security declaration conflict.

| Scope                                                     | Published description or examples                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `fields:read`                                             | Retrieve field and boundary information.                                                                       |
| `farmOrganizations:read`                                  | Retrieve a farm organization.                                                                                  |
| `operations:read`                                         | Retrieve operations.                                                                                           |
| `resourceOwners:read`                                     | Retrieve resource owners.                                                                                      |
| `scouting:read`                                           | Retrieve scouting observations and attachments.                                                                |
| `asPlanted:read`, `asApplied:read`, `asHarvested:read`    | Read planting, application, and harvest activity data.                                                         |
| `asPlanted:write`, `asApplied:write`, `asHarvested:write` | Upload corresponding activity data.                                                                            |
| `exports:read`                                            | Request or retrieve exports. Some export descriptions add other scope requirements.                            |
| `fields:write`                                            | Upload field boundaries, per catalog description.                                                              |
| `boundaries:write`                                        | Required by `POST /v4/boundaries`, but absent from the top-level v4 scope catalog.                             |
| `rx:write`, `rxZones:write`                               | Prescription and prescription-zone upload descriptions; `rxZones:write` is not in the top-level scope catalog. |
| `imagery:write`, `soil:write`                             | Upload imagery and soil-sampling data.                                                                         |
| `plantingActivitySummary:read`                            | Read planting summary data; also named in export prose.                                                        |
| `diagnostics:read`                                        | Read CNH machine diagnostic data.                                                                              |
| `customerInsights:read`                                   | Read customer insight metrics.                                                                                 |
| `avroAgronomicData:read`                                  | Read agronomic data.                                                                                           |
| `platform`                                                | Legacy scope, explicitly marked deprecated; still appears on some v4 operations.                               |

The reviewed v4 and v5 scope lists do not define an `offline_access` scope.
Refresh-token issuance is documented as part of the OAuth flow independently
of a scope with that name. Do not import Deere scope names or permission
semantics into this connector profile.

## User permission ceiling and sharing

The public FieldView materials establish user login and consent to requested
scopes and describe API results in the authenticated user’s context. They do
not provide a complete role/permission matrix comparable to Deere’s
organization and permission-level tables. The FAQ explicitly says shared
operations belonging to other users are not accessible through the APIs at
the time of the reviewed page. It recommends users explicitly connect their
partner accounts with their Climate FieldView accounts.

This is a technical visibility limit, not evidence that an operator can
grant rights in other accounts or that a particular partner connection
entitles Cora to process data.

## Fail-closed authorization rule

A future FieldView capability must remain unavailable unless all relevant
controls are separately established: Climate partner approval and terms,
valid client/API credentials, scoped user grant, user-level resource
visibility, source and privacy rights for the requested purpose/action,
Cora organization authorization, operator direction where required, and
recipient authority. Token issuance alone cannot activate persistence,
normalization, export, sharing, or rehydration.

See the [capability-rights matrix](CORA_FV001_CAPABILITY_RIGHTS_MATRIX.md)
and [discovery gaps](CORA_FV001_DISCOVERY_GAPS.md) for unresolved questions.
