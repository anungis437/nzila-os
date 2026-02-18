#!/usr/bin/env python3
"""
Union Eyes Data Migration Runner

Pure PostgreSQL-to-PostgreSQL migration.
Reads from UE's legacy PostgreSQL database and writes to the Django-managed
nzila_union_eyes database.

Prerequisites:
    pip install psycopg2-binary

Usage:
    # Set source URL (your legacy PostgreSQL connection - NOT a Supabase SDK URL)
    $env:SOURCE_DATABASE_URL = "postgresql://unionadmin:PASSWORD@unioneyes-staging-db.postgres.database.azure.com:5432/unioneyes?sslmode=require"

    # Dry run first
    python migrate_ue.py --dry-run

    # Full migration
    python migrate_ue.py

    # Resume after failure
    python migrate_ue.py --resume

    # Validate row counts
    python migrate_ue.py --validate
"""

import sys
from pathlib import Path

# Add generators to path
sys.path.insert(0, str(Path(__file__).parent))

from data_migrator import run_migration, validate_migration


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Union Eyes — PostgreSQL data migration"
    )
    parser.add_argument("--source-url", "-s", help="Source PostgreSQL URL")
    parser.add_argument("--target-url", "-t", help="Target PostgreSQL URL (default: localhost/nzila_union_eyes)")
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
            platform="ue",
            source_url=args.source_url,
            target_url=args.target_url,
        )
    else:
        run_migration(
            platform="ue",
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
