/**
 * Demo-local user-role enum shim.
 *
 * Wave 0 §2 remediation: the operational role catalog is enormous. The
 * demo only uses `MEMBER`, `STEWARD`, `OFFICER`, `ADMIN` as sentinels for
 * the demo persona resolver. This shim exposes just the minimum surface
 * the demo pages reference.
 *
 * Do NOT expand this enum to mirror the operational catalog. If a demo
 * page needs a role value not listed here, that is a signal the demo
 * page is over-reaching into operational territory and should be
 * simplified.
 */

export enum UserRole {
  MEMBER = 'member',
  STEWARD = 'steward',
  OFFICER = 'officer',
  ADMIN = 'admin',
}
