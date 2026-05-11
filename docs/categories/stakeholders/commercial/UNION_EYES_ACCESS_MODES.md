# Union Eyes — Access Modes

How members, stewards, and administrators sign in to Union Eyes.

## Three ways to get in

### 1. Email and password

The default for individual members and stewards. Modern hashing (Argon2id),
optional password complexity policy, and a one-hour reset window. Lock-out
after five failed attempts protects against brute force.

### 2. Email me a sign-in link (passwordless)

Type your email, click a link in your inbox, you're in. Links are valid for
fifteen minutes and can only be used once. Ideal for occasional users,
front-line stewards on shared devices, and anyone who would otherwise reset
their password every visit.

### 3. Continue with Microsoft (single sign-on)

Sign in with the same Microsoft account you use for email and Teams. No
password to remember, no link to wait for. Recommended for corporate
deployments where IT already manages identity centrally.

## Org administrators are in control

Each organization can choose which methods are available to its members:

- **Open** (default): all three methods on; users pick what they prefer.
- **SSO required**: only "Continue with Microsoft" is offered. Useful where IT mandates centralized identity for compliance or audit reasons.
- **Invite-only**: self-service signup is hidden. New members must be invited by an admin and accept a one-click invitation by email.
- **Domain-locked**: passwordless and self-service signup are restricted to a list of approved email domains (e.g. `@acme.union`).
- **MFA-required for selected roles**: admins can require two-factor (authenticator-app) for any role — typically `admin`, `coo`, `app_owner`, and `platform_admin`. Users with those roles see a one-time enrollment screen and a 6-digit-code prompt at every sign-in.

Any combination of the above is supported and can be changed at any time
without disrupting existing sessions.

## Invitations

When an admin invites a new colleague, an email is sent with a single-use
link that:

- Creates the account if it doesn't exist yet
- Adds the user to the organization with the role the admin chose (member, steward, chief steward, admin, or COO)
- Signs them in immediately — no extra password to set

Invitations are valid for seven days, can be revoked at any time, and the
role they grant cannot be changed by the recipient.

## Security at a glance

| Property | Guarantee |
|---|---|
| Password storage | Argon2id, OWASP-recommended parameters |
| Session storage | Opaque token, SHA-256-hashed at rest; 24-hour expiry |
| Magic-link / invite tokens | Random 256-bit, hashed at rest, single-use |
| Cookie | `httpOnly`, `Secure` (production), `SameSite=Lax` |
| Audit | Every sign-in event recorded with IP and user agent |
| Lockout | After 5 failed password attempts, account locks for 15 minutes |
| Rate limits | Password resets and magic-link requests capped per email/IP |
| Two-factor (MFA) | TOTP authenticator-app codes, optional self-enrollment, can be **required by role** for admins |
| Recovery codes | 10 single-use codes issued at MFA enrollment, hashed at rest |
| Risk-based step-up | New device or privileged role triggers an MFA challenge automatically |
| Off-boarding | Suspend / reactivate / deprovision flows revoke all sessions instantly |

## What about Clerk?

Union Eyes was migrated off Clerk in early 2026. All authentication is now
handled in-house by `@nzila/platform-auth`, which means:

- No third-party dependency for the auth path
- Full control of the audit trail
- Tokens never leave the Nzila perimeter
- Sovereign-friendly (Canada-region only)
