# Chapter 03 — Authentication & Multi-Org Isolation

This chapter documents the authentication provider configuration and the
multi-org isolation model used by **{{PRODUCT_NAME}}**.

## Authentication provider

The application uses **{{AUTH_PROVIDER}}** for identity management.

### Key configuration

| Variable             | Description                          |
| -------------------- | ------------------------------------ |
| `AUTH_SECRET`        | Session signing secret               |
| `AUTH_PROVIDER_URL`  | {{AUTH_PROVIDER}} issuer / tenant URL |
| `AUTH_CLIENT_ID`     | OAuth 2.0 client identifier          |
| `AUTH_CLIENT_SECRET` | OAuth 2.0 client secret              |

### Session flow

1. User visits a protected route.
2. Middleware checks for a valid session cookie.
3. If absent, the user is redirected to {{AUTH_PROVIDER}} for login.
4. On callback, a session is created and the `{{ORG_KEY}}` claim is extracted from the token.

## Multi-org isolation

Org isolation is enforced at the data layer using the **{{ORG_KEY}}**
column present on every org-scoped table.

### Isolation rules

- Every database query includes a `WHERE {{ORG_KEY}} = ?` clause.
- Row-Level Security (RLS) policies mirror this constraint at the database level.
- API middleware injects the authenticated `{{ORG_KEY}}` into the request context so that downstream handlers never need to resolve it manually.

### Adding a new organization

1. Provision a record in the `organizations` table.
2. Create an {{AUTH_PROVIDER}} organization or group for the org.
3. Map the organization identifier to the `{{ORG_KEY}}` value.

## Security considerations

- Never trust a client-supplied org identifier; always derive it from the authenticated session.
- Rotate `AUTH_SECRET` on a regular cadence and after any suspected compromise.
- Audit log every org-switching event for compliance.
