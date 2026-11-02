/** CLI for scripts/lib/rbac-catalog-migration.ts: prints platform migration 0076 (or its rollback) from the code catalog. */
import { renderCatalogMigration, renderCatalogRollback } from './lib/rbac-catalog-migration'

process.stdout.write(process.argv.includes('--rollback') ? renderCatalogRollback() : renderCatalogMigration())
