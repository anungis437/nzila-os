#!/usr/bin/env python3
"""Test source and target DB connections for data migration."""
import sys
try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2


def test_connection(label, params):
    """Test a single DB connection and report table count."""
    print(f"\n{'='*60}")
    print(f"Testing: {label}")
    print(f"  Host: {params['host']}")
    print(f"  Port: {params.get('port', 5432)}")
    print(f"  DB:   {params['dbname']}")
    print(f"  User: {params['user']}")
    print(f"  SSL:  {params.get('sslmode', 'prefer')}")
    print("-" * 60)
    
    try:
        conn = psycopg2.connect(
            host=params['host'],
            port=params.get('port', 5432),
            dbname=params['dbname'],
            user=params['user'],
            password=params['password'],
            sslmode=params.get('sslmode', 'prefer'),
            connect_timeout=15,
        )
        cur = conn.cursor()
        
        # Get PostgreSQL version
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"  Connected! Version: {version[:60]}...")
        
        # Count tables in public schema
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        """)
        table_count = cur.fetchone()[0]
        print(f"  Public tables: {table_count}")
        
        # Sample some table names
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name LIMIT 10;
        """)
        tables = [r[0] for r in cur.fetchall()]
        print(f"  Sample tables: {', '.join(tables)}")
        
        # Check total row count for a few tables
        total_rows = 0
        for t in tables[:3]:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}";')
                rows = cur.fetchone()[0]
                total_rows += rows
                print(f"    {t}: {rows:,} rows")
            except Exception as e:
                print(f"    {t}: ERROR - {e}")
                conn.rollback()
        
        cur.close()
        conn.close()
        print(f"  STATUS: SUCCESS")
        return True
        
    except Exception as e:
        print(f"  STATUS: FAILED")
        print(f"  Error: {e}")
        return False


if __name__ == "__main__":
    import os

    results = {}

    # -----------------------------------------------------------------------
    # 1. ABR Source (Legacy PostgreSQL — data migration complete)
    # Set ABR_SOURCE_DATABASE_URL to override individual vars
    # -----------------------------------------------------------------------
    abr_source_url = os.environ.get("ABR_SOURCE_DATABASE_URL", "")
    if abr_source_url:
        import urllib.parse as _up
        _p = _up.urlparse(abr_source_url)
        abr_source_params = {
            "host": _p.hostname,
            "port": _p.port or 5432,
            "dbname": _p.path.lstrip("/"),
            "user": _p.username,
            "password": _up.unquote(_p.password or ""),
            "sslmode": dict(x.split("=") for x in (_p.query or "").split("&") if "=" in x).get("sslmode", "require"),
        }
    else:
        abr_source_params = {
            "host": os.environ["ABR_SOURCE_HOST"],
            "port": int(os.environ.get("ABR_SOURCE_PORT", "5432")),
            "dbname": os.environ.get("ABR_SOURCE_DBNAME", "postgres"),
            "user": os.environ["ABR_SOURCE_USER"],
            "password": os.environ["ABR_SOURCE_PASSWORD"],
            "sslmode": os.environ.get("ABR_SOURCE_SSLMODE", "require"),
        }
    results["ABR Source (Legacy PostgreSQL)"] = test_connection("ABR Source (Legacy PostgreSQL)", abr_source_params)

    # -----------------------------------------------------------------------
    # 2. UE Source (Azure PostgreSQL — data migration complete)
    # Set UE_SOURCE_DATABASE_URL to override individual vars
    # -----------------------------------------------------------------------
    ue_source_url = os.environ.get("UE_SOURCE_DATABASE_URL", "")
    if ue_source_url:
        import urllib.parse as _up2
        _p2 = _up2.urlparse(ue_source_url)
        ue_source_params = {
            "host": _p2.hostname,
            "port": _p2.port or 5432,
            "dbname": _p2.path.lstrip("/"),
            "user": _p2.username,
            "password": _up2.unquote(_p2.password or ""),
            "sslmode": dict(x.split("=") for x in (_p2.query or "").split("&") if "=" in x).get("sslmode", "require"),
        }
    else:
        ue_source_params = {
            "host": os.environ["UE_SOURCE_HOST"],
            "port": int(os.environ.get("UE_SOURCE_PORT", "5432")),
            "dbname": os.environ.get("UE_SOURCE_DBNAME", "unioneyes"),
            "user": os.environ["UE_SOURCE_USER"],
            "password": os.environ["UE_SOURCE_PASSWORD"],
            "sslmode": os.environ.get("UE_SOURCE_SSLMODE", "require"),
        }
    results["UE Source (Azure PostgreSQL)"] = test_connection("UE Source (Azure PostgreSQL)", ue_source_params)

    # -----------------------------------------------------------------------
    # 3. ABR Target (Local Docker — port 5433)
    # -----------------------------------------------------------------------
    results["ABR Target (Local)"] = test_connection("ABR Target (Local)", {
        "host": os.environ.get("ABR_TARGET_HOST", "localhost"),
        "port": int(os.environ.get("ABR_TARGET_PORT", "5433")),
        "dbname": os.environ.get("ABR_TARGET_DBNAME", "nzila_abr_insights"),
        "user": os.environ.get("ABR_TARGET_USER", "nzila"),
        "password": os.environ.get("ABR_TARGET_PASSWORD", "nzila_dev"),
    })

    # -----------------------------------------------------------------------
    # 4. UE Target (Local Docker — port 5433)
    # -----------------------------------------------------------------------
    results["UE Target (Local)"] = test_connection("UE Target (Local)", {
        "host": os.environ.get("UE_TARGET_HOST", "localhost"),
        "port": int(os.environ.get("UE_TARGET_PORT", "5433")),
        "dbname": os.environ.get("UE_TARGET_DBNAME", "nzila_union_eyes"),
        "user": os.environ.get("UE_TARGET_USER", "nzila"),
        "password": os.environ.get("UE_TARGET_PASSWORD", "nzila_dev"),
    })
    
    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print(f"\n{'='*60}")
    print("CONNECTION TEST SUMMARY")
    print("=" * 60)
    for label, ok in results.items():
        status = "PASS" if ok else "FAIL"
        icon = "✓" if ok else "✗"
        print(f"  {icon} {label}: {status}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"\n  {passed}/{total} connections successful")
    
    if passed < total:
        sys.exit(1)
