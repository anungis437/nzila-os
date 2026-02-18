#!/usr/bin/env python3
"""
ABR Insights Data Migration Runner

Pure PostgreSQL-to-PostgreSQL migration.
Reads from ABR's legacy PostgreSQL database and writes to the Django-managed
nzila_abr_insights database.

Prerequisites:
    pip install psycopg2-binary

Usage:
    # Set source URL (direct PostgreSQL connection string for the legacy DB)
    $env:SOURCE_DATABASE_URL = "postgresql://postgres:PASSWORD@db.your-project.supabase.co:5432/postgres"

    # Dry run first
    python migrate_abr.py --dry-run

    # Full migration
    python migrate_abr.py

    # Resume after failure
    python migrate_abr.py --resume

    # Validate row counts
    python migrate_abr.py --validate

Notes:
    - Column renames: 'not' → 'not_field', 'or' → 'or_field' (Python reserved words)
    - pgvector 'embedding' columns are skipped (rebuild post-migration)
    - Generated 'search_vector' columns are skipped (auto-rebuilt by PostgreSQL)
"""

import sys
from pathlib import Path

# Add generators to path
sys.path.insert(0, str(Path(__file__).parent))

from data_migrator import run_migration, validate_migration


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="ABR Insights — PostgreSQL data migration"
    )
    parser.add_argument("--source-url", "-s", help="Source PostgreSQL URL")
    parser.add_argument("--target-url", "-t", help="Target PostgreSQL URL (default: localhost/nzila_abr_insights)")
    parser.add_argument("--dry-run", action="store_true", help="Read-only test run")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--tables", help="Comma-separated table list")
    parser.add_argument("--validate", action="store_true", help="Compare row counts")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--verbose", "-v", action="store_true")

    args = parser.parse_args()
    only_tables = [t.strip() for t in args.tables.split(",")] if args.tables else None

    if args.validate:
        validate_migration(
            platform="abr",
            source_url=args.source_url,
            target_url=args.target_url,
        )
    else:
        run_migration(
            platform="abr",
            source_url=args.source_url,
            target_url=args.target_url,
            dry_run=args.dry_run,
            resume=args.resume,
            only_tables=only_tables,
            batch_size=args.batch_size,
            verbose=args.verbose,
        )


if __name__ == "__main__":
    main()
