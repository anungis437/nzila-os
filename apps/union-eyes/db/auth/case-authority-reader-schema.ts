/** UE case companions use the canonical reader's existing bounded table
 * grants. Namespace lookup is a separate prerequisite, never table authority. */
export const CASE_AUTHORITY_READER_ROLE = 'nzila_auth_org_authority_reader'

export function compileCaseAuthorityReaderSchemaSql(): string {
  return `GRANT USAGE ON SCHEMA public TO ${CASE_AUTHORITY_READER_ROLE};`
}

export const CASE_AUTHORITY_READER_SCHEMA_QUERY_FIELDS = `
  pg_catalog.has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','USAGE') AS reader_public_usage,
  pg_catalog.has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','CREATE') AS reader_public_create,
  pg_catalog.has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','USAGE WITH GRANT OPTION') AS reader_public_grant_option`

export function hasBoundedCaseAuthorityReaderSchema(row: Record<string, unknown>): boolean {
  return row.reader_public_usage === true && row.reader_public_create === false && row.reader_public_grant_option === false
}
