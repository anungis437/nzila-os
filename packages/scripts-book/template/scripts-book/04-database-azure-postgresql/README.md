# Chapter 04 — Database ({{DB_PROVIDER}})

This chapter covers database provisioning, migration strategy, and connection
pooling for **{{PRODUCT_NAME}}**.

## Provider

The production database is hosted on **{{DB_PROVIDER}}**. Local development
may use a Docker-based PostgreSQL instance or connect to a dev-tier remote
database.

## Connection strings

| Environment | Variable       | Example                                          |
| ----------- | -------------- | ------------------------------------------------ |
| Local       | `DATABASE_URL` | `postgresql://user:pass@localhost:5432/{{REPO_NAME}}` |
| Staging     | `DATABASE_URL` | Set via {{DEPLOY_PROVIDER}} secrets              |
| Production  | `DATABASE_URL` | Set via {{DEPLOY_PROVIDER}} secrets              |

## Migration strategy

Migrations are managed with Drizzle ORM. The workflow is:

1. Edit the schema in `{{PRIMARY_APP_PATH}}/db/schema.ts`.
2. Generate a migration:

   ```bash
   pnpm --filter {{PRIMARY_APP_PATH}} run db:generate
   ```

3. Apply the migration:

   ```bash
   ./04-database-azure-postgresql/migrate.sh
   ```

4. Commit both the schema change and the generated SQL file.

## Connection pooling

{{DB_PROVIDER}} supports built-in PgBouncer-compatible pooling. Enable it by
appending `?pgbouncer=true&connection_limit=10` to `DATABASE_URL`.

## Backup and restore

- Automated backups are configured in {{DB_PROVIDER}} with a 7-day retention.
- Point-in-time restore is available for production databases.

## Scripts in this chapter

| Script       | Purpose                                    |
| ------------ | ------------------------------------------ |
| `migrate.sh`  | Run pending migrations (Unix)             |
| `migrate.ps1` | Run pending migrations (Windows)          |
| `migrate.py`  | Run pending migrations (Python/cross-platform) |
