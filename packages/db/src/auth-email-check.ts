/**
 * Storage envelope for the email addresses accepted by platform-auth's Zod
 * validator. Retain every previously accepted address and include tagged and
 * apostrophe-containing local parts. This does not canonicalize aliases: two
 * distinct addresses remain distinct identities.
 */
export const LEGACY_AUTH_EMAIL_PATTERN = '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
export const AUTH_EMAIL_PATTERN = "^[A-Za-z0-9._%'+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"

export const authEmailSqlLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`

const definition = (pattern: string) =>
  `CHECK (((email)::text ~* ${authEmailSqlLiteral(pattern)}::text))`

/**
 * Explicit owner-operated compatibility upgrade, never run by application
 * startup. The caller must use a transaction with bounded lock/statement
 * timeouts and qualify the exact source and before/after catalog first.
 * PostgreSQL executes this DO statement atomically, including on validation or
 * lock failure. No row, ownership, grant, policy or RLS setting is changed.
 * An already upgraded constraint is a no-op; any unrecognized state refuses.
 */
export function compileAuthEmailCompatibilityUpgradeSql(): string {
  return `DO $ue_email$
DECLARE current_definition text; is_validated boolean; email_only boolean; relation_owner text;
BEGIN
  SELECT r.rolname INTO relation_owner FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
    WHERE c.oid='user_management.users'::regclass AND c.relkind='r' AND NOT c.relispartition;
  IF relation_owner IS DISTINCT FROM current_user THEN
    RAISE EXCEPTION 'AUTH_EMAIL_UPGRADE_TABLE_OWNER_REQUIRED';
  END IF;
  SELECT pg_get_constraintdef(c.oid), c.convalidated,
    c.contype='c' AND NOT c.condeferrable AND c.conkey=ARRAY[a.attnum]::smallint[]
    INTO current_definition,is_validated,email_only
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attname='email'
    WHERE c.conrelid='user_management.users'::regclass AND c.conname='valid_email';
  IF NOT coalesce(is_validated AND email_only,false) OR current_definition NOT IN (
    ${authEmailSqlLiteral(definition(LEGACY_AUTH_EMAIL_PATTERN))},
    ${authEmailSqlLiteral(definition(AUTH_EMAIL_PATTERN))}
  ) THEN RAISE EXCEPTION 'AUTH_EMAIL_UPGRADE_UNRECOGNIZED_CHECK'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='user_management.users'::regclass
    AND conname='valid_email_compatibility') THEN
    RAISE EXCEPTION 'AUTH_EMAIL_UPGRADE_COMPANION_CONFLICT';
  END IF;
  IF current_definition=${authEmailSqlLiteral(definition(AUTH_EMAIL_PATTERN))} THEN RETURN; END IF;
  ALTER TABLE user_management.users ADD CONSTRAINT valid_email_compatibility
    CHECK (email ~* ${authEmailSqlLiteral(AUTH_EMAIL_PATTERN)}) NOT VALID;
  ALTER TABLE user_management.users VALIDATE CONSTRAINT valid_email_compatibility;
  ALTER TABLE user_management.users DROP CONSTRAINT valid_email;
  ALTER TABLE user_management.users RENAME CONSTRAINT valid_email_compatibility TO valid_email;
END
$ue_email$;`
}
