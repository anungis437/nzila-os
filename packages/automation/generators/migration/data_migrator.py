#!/usr/bin/env python3
"""
Data Migrator — PostgreSQL-to-PostgreSQL data migration engine

Migrates data from legacy PostgreSQL databases to Django-managed PostgreSQL databases.
Pure PostgreSQL — no external service SDKs. Connects via standard DATABASE_URL.

Usage:
    # Dry run (no writes)
    python data_migrator.py --platform ue --dry-run

    # Full migration
    python data_migrator.py --platform ue

    # Resume after failure
    python data_migrator.py --platform ue --resume

    # Migrate specific tables only
    python data_migrator.py --platform abr --tables organizations,profiles,roles

Environment Variables:
    SOURCE_DATABASE_URL  — PostgreSQL connection string for source DB
    TARGET_DATABASE_URL  — PostgreSQL connection string for target DB (or uses Django defaults)

Examples:
    SOURCE_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
    TARGET_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nzila_union_eyes"
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime
from uuid import uuid4
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, field, asdict
from collections import defaultdict, OrderedDict
from urllib.parse import urlparse, unquote

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2 import sql as pgsql
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("data_migrator")


# ---------------------------------------------------------------------------
# Configuration dataclasses
# ---------------------------------------------------------------------------
@dataclass
class ColumnMapping:
    """Defines how a source column maps to a target column."""
    source_col: str
    target_col: str
    transform: Optional[str] = None  # e.g. 'cast_uuid', 'json_to_text'


@dataclass
class TableMapping:
    """Maps a source table to a target table."""
    source_table: str
    target_table: str  # Same as source in our case (db_table preserves names)
    column_renames: Dict[str, str] = field(default_factory=dict)  # src → tgt
    skip_columns: Set[str] = field(default_factory=set)  # columns to skip
    drop_columns: Set[str] = field(default_factory=set)  # source cols not in target
    fk_dependencies: List[str] = field(default_factory=list)  # source tables this depends on
    enabled: bool = True


@dataclass
class MigrationProgress:
    """Tracks migration progress for resume capability."""
    platform: str
    started_at: str
    last_updated: str
    completed_tables: List[str] = field(default_factory=list)
    failed_tables: Dict[str, str] = field(default_factory=dict)  # table → error
    row_counts: Dict[str, int] = field(default_factory=dict)  # table → rows migrated
    total_tables: int = 0
    total_rows: int = 0
    status: str = "in_progress"  # in_progress, completed, failed


# ---------------------------------------------------------------------------
# Python reserved words — fields renamed in Django models
# ---------------------------------------------------------------------------
_PYTHON_RESERVED_WORDS = {
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
    'while', 'with', 'yield',
}

# SQL/Django reserved words that may have been renamed
_SQL_RESERVED_RENAMES = {
    'not': 'not_field',
    'or': 'or_field',
    'and': 'and_field',
    'in': 'in_field',
    'is': 'is_field',
    'as': 'as_field',
    'if': 'if_field',
    'for': 'for_field',
    'class': 'class_field',
    'from': 'from_field',
    'import': 'import_field',
    'return': 'return_field',
    'type': 'type_field',
    'global': 'global_field',
    'with': 'with_field',
    'raise': 'raise_field',
    'pass': 'pass_field',
    'yield': 'yield_field',
    'try': 'try_field',
    'del': 'del_field',
    'lambda': 'lambda_field',
    'while': 'while_field',
    'else': 'else_field',
    'break': 'break_field',
    'except': 'except_field',
    'finally': 'finally_field',
    'continue': 'continue_field',
}

# Generated/computed columns to always skip
_ALWAYS_SKIP_COLUMNS = {
    'search_vector',  # TSVECTOR GENERATED
}


# ---------------------------------------------------------------------------
# Platform configurations
# ---------------------------------------------------------------------------
def get_ue_config() -> Dict:
    """Union Eyes platform configuration."""
    return {
        "platform_id": "ue",
        "platform_name": "Union Eyes",
        "target_db_name": "nzila_union_eyes",
        "target_db_defaults": {
            "host": "localhost",
            "port": "5432",
            "user": "postgres",
            "password": "postgres",
            "dbname": "nzila_union_eyes",
        },
        # Source connects via DATABASE_URL env var
        "source_schema": "public",
        "target_schema": "public",
        # Tables with known column issues
        "column_renames": {},  # UE has no Python reserved word renames
        "skip_columns_by_table": {
            # pgvector embedding columns
            "case_embeddings": {"embedding"},
            "course_embeddings": {"embedding"},
            "lesson_embeddings": {"embedding"},
            "document_embeddings": {"embedding"},
            "knowledge_base_embeddings": {"embedding"},
        },
    }


def get_abr_config() -> Dict:
    """ABR Insights platform configuration."""
    return {
        "platform_id": "abr",
        "platform_name": "ABR Insights",
        "target_db_name": "nzila_abr_insights",
        "target_db_defaults": {
            "host": "localhost",
            "port": "5432",
            "user": "postgres",
            "password": "postgres",
            "dbname": "nzila_abr_insights",
        },
        "source_schema": "public",
        "target_schema": "public",
        # ABR has Python reserved word renames
        "column_renames": {
            # Global renames applied to any table that has these columns
            "not": "not_field",
            "or": "or_field",
        },
        "skip_columns_by_table": {
            "case_embeddings": {"embedding"},
            "course_embeddings": {"embedding"},
            "lesson_embeddings": {"embedding"},
        },
    }


# ---------------------------------------------------------------------------
# Database connection helpers
# ---------------------------------------------------------------------------
def parse_database_url(url: str) -> Dict[str, str]:
    """Parse DATABASE_URL into connection params."""
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": unquote(parsed.username or "postgres"),
        "password": unquote(parsed.password or ""),
        "dbname": parsed.path.lstrip("/") or "postgres",
        "sslmode": dict(
            param.split("=") for param in (parsed.query.split("&") if parsed.query else [])
        ).get("sslmode", "prefer"),
    }


def connect_db(params: Dict[str, str], label: str = "db") -> psycopg2.extensions.connection:
    """Create a PostgreSQL connection."""
    logger.info(f"Connecting to {label}: {params['host']}:{params['port']}/{params['dbname']}")
    conn = psycopg2.connect(
        host=params["host"],
        port=params["port"],
        user=params["user"],
        password=params["password"],
        dbname=params["dbname"],
        sslmode=params.get("sslmode", "prefer"),
        connect_timeout=30,
    )
    conn.set_client_encoding("UTF8")
    return conn


# ---------------------------------------------------------------------------
# Schema introspection
# ---------------------------------------------------------------------------
def get_table_list(conn: psycopg2.extensions.connection, schema: str = "public") -> List[str]:
    """Get all user tables in a schema."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = %s 
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'django_%%'
              AND table_name NOT LIKE 'auth_%%'
              AND table_name != 'django_migrations'
              AND table_name != 'django_content_type'
              AND table_name != 'django_admin_log'
              AND table_name != 'django_session'
            ORDER BY table_name
        """, (schema,))
        return [row[0] for row in cur.fetchall()]


def get_target_table_list(conn: psycopg2.extensions.connection, schema: str = "public") -> List[str]:
    """Get all Django-managed tables (including django_ and auth_ prefixed ones)."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = %s 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """, (schema,))
        return [row[0] for row in cur.fetchall()]


def get_table_columns(conn: psycopg2.extensions.connection, table: str, schema: str = "public") -> List[Dict]:
    """Get column info for a table."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                column_name,
                data_type,
                udt_name,
                is_nullable,
                column_default,
                character_maximum_length,
                is_generated
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table))
        return [dict(row) for row in cur.fetchall()]


def get_table_row_count(conn: psycopg2.extensions.connection, table: str, schema: str = "public") -> int:
    """Get approximate row count for a table."""
    with conn.cursor() as cur:
        cur.execute(
            pgsql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                pgsql.Identifier(schema),
                pgsql.Identifier(table)
            )
        )
        return cur.fetchone()[0]


def get_foreign_keys(conn: psycopg2.extensions.connection, schema: str = "public") -> Dict[str, List[str]]:
    """Get FK dependency map: table → list of tables it depends on."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT
                tc.table_name AS child_table,
                ccu.table_name AS parent_table
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = %s
        """, (schema,))
        deps = defaultdict(list)
        for child, parent in cur.fetchall():
            if child != parent:  # skip self-references
                deps[child].append(parent)
        return dict(deps)


def topological_sort(tables: List[str], deps: Dict[str, List[str]]) -> List[str]:
    """Sort tables in FK dependency order (parents first)."""
    visited = set()
    result = []
    visiting = set()  # cycle detection

    def visit(table: str):
        if table in visited:
            return
        if table in visiting:
            # Cycle detected — break it (circular FK is fine, we defer constraints)
            return
        visiting.add(table)
        for dep in deps.get(table, []):
            if dep in tables:
                visit(dep)
        visiting.discard(table)
        visited.add(table)
        result.append(table)

    for t in sorted(tables):
        visit(t)

    return result


# ---------------------------------------------------------------------------
# Column matching engine
# ---------------------------------------------------------------------------
def match_columns(
    source_cols: List[Dict],
    target_cols: List[Dict],
    global_renames: Dict[str, str],
    table_skip: Set[str],
) -> Tuple[List[str], List[str], Dict[str, str], List[str]]:
    """
    Match source columns to target columns.
    
    Returns:
        - matched_source_cols: source columns to SELECT
        - matched_target_cols: target columns to INSERT INTO
        - renames: source→target name map for renamed columns
        - skipped: columns that exist in source but not in target
    """
    target_names = {c["column_name"] for c in target_cols}
    # Also check for generated columns in target
    target_generated = {
        c["column_name"] for c in target_cols 
        if c.get("is_generated") == "ALWAYS"
    }

    matched_source = []
    matched_target = []
    renames = {}
    skipped = []

    for sc in source_cols:
        src_name = sc["column_name"]

        # Always skip generated columns (search_vector, etc.)
        if src_name in _ALWAYS_SKIP_COLUMNS or src_name in table_skip:
            skipped.append(f"{src_name} (skip-listed)")
            continue

        # Skip if source column is a generated column
        if sc.get("is_generated") == "ALWAYS":
            skipped.append(f"{src_name} (generated)")
            continue

        # Direct match
        if src_name in target_names and src_name not in target_generated:
            matched_source.append(src_name)
            matched_target.append(src_name)
            continue

        # Check global renames (e.g., 'not' → 'not_field')
        renamed = global_renames.get(src_name)
        if renamed and renamed in target_names and renamed not in target_generated:
            matched_source.append(src_name)
            matched_target.append(renamed)
            renames[src_name] = renamed
            continue

        # Check SQL reserved word renames
        reserved_renamed = _SQL_RESERVED_RENAMES.get(src_name)
        if reserved_renamed and reserved_renamed in target_names and reserved_renamed not in target_generated:
            matched_source.append(src_name)
            matched_target.append(reserved_renamed)
            renames[src_name] = reserved_renamed
            continue

        # FK convention: Django FK field 'foo' creates column 'foo_id'
        # But our source already has 'foo_id' and target also has 'foo_id'
        # So this case is handled by direct match above.

        # Column exists in source but not target — skip gracefully
        skipped.append(f"{src_name} (not in target)")

    return matched_source, matched_target, renames, skipped


def get_target_only_notnull(
    target_cols: List[Dict],
    matched_target_names: Set[str],
) -> Tuple[List[str], Dict[str, Any]]:
    """
    Find target NOT NULL columns that have no default and are not matched
    from the source.  Return the column names and sensible default values
    based on their data type.
    """
    _TYPE_DEFAULTS: Dict[str, Any] = {
        "integer": 0,
        "bigint": 0,
        "smallint": 0,
        "numeric": 0,
        "boolean": False,
        "character varying": "",
        "text": "",
        "ARRAY": [],  # psycopg2 adapts Python list → PostgreSQL array
        "jsonb": psycopg2.extras.Json({}),
        "json": psycopg2.extras.Json({}),
        "timestamp with time zone": datetime.now(),
        "timestamp without time zone": datetime.now(),
        "date": datetime.now().date(),
        "uuid": lambda: str(uuid4()),  # Callable — generates a new UUID string per row
    }

    extra_cols: List[str] = []
    extra_defaults: Dict[str, Any] = {}

    for col in target_cols:
        name = col["column_name"]
        if name in matched_target_names:
            continue
        if col["is_nullable"] == "YES":
            continue
        if col.get("column_default") is not None:
            continue  # Has a server-side default
        if col.get("is_generated") == "ALWAYS":
            continue

        dtype = col["data_type"]
        default_val = _TYPE_DEFAULTS.get(dtype)
        if default_val is None and dtype not in _TYPE_DEFAULTS:
            # Unknown type — skip, may cause an error but better than crashing here
            logger.warning(
                f"    Cannot determine default for NOT NULL column '{name}' "
                f"(type={dtype}) — skipping"
            )
            continue

        extra_cols.append(name)
        extra_defaults[name] = default_val
        logger.debug(
            f"    Auto-default: {name} ({dtype}) = {repr(default_val)}"
        )

    return extra_cols, extra_defaults


# ---------------------------------------------------------------------------
# Data migration core
# ---------------------------------------------------------------------------
BATCH_SIZE = 1000  # rows per INSERT batch


def _adapt_row(
    row: tuple,
    target_cols: List[str],
    extra_defaults: Dict[str, Any] = None,
    target_col_types: Dict[str, str] = None,
) -> tuple:
    """
    Pre-process a row for insertion:
    - Wrap dict/list values in psycopg2.extras.Json for JSONB/JSON columns
    - Keep lists as-is for ARRAY target columns (psycopg2 handles list → PG array)
    - Fill NULL created_at/updated_at with current timestamp
    - Append default values for target-only NOT NULL columns
      (callable defaults like uuid4 are invoked per row)
    """
    now = datetime.now()
    col_types = target_col_types or {}
    adapted = []
    for val, col in zip(row, target_cols[:len(row)]):
        tgt_type = col_types.get(col, "")
        if isinstance(val, dict):
            adapted.append(psycopg2.extras.Json(val))
        elif isinstance(val, list):
            # ARRAY target columns: keep as Python list (psycopg2 adapts natively)
            # JSONB/JSON target columns: wrap in Json()
            if tgt_type == "ARRAY":
                adapted.append(val)
            else:
                adapted.append(psycopg2.extras.Json(val))
        elif val is None and col in ("created_at", "updated_at"):
            adapted.append(now)
        else:
            adapted.append(val)
    # Append defaults for target-only NOT NULL columns
    if extra_defaults:
        for col in target_cols[len(row):]:
            default = extra_defaults.get(col)
            # Callable defaults (e.g. uuid4) are invoked per row
            adapted.append(default() if callable(default) else default)
    return tuple(adapted)


def migrate_table(
    source_conn: psycopg2.extensions.connection,
    target_conn: psycopg2.extensions.connection,
    source_table: str,
    target_table: str,
    source_cols: List[str],
    target_cols: List[str],
    source_schema: str = "public",
    target_schema: str = "public",
    dry_run: bool = False,
    batch_size: int = BATCH_SIZE,
    extra_defaults: Optional[Dict[str, Any]] = None,
    target_col_types: Optional[Dict[str, str]] = None,
) -> int:
    """
    Migrate data from source table to target table.
    
    Returns number of rows migrated.
    """
    if not source_cols:
        logger.warning(f"  No matched columns for {source_table} — skipping")
        return 0

    # Build SELECT query
    select_cols = pgsql.SQL(", ").join(
        pgsql.Identifier(c) for c in source_cols
    )
    select_query = pgsql.SQL("SELECT {} FROM {}.{}").format(
        select_cols,
        pgsql.Identifier(source_schema),
        pgsql.Identifier(source_table),
    )

    # Build INSERT query with ON CONFLICT DO NOTHING for idempotency
    insert_cols = pgsql.SQL(", ").join(
        pgsql.Identifier(c) for c in target_cols
    )
    placeholders = pgsql.SQL(", ").join(
        pgsql.Placeholder() for _ in target_cols
    )
    insert_query = pgsql.SQL(
        "INSERT INTO {}.{} ({}) VALUES ({}) ON CONFLICT DO NOTHING"
    ).format(
        pgsql.Identifier(target_schema),
        pgsql.Identifier(target_table),
        insert_cols,
        placeholders,
    )

    total_rows = 0

    with source_conn.cursor(name=f"migrate_{source_table}") as src_cur:
        src_cur.itersize = batch_size
        src_cur.execute(select_query)

        batch = []
        for row in src_cur:
            batch.append(_adapt_row(row, target_cols, extra_defaults, target_col_types))
            if len(batch) >= batch_size:
                if not dry_run:
                    with target_conn.cursor() as tgt_cur:
                        psycopg2.extras.execute_batch(
                            tgt_cur, insert_query.as_string(target_conn), batch
                        )
                    target_conn.commit()
                total_rows += len(batch)
                batch = []

        # Remaining rows
        if batch:
            if not dry_run:
                with target_conn.cursor() as tgt_cur:
                    psycopg2.extras.execute_batch(
                        tgt_cur, insert_query.as_string(target_conn), batch
                    )
                target_conn.commit()
            total_rows += len(batch)

    return total_rows


# ---------------------------------------------------------------------------
# Progress checkpoint management
# ---------------------------------------------------------------------------
def get_progress_path(platform: str) -> Path:
    """Get path to progress checkpoint file."""
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / f"migration_progress_{platform}.json"


def save_progress(progress: MigrationProgress):
    """Save migration progress to disk."""
    progress.last_updated = datetime.now().isoformat()
    path = get_progress_path(progress.platform)
    with open(path, "w") as f:
        json.dump(asdict(progress), f, indent=2, default=str)
    logger.debug(f"Progress saved to {path}")


def load_progress(platform: str) -> Optional[MigrationProgress]:
    """Load migration progress from disk."""
    path = get_progress_path(platform)
    if not path.exists():
        return None
    with open(path) as f:
        data = json.load(f)
    return MigrationProgress(**data)


# ---------------------------------------------------------------------------
# Constraint management
# ---------------------------------------------------------------------------
def disable_fk_constraints(conn: psycopg2.extensions.connection, tables: List[str], schema: str = "public"):
    """Temporarily disable FK constraint checking for target tables."""
    with conn.cursor() as cur:
        for table in tables:
            try:
                cur.execute(
                    pgsql.SQL("ALTER TABLE {}.{} DISABLE TRIGGER ALL").format(
                        pgsql.Identifier(schema),
                        pgsql.Identifier(table),
                    )
                )
            except Exception as e:
                logger.warning(f"  Could not disable triggers for {table}: {e}")
                conn.rollback()
    conn.commit()


def enable_fk_constraints(conn: psycopg2.extensions.connection, tables: List[str], schema: str = "public"):
    """Re-enable FK constraint checking for target tables."""
    with conn.cursor() as cur:
        for table in tables:
            try:
                cur.execute(
                    pgsql.SQL("ALTER TABLE {}.{} ENABLE TRIGGER ALL").format(
                        pgsql.Identifier(schema),
                        pgsql.Identifier(table),
                    )
                )
            except Exception as e:
                logger.warning(f"  Could not enable triggers for {table}: {e}")
                conn.rollback()
    conn.commit()


# ---------------------------------------------------------------------------
# Main migration orchestrator
# ---------------------------------------------------------------------------
def run_migration(
    platform: str,
    source_url: Optional[str] = None,
    target_url: Optional[str] = None,
    dry_run: bool = False,
    resume: bool = False,
    only_tables: Optional[List[str]] = None,
    batch_size: int = BATCH_SIZE,
    verbose: bool = False,
):
    """
    Run data migration for a platform.
    
    Args:
        platform: 'ue' or 'abr'
        source_url: PostgreSQL connection string for source DB
        target_url: PostgreSQL connection string for target DB
        dry_run: If True, read source but don't write to target
        resume: Resume from last checkpoint
        only_tables: Migrate only these tables (for targeted migration)
        batch_size: Rows per INSERT batch
        verbose: Extra logging
    """
    if verbose:
        logger.setLevel(logging.DEBUG)

    # Load platform config
    if platform == "ue":
        config = get_ue_config()
    elif platform == "abr":
        config = get_abr_config()
    else:
        raise ValueError(f"Unknown platform: {platform}. Use 'ue' or 'abr'.")

    logger.info("=" * 70)
    logger.info(f"DATA MIGRATION — {config['platform_name']}")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info("=" * 70)

    # Resolve connection strings
    if not source_url:
        source_url = os.environ.get("SOURCE_DATABASE_URL")
    if not source_url:
        logger.error(
            "No source database URL provided.\n"
            "Set SOURCE_DATABASE_URL env var or pass --source-url.\n"
            "Example: postgresql://user:pass@host:5432/dbname"
        )
        sys.exit(1)

    if not target_url:
        target_url = os.environ.get("TARGET_DATABASE_URL")
    if not target_url:
        # Build from platform defaults
        d = config["target_db_defaults"]
        target_url = f"postgresql://{d['user']}:{d['password']}@{d['host']}:{d['port']}/{d['dbname']}"

    source_params = parse_database_url(source_url)
    target_params = parse_database_url(target_url)

    # Connect
    source_conn = connect_db(source_params, f"source ({config['platform_name']})")
    target_conn = connect_db(target_params, f"target ({config['target_db_name']})")

    try:
        _execute_migration(
            config, source_conn, target_conn,
            dry_run=dry_run,
            resume=resume,
            only_tables=only_tables,
            batch_size=batch_size,
        )
    finally:
        source_conn.close()
        target_conn.close()


def _execute_migration(
    config: Dict,
    source_conn: psycopg2.extensions.connection,
    target_conn: psycopg2.extensions.connection,
    dry_run: bool = False,
    resume: bool = False,
    only_tables: Optional[List[str]] = None,
    batch_size: int = BATCH_SIZE,
):
    """Internal migration execution."""
    platform = config["platform_id"]
    source_schema = config["source_schema"]
    target_schema = config["target_schema"]
    global_renames = config.get("column_renames", {})
    skip_by_table = config.get("skip_columns_by_table", {})

    # Step 1: Discover tables
    logger.info("\n--- Step 1: Discovering tables ---")
    source_tables = set(get_table_list(source_conn, source_schema))
    target_tables = set(get_target_table_list(target_conn, target_schema))

    # Filter to tables that exist in BOTH source and target
    # (excludes Django system tables that only exist in target)
    common_tables = source_tables & target_tables
    source_only = source_tables - target_tables
    target_only = target_tables - source_tables

    logger.info(f"  Source tables: {len(source_tables)}")
    logger.info(f"  Target tables: {len(target_tables)}")
    logger.info(f"  Common (migratable): {len(common_tables)}")

    if source_only:
        logger.info(f"  Source-only (skipped): {len(source_only)}")
        for t in sorted(source_only):
            logger.debug(f"    - {t}")

    if only_tables:
        common_tables = {t for t in common_tables if t in only_tables}
        logger.info(f"  Filtered to {len(common_tables)} requested tables")

    if not common_tables:
        logger.warning("No common tables found between source and target!")
        return

    # Step 2: Build FK dependency order
    logger.info("\n--- Step 2: Building dependency order ---")
    target_fks = get_foreign_keys(target_conn, target_schema)
    ordered_tables = topological_sort(list(common_tables), target_fks)
    logger.info(f"  Migration order: {len(ordered_tables)} tables")

    # Step 3: Load/create progress checkpoint
    progress = None
    if resume:
        progress = load_progress(platform)
        if progress:
            logger.info(f"  Resuming: {len(progress.completed_tables)} tables already done")

    if not progress:
        progress = MigrationProgress(
            platform=platform,
            started_at=datetime.now().isoformat(),
            last_updated=datetime.now().isoformat(),
            total_tables=len(ordered_tables),
        )

    # Step 4: Disable FK constraints for faster loading
    logger.info("\n--- Step 3: Preparing target database ---")
    if not dry_run:
        logger.info("  Disabling FK triggers for bulk load...")
        disable_fk_constraints(target_conn, ordered_tables, target_schema)

    # Step 5: Migrate each table
    logger.info(f"\n--- Step 4: Migrating {len(ordered_tables)} tables ---")
    migration_start = time.time()
    success_count = 0
    error_count = 0
    total_rows = 0

    for i, table in enumerate(ordered_tables, 1):
        if resume and progress and table in progress.completed_tables:
            logger.info(f"  [{i}/{len(ordered_tables)}] {table} — SKIPPED (already done)")
            continue

        logger.info(f"  [{i}/{len(ordered_tables)}] {table}")

        try:
            # Get column info from both sides
            source_cols = get_table_columns(source_conn, table, source_schema)
            target_cols = get_table_columns(target_conn, table, target_schema)

            table_skip = skip_by_table.get(table, set()) | _ALWAYS_SKIP_COLUMNS

            # Match columns
            matched_src, matched_tgt, renames, skipped = match_columns(
                source_cols, target_cols, global_renames, table_skip
            )

            # Find target-only NOT NULL columns needing defaults
            extra_cols, extra_defaults = get_target_only_notnull(
                target_cols, set(matched_tgt)
            )
            if extra_cols:
                matched_tgt = matched_tgt + extra_cols
                logger.info(f"    Auto-defaults for {len(extra_cols)} target-only NOT NULL cols: {extra_cols}")

            # Build target column type map for ARRAY vs JSONB distinction
            target_col_types = {
                c["column_name"]: c["data_type"] for c in target_cols
            }

            if renames:
                logger.info(f"    Column renames: {renames}")
            if skipped:
                logger.debug(f"    Skipped columns: {skipped}")

            # Get source row count
            src_count = get_table_row_count(source_conn, table, source_schema)
            logger.info(f"    Source rows: {src_count:,}")

            if src_count == 0:
                logger.info(f"    Empty table — skipping")
                progress.completed_tables.append(table)
                progress.row_counts[table] = 0
                save_progress(progress)
                success_count += 1
                continue

            # Migrate data
            rows = migrate_table(
                source_conn, target_conn,
                table, table,
                matched_src, matched_tgt,
                source_schema, target_schema,
                dry_run=dry_run,
                batch_size=batch_size,
                extra_defaults=extra_defaults if extra_cols else None,
                target_col_types=target_col_types,
            )

            total_rows += rows
            progress.completed_tables.append(table)
            progress.row_counts[table] = rows
            progress.total_rows = total_rows
            save_progress(progress)
            success_count += 1

            action = "would migrate" if dry_run else "migrated"
            logger.info(f"    {action} {rows:,} rows ({len(matched_src)} columns)")

        except Exception as e:
            error_count += 1
            error_msg = str(e)
            progress.failed_tables[table] = error_msg
            save_progress(progress)
            logger.error(f"    FAILED: {error_msg}")
            # Continue with next table
            if not dry_run:
                target_conn.rollback()

    # Step 6: Re-enable FK constraints
    logger.info("\n--- Step 5: Re-enabling constraints ---")
    if not dry_run:
        enable_fk_constraints(target_conn, ordered_tables, target_schema)

    # Step 7: Summary
    elapsed = time.time() - migration_start
    progress.status = "completed" if error_count == 0 else "completed_with_errors"
    save_progress(progress)

    logger.info("\n" + "=" * 70)
    logger.info("MIGRATION SUMMARY")
    logger.info("=" * 70)
    logger.info(f"  Platform:     {config['platform_name']}")
    logger.info(f"  Mode:         {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"  Duration:     {elapsed:.1f}s")
    logger.info(f"  Tables OK:    {success_count}")
    logger.info(f"  Tables FAIL:  {error_count}")
    logger.info(f"  Total rows:   {total_rows:,}")

    if progress.failed_tables:
        logger.info("\n  FAILED TABLES:")
        for t, err in progress.failed_tables.items():
            logger.info(f"    - {t}: {err[:100]}")

    logger.info(f"\n  Progress saved to: {get_progress_path(platform)}")
    logger.info("=" * 70)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_migration(
    platform: str,
    source_url: Optional[str] = None,
    target_url: Optional[str] = None,
):
    """
    Validate migration by comparing row counts between source and target.
    """
    if platform == "ue":
        config = get_ue_config()
    elif platform == "abr":
        config = get_abr_config()
    else:
        raise ValueError(f"Unknown platform: {platform}")

    if not source_url:
        source_url = os.environ.get("SOURCE_DATABASE_URL")
    if not target_url:
        target_url = os.environ.get("TARGET_DATABASE_URL")
        if not target_url:
            d = config["target_db_defaults"]
            target_url = f"postgresql://{d['user']}:{d['password']}@{d['host']}:{d['port']}/{d['dbname']}"

    if not source_url:
        logger.error("SOURCE_DATABASE_URL required for validation")
        sys.exit(1)

    source_params = parse_database_url(source_url)
    target_params = parse_database_url(target_url)

    source_conn = connect_db(source_params, "source")
    target_conn = connect_db(target_params, "target")

    try:
        source_tables = set(get_table_list(source_conn, config["source_schema"]))
        target_tables = set(get_target_table_list(target_conn, config["target_schema"]))
        common = sorted(source_tables & target_tables)

        logger.info(f"\n{'TABLE':<50} {'SOURCE':>10} {'TARGET':>10} {'MATCH':>8}")
        logger.info("-" * 80)

        mismatches = 0
        for table in common:
            src_count = get_table_row_count(source_conn, table, config["source_schema"])
            tgt_count = get_table_row_count(target_conn, table, config["target_schema"])
            match = "✓" if src_count == tgt_count else "✗"
            if src_count != tgt_count:
                mismatches += 1
            logger.info(f"  {table:<48} {src_count:>10,} {tgt_count:>10,} {match:>8}")

        logger.info("-" * 80)
        if mismatches == 0:
            logger.info(f"  ALL {len(common)} tables match!")
        else:
            logger.warning(f"  {mismatches} tables have row count mismatches")

    finally:
        source_conn.close()
        target_conn.close()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="PostgreSQL-to-PostgreSQL data migration for Nzila platforms",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run for Union Eyes
  python data_migrator.py --platform ue --dry-run \\
    --source-url "postgresql://user:pass@host:5432/unioneyes"

  # Full migration for ABR Insights
  python data_migrator.py --platform abr \\
    --source-url "postgresql://postgres:pass@db.project.supabase.co:5432/postgres"

  # Resume failed migration
  python data_migrator.py --platform ue --resume \\
    --source-url "postgresql://user:pass@host:5432/unioneyes"

  # Migrate specific tables
  python data_migrator.py --platform abr --tables organizations,profiles \\
    --source-url "postgresql://postgres:pass@host:5432/postgres"

  # Validate after migration
  python data_migrator.py --platform ue --validate \\
    --source-url "postgresql://user:pass@host:5432/unioneyes"
        """,
    )
    parser.add_argument(
        "--platform", "-p",
        required=True,
        choices=["ue", "abr"],
        help="Platform to migrate: 'ue' (Union Eyes) or 'abr' (ABR Insights)",
    )
    parser.add_argument(
        "--source-url", "-s",
        help="PostgreSQL connection URL for source database",
    )
    parser.add_argument(
        "--target-url", "-t",
        help="PostgreSQL connection URL for target database (defaults to local Django DB)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read source data but don't write to target",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint",
    )
    parser.add_argument(
        "--tables",
        help="Comma-separated list of specific tables to migrate",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=BATCH_SIZE,
        help=f"Rows per INSERT batch (default: {BATCH_SIZE})",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate migration by comparing row counts",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    only_tables = None
    if args.tables:
        only_tables = [t.strip() for t in args.tables.split(",")]

    if args.validate:
        validate_migration(
            platform=args.platform,
            source_url=args.source_url,
            target_url=args.target_url,
        )
    else:
        run_migration(
            platform=args.platform,
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
